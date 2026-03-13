// Voice recognition: on-device Whisper via Transformers.js + WebGPU

import { pipeline } from "@huggingface/transformers";
import type { AutomaticSpeechRecognitionPipeline, ProgressCallback as HFProgressCallback } from "@huggingface/transformers";

/** Callback fired on each interim or final transcript update */
export type TranscriptCallback = (transcript: string, isFinal: boolean) => void;

/** Callback fired when a phrase match is detected */
export type MatchCallback = (
  phrase: string,
  spoken: string,
  similarity: number,
) => void;

/** Callback fired on recognition errors */
export type ErrorCallback = (error: string) => void;

/** Callback fired with model loading progress (0-1) */
export type ProgressCallback = (progress: number) => void;

export interface VoiceRecognitionOptions {
  /** Language for recognition (default: "en-US") */
  lang?: string;
  /** Similarity threshold 0-1 for fuzzy match (default: 0.8) */
  matchThreshold?: number;
  /** Called on each transcript update */
  onTranscript?: TranscriptCallback;
  /** Called when spoken text matches the target phrase */
  onMatch?: MatchCallback;
  /** Called on recognition errors */
  onError?: ErrorCallback;
  /** Called with model download/load progress (0-1) */
  onProgress?: ProgressCallback;
}

// ---------------------------------------------------------------------------
// Fuzzy matching: Levenshtein distance
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Single-row DP
  const row = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(
        (row[j] ?? 0) + 1, // deletion
        prev + 1, // insertion
        (row[j - 1] ?? 0) + cost, // substitution
      );
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }

  return row[n] ?? 0;
}

/** Normalize text for comparison: lowercase, strip punctuation, collapse spaces */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compute similarity ratio 0-1 between two strings */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

// ---------------------------------------------------------------------------
// Audio capture: record microphone chunks as Float32Array at 16kHz
// ---------------------------------------------------------------------------

const WHISPER_SAMPLE_RATE = 16000;
/** How often to run inference on accumulated audio (ms) */
const INFERENCE_INTERVAL_MS = 1500;
/** Max audio buffer length before we trim old samples (~10s) */
const MAX_BUFFER_SECONDS = 10;

// ---------------------------------------------------------------------------
// VoiceRecognition class — Whisper via Transformers.js
// ---------------------------------------------------------------------------

export class VoiceRecognition {
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  private modelLoading = false;
  private modelReady = false;
  private running = false;
  private targetPhrase = "";
  private readonly matchThreshold: number;
  private onTranscript: TranscriptCallback | null;
  private onMatch: MatchCallback | null;
  private onError: ErrorCallback | null;
  private onProgress: ProgressCallback | null;

  // Audio capture state
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private audioBuffer: Float32Array = new Float32Array(0);
  private inferenceTimer: ReturnType<typeof setInterval> | null = null;
  private inferring = false;

  constructor(opts: VoiceRecognitionOptions = {}) {
    this.matchThreshold = opts.matchThreshold ?? 0.8;
    this.onTranscript = opts.onTranscript ?? null;
    this.onMatch = opts.onMatch ?? null;
    this.onError = opts.onError ?? null;
    this.onProgress = opts.onProgress ?? null;
  }

  /** Whether WebGPU-based Whisper can run (always true if we get past the gate) */
  get supported(): boolean {
    return true;
  }

  /** Set the phrase the player needs to say */
  setTargetPhrase(phrase: string): void {
    this.targetPhrase = phrase;
    // Clear audio buffer when phrase changes so we don't match stale audio
    this.audioBuffer = new Float32Array(0);
  }

