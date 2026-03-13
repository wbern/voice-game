// Sound effects and audio feedback
// Uses Web Audio API with oscillator-based synthesis — no external audio files needed.
// Provides audio ducking to avoid interfering with voice recognition.

type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";

interface NoteStep {
  freq: number;
  type: OscillatorType;
  start: number;
  duration: number;
  gain: number;
}

let ctx: AudioContext | undefined;
let masterGain: GainNode | undefined;
let musicGain: GainNode | undefined;
let sfxGain: GainNode | undefined;
let musicOscillators: OscillatorNode[] = [];
let musicPlaying = false;
let ducked = false;

const DUCK_LEVEL = 0.1;
const NORMAL_LEVEL = 1.0;
const MUSIC_LEVEL = 0.15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_LEVEL;
    musicGain.connect(masterGain);
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

/** Play a sequence of oscillator notes through the SFX bus. */
function playSynth(steps: NoteStep[]): void {
  const c = ensureContext();
  if (!sfxGain) return;
  for (const s of steps) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = s.type;
    osc.frequency.value = s.freq;
    g.gain.setValueAtTime(0, c.currentTime + s.start);
    g.gain.linearRampToValueAtTime(s.gain, c.currentTime + s.start + 0.01);
    g.gain.linearRampToValueAtTime(0, c.currentTime + s.start + s.duration);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(c.currentTime + s.start);
    osc.stop(c.currentTime + s.start + s.duration + 0.05);
  }
}

/** Generate white-noise burst for whoosh / impact textures. */
function playNoise(
  startOffset: number,
  duration: number,
  gain: number,
): void {
  const c = ensureContext();
  if (!sfxGain) return;
  const bufferSize = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * gain;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  const env = c.createGain();
  env.gain.setValueAtTime(gain, c.currentTime + startOffset);
  env.gain.linearRampToValueAtTime(0, c.currentTime + startOffset + duration);

  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2000;

  src.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  src.start(c.currentTime + startOffset);
  src.stop(c.currentTime + startOffset + duration + 0.05);
}

// ---------------------------------------------------------------------------
// Public API — sound effects
// ---------------------------------------------------------------------------

/** Bright ascending chime — obstacle cleared / phrase matched. */
export function playObstacleCleared(): void {
  playSynth([
    { freq: 587, type: "sine", start: 0, duration: 0.1, gain: 0.35 },
    { freq: 784, type: "sine", start: 0.08, duration: 0.1, gain: 0.35 },
    { freq: 1047, type: "sine", start: 0.16, duration: 0.15, gain: 0.3 },
  ]);
}

/** Low buzz — obstacle missed / phrase failed. */
export function playObstacleMissed(): void {
  playSynth([
    { freq: 180, type: "sawtooth", start: 0, duration: 0.15, gain: 0.25 },
    { freq: 140, type: "sawtooth", start: 0.12, duration: 0.2, gain: 0.3 },
  ]);
}

/** Victory fanfare — level complete. */
export function playLevelComplete(): void {
  playSynth([
    { freq: 523, type: "triangle", start: 0, duration: 0.15, gain: 0.3 },
    { freq: 659, type: "triangle", start: 0.12, duration: 0.15, gain: 0.3 },
    { freq: 784, type: "triangle", start: 0.24, duration: 0.15, gain: 0.3 },
    { freq: 1047, type: "triangle", start: 0.36, duration: 0.3, gain: 0.35 },
  ]);
}

/** Descending fail tone — game over. */
export function playGameOver(): void {
  playSynth([
    { freq: 440, type: "square", start: 0, duration: 0.2, gain: 0.2 },
    { freq: 349, type: "square", start: 0.18, duration: 0.2, gain: 0.2 },
    { freq: 261, type: "square", start: 0.36, duration: 0.25, gain: 0.2 },
    { freq: 196, type: "sawtooth", start: 0.54, duration: 0.4, gain: 0.25 },
  ]);
}

/** Filtered noise whoosh — speed increase. */
export function playSpeedUp(): void {
  playSynth([
    { freq: 400, type: "sine", start: 0, duration: 0.05, gain: 0.15 },
    { freq: 800, type: "sine", start: 0.03, duration: 0.08, gain: 0.2 },
  ]);
  playNoise(0, 0.25, 0.2);
}

