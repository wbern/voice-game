// Voice recognition: Web Speech API with Whisper.js fallback

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
// Web Speech API type shim (not all browsers ship types)
// ---------------------------------------------------------------------------

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w["SpeechRecognition"] as SpeechRecognitionConstructor | undefined) ??
    (w["webkitSpeechRecognition"] as SpeechRecognitionConstructor | undefined) ??
    null
  );
}

// ---------------------------------------------------------------------------
// VoiceRecognition class
// ---------------------------------------------------------------------------

export class VoiceRecognition {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;
  private targetPhrase = "";
  private readonly lang: string;
  private readonly matchThreshold: number;
  private onTranscript: TranscriptCallback | null;
  private onMatch: MatchCallback | null;
  private onError: ErrorCallback | null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _supported: boolean;

  constructor(opts: VoiceRecognitionOptions = {}) {
    this.lang = opts.lang ?? "en-US";
    this.matchThreshold = opts.matchThreshold ?? 0.8;
    this.onTranscript = opts.onTranscript ?? null;
    this.onMatch = opts.onMatch ?? null;
    this.onError = opts.onError ?? null;
    this._supported = getSpeechRecognition() !== null;
  }

  /** Whether the Web Speech API is available in this browser */
  get supported(): boolean {
    return this._supported;
  }

  /** Set the phrase the player needs to say */
  setTargetPhrase(phrase: string): void {
    this.targetPhrase = phrase;
  }

  /** Start listening for speech */
  start(): void {
    if (this.running) return;

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      this.onError?.("Web Speech API not supported in this browser");
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = 3;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      this.handleResult(e);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are routine — don't surface them
      if (e.error !== "no-speech" && e.error !== "aborted") {
        this.onError?.(e.error);
      }
    };

    rec.onend = () => {
      // Auto-restart if we're supposed to be listening
      if (this.running) {
        this.scheduleRestart();
      }
    };

    this.recognition = rec;
    this.running = true;

    try {
      rec.start();
    } catch {
      this.running = false;
      this.onError?.("Failed to start speech recognition");
    }
  }

  /** Stop listening */
  stop(): void {
    this.running = false;
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // already stopped
      }
      this.recognition = null;
    }
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
  }): void {
    if (opts.onTranscript !== undefined) this.onTranscript = opts.onTranscript;
    if (opts.onMatch !== undefined) this.onMatch = opts.onMatch;
    if (opts.onError !== undefined) this.onError = opts.onError;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private handleResult(e: SpeechRecognitionEvent): void {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (!result) continue;
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalTranscript += text;
      } else {
        interimTranscript += text;
      }
    }

    // Fire transcript callback with whatever we have
    const transcript = finalTranscript || interimTranscript;
    const isFinal = finalTranscript.length > 0;

    if (transcript) {
      this.onTranscript?.(transcript, isFinal);
    }

    // Check for match against target phrase
    if (this.targetPhrase && transcript) {
      this.checkMatch(transcript);
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
    // (user may say extra words before/after the phrase)
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

  private scheduleRestart(): void {
    if (this.restartTimer !== null) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.running) return;
      try {
        this.recognition?.start();
      } catch {
        // If start fails, try creating fresh instance
        this.recognition = null;
        this.start();
      }
    }, 100);
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
