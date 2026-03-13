// Core game logic: scoring, lives, game loop
export { LevelManager } from "./level-manager";
export type { LevelSummary } from "./level-manager";

import { level1Phrases } from "../levels/phrases";
import type { Phrase as L1Phrase } from "../levels/phrases";
import {
  phrases as level2Phrases,
} from "../data/gen-z-slang";
import {
  phrases as level3Phrases,
} from "../data/millennial-slang";
import { level4 } from "../levels/level4-genx";
import { level5 } from "../levels/level5-boomer";

// ── Unified phrase type ──────────────────────────────────────────────

export interface GamePhrase {
  text: string;
  hint: string;
}

// ── Level registry ───────────────────────────────────────────────────

export interface LevelInfo {
  id: number;
  name: string;
  phrases: GamePhrase[];
}

function normalizeLevel1(): GamePhrase[] {
  return level1Phrases.map((p: L1Phrase) => ({
    text: p.text,
    hint: p.definition,
  }));
}

function normalizeLevel2(): GamePhrase[] {
  return level2Phrases.map((p) => ({ text: p.text, hint: p.hint }));
}

function normalizeLevel3(): GamePhrase[] {
  return level3Phrases.map((p) => ({ text: p.text, hint: p.hint }));
}

function normalizeLevel4(): GamePhrase[] {
  return level4.phrases.map((p) => ({ text: p.text, hint: p.hint }));
}

function normalizeLevel5(): GamePhrase[] {
  return level5.phrases.map((p) => ({ text: p.text, hint: p.hint }));
}

export const LEVELS: LevelInfo[] = [
  { id: 1, name: "Gen Alpha", phrases: normalizeLevel1() },
  { id: 2, name: "Gen Z", phrases: normalizeLevel2() },
  { id: 3, name: "Millennial", phrases: normalizeLevel3() },
  { id: 4, name: "Gen X", phrases: normalizeLevel4() },
  { id: 5, name: "Boomer", phrases: normalizeLevel5() },
];

// ── Game states ──────────────────────────────────────────────────────

export type GameState = "MENU" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "GAME_OVER";

// ── Configuration ────────────────────────────────────────────────────

export interface GameConfig {
  initialLives: number;
  phrasesPerLevel: number;
  basePoints: number;
  comboMultiplier: number;
  countdownSeconds: number;
  /** Time allowed per phrase (ms). Decreases as speed increases. */
  basePhraseTimeMs: number;
  /** Speed increase per cleared phrase (percentage points). */
  speedIncrement: number;
}

const DEFAULT_CONFIG: GameConfig = {
  initialLives: 3,
  phrasesPerLevel: 8,
  basePoints: 100,
  comboMultiplier: 0.5,
  countdownSeconds: 3,
  basePhraseTimeMs: 8000,
  speedIncrement: 0.05,
};

// ── Game store ────────────────────────────────────────────────────────

export interface GameStore {
  state: GameState;
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  currentLevel: number;
  phrasesCleared: number;
  currentPhrase: GamePhrase | null;
  currentPhraseIndex: number;
  highScore: number;
  speed: number;
  countdown: number;
  phraseTimeRemaining: number;
  phraseTimeTotal: number;
  levelPhrases: GamePhrase[];
}

// ── Event system ─────────────────────────────────────────────────────

export type GameEvent =
  | "stateChange"
  | "scoreChange"
  | "livesChange"
  | "comboChange"
  | "phraseChange"
  | "levelChange"
  | "countdownTick"
  | "phraseTimeTick"
  | "highScoreChange"
  | "phraseHit"
  | "phraseMiss";

type Listener = (store: Readonly<GameStore>) => void;

// ── High score persistence ───────────────────────────────────────────

const HIGH_SCORE_KEY = "voiceGame_highScore";