/** Quick positive blip — score tick. */
export function playScoreUp(): void {
  playSynth([
    { freq: 880, type: "sine", start: 0, duration: 0.06, gain: 0.2 },
    { freq: 1320, type: "sine", start: 0.04, duration: 0.06, gain: 0.15 },
  ]);
}

// ---------------------------------------------------------------------------
// Background music (simple oscillator loop)
// ---------------------------------------------------------------------------

/** Start a minimal ambient loop. Call once; toggle with stopMusic(). */
export function startMusic(): void {
  if (musicPlaying) return;
  const c = ensureContext();
  if (!musicGain) return;

  // Simple two-oscillator drone in C minor
  const bassFreqs = [130.81, 155.56, 116.54, 130.81]; // C3, Eb3, Bb2, C3
  const padFreqs = [261.63, 311.13, 233.08, 261.63]; // C4, Eb4, Bb3, C4

  function createDrone(freqs: number[], type: OscillatorType): OscillatorNode {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0]!, c.currentTime);
    // Slow chord progression cycling every 16 seconds
    for (let i = 1; i < freqs.length; i++) {
      osc.frequency.setValueAtTime(freqs[i]!, c.currentTime + i * 4);
    }
    // Loop by scheduling far ahead — the oscillators are stopped by stopMusic()
    osc.frequency.setValueAtTime(freqs[0]!, c.currentTime + 16);
    return osc;
  }

  const bass = createDrone(bassFreqs, "sine");
  const pad = createDrone(padFreqs, "triangle");

  const bassVol = c.createGain();
  bassVol.gain.value = 0.4;
  bass.connect(bassVol);
  bassVol.connect(musicGain);

  const padVol = c.createGain();
  padVol.gain.value = 0.2;
  pad.connect(padVol);
  padVol.connect(musicGain);

  bass.start();
  pad.start();

  musicOscillators = [bass, pad];
  musicPlaying = true;
}

/** Stop background music. */
export function stopMusic(): void {
  for (const osc of musicOscillators) {
    try {
      osc.stop();
    } catch {
      // Already stopped
    }
  }
  musicOscillators = [];
  musicPlaying = false;
}

/** Toggle background music on/off. Returns new state. */
export function toggleMusic(): boolean {
  if (musicPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
  return musicPlaying;
}

export function isMusicPlaying(): boolean {
  return musicPlaying;
}

// ---------------------------------------------------------------------------
// Audio ducking — reduce volume while voice recognition is listening
// ---------------------------------------------------------------------------

/** Duck audio (call when speech recognition starts listening). */
export function duckAudio(): void {
  if (ducked) return;
  ducked = true;
  if (!masterGain || !ctx) return;
  masterGain.gain.linearRampToValueAtTime(DUCK_LEVEL, ctx.currentTime + 0.1);
}

/** Restore audio (call when speech recognition stops listening). */
export function unduckAudio(): void {
  if (!ducked) return;
  ducked = false;
  if (!masterGain || !ctx) return;
  masterGain.gain.linearRampToValueAtTime(NORMAL_LEVEL, ctx.currentTime + 0.2);
}

export function isDucked(): boolean {
  return ducked;
}

// ---------------------------------------------------------------------------
// Recording — route audio to a MediaStream for screen capture
// ---------------------------------------------------------------------------

/** Create a MediaStreamDestination connected to the master gain for recording. */
export function createRecordingDestination(): MediaStreamAudioDestinationNode | null {
  const c = ensureContext();
  if (!masterGain) return null;
  const dest = c.createMediaStreamDestination();
  masterGain.connect(dest);
  return dest;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Unlock audio on mobile. Call this from a user-gesture handler (e.g. tap to
 * start). iOS/Safari require AudioContext creation or resume inside a user
 * interaction event.
 */
export function unlockAudio(): void {
  ensureContext();
}

/** Tear down AudioContext (e.g. when leaving the page). */
export function disposeAudio(): void {
  stopMusic();
  if (ctx) {
    void ctx.close();
    ctx = undefined;
    masterGain = undefined;
    musicGain = undefined;
    sfxGain = undefined;
  }
  ducked = false;
}