  /** Load the Whisper model. Call early to start the ~40MB download. */
  async loadModel(): Promise<void> {
    if (this.modelReady || this.modelLoading) return;
    this.modelLoading = true;

    try {
      const progressFiles = new Map<string, number>();

      const progressHandler: HFProgressCallback = (event) => {
        const e = event as Record<string, unknown>;
        if (e["status"] === "progress" && typeof e["file"] === "string" && typeof e["progress"] === "number") {
          progressFiles.set(e["file"], e["progress"]);
          let total = 0;
          for (const p of progressFiles.values()) total += p;
          const overall = total / progressFiles.size / 100;
          this.onProgress?.(Math.min(overall, 0.99));
        } else if (e["status"] === "ready") {
          this.onProgress?.(1);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.transcriber = await (pipeline as any)(
        "automatic-speech-recognition",
        "onnx-community/whisper-tiny.en",
        {
          device: "webgpu",
          progress_callback: progressHandler,
        },
      ) as AutomaticSpeechRecognitionPipeline;
      this.modelReady = true;
      this.onProgress?.(1);
    } catch (err) {
      this.onError?.(
        `Failed to load Whisper model: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.modelLoading = false;
    }
  }

  /** Start listening for speech */
  async start(): Promise<void> {
    if (this.running) return;

    // Ensure model is loaded
    if (!this.modelReady) {
      await this.loadModel();
      if (!this.modelReady) return;
    }

    this.running = true;

    try {
      // Get microphone stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: WHISPER_SAMPLE_RATE },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Set up AudioContext for capturing raw PCM
      this.audioContext = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Use ScriptProcessorNode for broad compatibility (AudioWorklet needs
      // a separate file which complicates the build for minimal gain here)
      const bufferSize = 4096;
      // eslint-disable-next-line deprecation/deprecation
      const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.running) return;
        const input = e.inputBuffer.getChannelData(0);
        this.appendAudio(input);
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Store reference for cleanup (reuse workletNode field)
      this.workletNode = processor as unknown as AudioWorkletNode;

      // Start periodic inference
      this.inferenceTimer = setInterval(() => {
        void this.runInference();
      }, INFERENCE_INTERVAL_MS);
    } catch (err) {
      this.running = false;
      this.onError?.(
        `Failed to start audio capture: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Stop listening */
  stop(): void {
    this.running = false;

    if (this.inferenceTimer !== null) {
      clearInterval(this.inferenceTimer);
      this.inferenceTimer = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffer = new Float32Array(0);
  }

  /** Whether recognition is actively running */
  get isRunning(): boolean {
    return this.running;
  }

  /** Update callbacks at runtime */
  setCallbacks(opts: {
    onTranscript?: TranscriptCallback;
    onMatch?: MatchCallback;
    onError?: ErrorCallback;
    onProgress?: ProgressCallback;
  }): void {
    if (opts.onTranscript !== undefined) this.onTranscript = opts.onTranscript;
    if (opts.onMatch !== undefined) this.onMatch = opts.onMatch;
    if (opts.onError !== undefined) this.onError = opts.onError;
    if (opts.onProgress !== undefined) this.onProgress = opts.onProgress;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private appendAudio(chunk: Float32Array): void {
    const maxSamples = WHISPER_SAMPLE_RATE * MAX_BUFFER_SECONDS;
    const merged = new Float32Array(this.audioBuffer.length + chunk.length);
    merged.set(this.audioBuffer);
    merged.set(chunk, this.audioBuffer.length);

    // Trim from the front if too long
    if (merged.length > maxSamples) {
      this.audioBuffer = merged.slice(merged.length - maxSamples);
    } else {
      this.audioBuffer = merged;
    }
  }

  private async runInference(): Promise<void> {
    if (!this.running || !this.transcriber || this.inferring) return;
    // Need at least 0.5s of audio
    if (this.audioBuffer.length < WHISPER_SAMPLE_RATE * 0.5) return;

    this.inferring = true;
    try {
      const audio = this.audioBuffer.slice();
      const result = await this.transcriber(audio);

      if (!this.running) return;

      const text = (result as { text: string }).text?.trim() ?? "";
      if (text) {
        this.onTranscript?.(text, true);

        if (this.targetPhrase) {
          this.checkMatch(text);
        }
      }
    } catch {
      // Inference errors are transient, don't surface unless persistent
    } finally {
      this.inferring = false;
    }
  }

  private checkMatch(spoken: string): void {
    const target = this.targetPhrase;
    if (!target) return;

    // Check the full spoken text
    const sim = similarity(spoken, target);
    if (sim >= this.matchThreshold) {
      this.onMatch?.(target, spoken, sim);
      return;
    }

    // Also check if the target appears as a substring of a longer utterance
    const normalSpoken = normalize(spoken);
    const normalTarget = normalize(target);
    if (
      normalSpoken.length > normalTarget.length &&
      normalSpoken.includes(normalTarget)
    ) {
      this.onMatch?.(target, spoken, 1.0);
      return;
    }

    // Sliding window: check substrings of spoken text matching target length
    const words = normalSpoken.split(" ");
    const targetWords = normalTarget.split(" ");
    if (words.length >= targetWords.length) {
      for (let i = 0; i <= words.length - targetWords.length; i++) {
        const window = words.slice(i, i + targetWords.length).join(" ");
        const windowSim = similarity(window, target);
        if (windowSim >= this.matchThreshold) {
          this.onMatch?.(target, spoken, windowSim);
          return;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience: request microphone permission
// ---------------------------------------------------------------------------

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately — we just needed to trigger the permission prompt
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch {
    return false;
  }
}