function loadHighScore(): number {
  try {
    const val = localStorage.getItem(HIGH_SCORE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // localStorage unavailable
  }
}

// ── Shuffle helper ───────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

// ── Game engine ──────────────────────────────────────────────────────

export class GameEngine {
  readonly config: GameConfig;
  private store: GameStore;
  private listeners = new Map<GameEvent, Set<Listener>>();
  private loopId: number | null = null;
  private lastTimestamp = 0;
  private countdownTimer = 0;

  constructor(config: Partial<GameConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = this.createInitialStore();
  }

  private createInitialStore(): GameStore {
    return {
      state: "MENU",
      score: 0,
      lives: this.config.initialLives,
      combo: 0,
      maxCombo: 0,
      currentLevel: 1,
      phrasesCleared: 0,
      currentPhrase: null,
      currentPhraseIndex: -1,
      highScore: loadHighScore(),
      speed: 1.0,
      countdown: this.config.countdownSeconds,
      phraseTimeRemaining: 0,
      phraseTimeTotal: 0,
      levelPhrases: [],
    };
  }

  // ── Public API ───────────────────────────────────────────────────

  getState(): Readonly<GameStore> {
    return this.store;
  }

  on(event: GameEvent, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  /** Start a new game from level 1 (or specified level). */
  startGame(level = 1): void {
    this.store = this.createInitialStore();
    this.store.currentLevel = level;
    this.emit("scoreChange");
    this.emit("livesChange");
    this.emit("comboChange");
    this.emit("highScoreChange");
    this.transitionTo("COUNTDOWN");
  }

  /** Pause during PLAYING state. */
  pause(): void {
    if (this.store.state === "PLAYING") {
      this.transitionTo("PAUSED");
    }
  }

  /** Resume from PAUSED state. */
  resume(): void {
    if (this.store.state === "PAUSED") {
      this.transitionTo("PLAYING");
    }
  }

  /** Toggle pause/resume. */
  togglePause(): void {
    if (this.store.state === "PLAYING") this.pause();
    else if (this.store.state === "PAUSED") this.resume();
  }

  /** Player successfully spoke the current phrase. */
  phraseHit(): void {
    if (this.store.state !== "PLAYING" || !this.store.currentPhrase) return;

    // Increase combo
    this.store.combo++;
    if (this.store.combo > this.store.maxCombo) {
      this.store.maxCombo = this.store.combo;
    }
    this.emit("comboChange");

    // Calculate score: base + combo bonus + time bonus
    const comboBonus = Math.floor(
      this.config.basePoints * this.config.comboMultiplier * (this.store.combo - 1)
    );
    const timeRatio = this.store.phraseTimeTotal > 0
      ? this.store.phraseTimeRemaining / this.store.phraseTimeTotal
      : 0;
    const timeBonus = Math.floor(this.config.basePoints * 0.5 * timeRatio);
    const points = this.config.basePoints + comboBonus + timeBonus;

    this.store.score += points;
    this.emit("scoreChange");
    this.emit("phraseHit");

    // Update high score
    if (this.store.score > this.store.highScore) {
      this.store.highScore = this.store.score;
      saveHighScore(this.store.highScore);
      this.emit("highScoreChange");
    }

    // Progress
    this.store.phrasesCleared++;

    // Increase speed
    this.store.speed += this.config.speedIncrement;

    // Check level completion
    if (this.store.phrasesCleared >= this.config.phrasesPerLevel) {
      this.advanceLevel();
    } else {
      this.nextPhrase();
    }
  }

  /** Player missed / time ran out on the current phrase. */
  phraseMiss(): void {
    if (this.store.state !== "PLAYING") return;

    // Reset combo
    this.store.combo = 0;
    this.emit("comboChange");

    // Lose a life
    this.store.lives--;
    this.emit("livesChange");
    this.emit("phraseMiss");

    if (this.store.lives <= 0) {
      this.transitionTo("GAME_OVER");
    } else {
      this.nextPhrase();
    }
  }

  /** Return to menu. */
  returnToMenu(): void {
    this.stopLoop();
    this.store = this.createInitialStore();
    this.emit("stateChange");
    this.emit("scoreChange");
    this.emit("livesChange");
    this.emit("comboChange");
  }

  /** Destroy the engine. */
  destroy(): void {
    this.stopLoop();
    this.listeners.clear();
  }

  // ── Internal ─────────────────────────────────────────────────────

  private transitionTo(newState: GameState): void {
    const prev = this.store.state;
    this.store.state = newState;
    this.emit("stateChange");

    if (newState === "COUNTDOWN") {
      this.store.countdown = this.config.countdownSeconds;
      this.emit("countdownTick");
      this.startCountdown();
    } else if (newState === "PLAYING" && prev !== "PAUSED") {
      this.prepareLevelPhrases();
      this.nextPhrase();
      this.startLoop();
    } else if (newState === "PLAYING" && prev === "PAUSED") {
      this.startLoop();
    } else if (newState === "PAUSED" || newState === "GAME_OVER" || newState === "MENU") {
      this.stopLoop();
    }
  }

  private prepareLevelPhrases(): void {
    const levelIndex = Math.min(this.store.currentLevel - 1, LEVELS.length - 1);
    const level = LEVELS[levelIndex]!;
    this.store.levelPhrases = shuffle(level.phrases).slice(0, this.config.phrasesPerLevel);
    this.store.currentPhraseIndex = -1;
    this.store.phrasesCleared = 0;
    this.emit("levelChange");
  }

  private nextPhrase(): void {
    this.store.currentPhraseIndex++;
    if (this.store.currentPhraseIndex >= this.store.levelPhrases.length) {
      // Ran out of prepared phrases, reshuffle
      const levelIndex = Math.min(this.store.currentLevel - 1, LEVELS.length - 1);
      const level = LEVELS[levelIndex]!;
      this.store.levelPhrases = shuffle(level.phrases);
      this.store.currentPhraseIndex = 0;
    }
    this.store.currentPhrase = this.store.levelPhrases[this.store.currentPhraseIndex] ?? null;
    const totalTime = Math.max(3000, this.config.basePhraseTimeMs / this.store.speed);
    this.store.phraseTimeTotal = totalTime;
    this.store.phraseTimeRemaining = totalTime;
    this.emit("phraseChange");
  }

  private advanceLevel(): void {
    if (this.store.currentLevel >= LEVELS.length) {
      // Beat all levels — game over with victory
      this.transitionTo("GAME_OVER");
      return;
    }
    this.store.currentLevel++;
    this.store.speed = 1.0 + (this.store.currentLevel - 1) * 0.1;
    this.prepareLevelPhrases();
    this.nextPhrase();
    this.emit("levelChange");
  }

  // ── Countdown ────────────────────────────────────────────────────

  private startCountdown(): void {
    this.countdownTimer = window.setInterval(() => {
      this.store.countdown--;
      this.emit("countdownTick");
      if (this.store.countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.transitionTo("PLAYING");
      }
    }, 1000);
  }

  // ── Game loop ────────────────────────────────────────────────────

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const dt = now - this.lastTimestamp;
      this.lastTimestamp = now;
      this.update(dt);
      this.loopId = requestAnimationFrame(tick);
    };
    this.loopId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.loopId !== null) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }

  private update(dt: number): void {
    if (this.store.state !== "PLAYING") return;

    // Tick phrase timer
    this.store.phraseTimeRemaining -= dt;
    this.emit("phraseTimeTick");

    if (this.store.phraseTimeRemaining <= 0) {
      this.store.phraseTimeRemaining = 0;
      this.phraseMiss();
    }
  }

  // ── Events ───────────────────────────────────────────────────────

  private emit(event: GameEvent): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        fn(this.store);
      }
    }
  }
}
