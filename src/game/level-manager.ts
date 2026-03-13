// Level progression manager with localStorage persistence

import type { LevelConfig, PlayerProgress } from "../levels/types";
import { levels, TOTAL_LEVELS, getLevel } from "../levels";

const STORAGE_KEY = "voice_game_progress";

const DEFAULT_PROGRESS: PlayerProgress = {
  unlockedLevel: 1,
  bestScores: {},
};

function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      unlockedLevel:
        typeof parsed.unlockedLevel === "number" && parsed.unlockedLevel >= 1
          ? Math.min(parsed.unlockedLevel, TOTAL_LEVELS)
          : 1,
      bestScores:
        parsed.bestScores && typeof parsed.bestScores === "object"
          ? parsed.bestScores
          : {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function saveProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — silently skip
  }
}

export class LevelManager {
  private progress: PlayerProgress;

  constructor() {
    this.progress = loadProgress();
  }

  /** All level configs in order. */
  get allLevels(): readonly LevelConfig[] {
    return levels;
  }

  /** Number of available levels. */
  get totalLevels(): number {
    return TOTAL_LEVELS;
  }

  /** Highest level the player has unlocked. */
  get unlockedLevel(): number {
    return this.progress.unlockedLevel;
  }

  /** Check whether a specific level is unlocked. */
  isUnlocked(levelId: number): boolean {
    return levelId >= 1 && levelId <= this.progress.unlockedLevel;
  }

  /** Get the config for a level, or undefined if invalid. */
  getLevel(levelId: number): LevelConfig | undefined {
    return getLevel(levelId);
  }

  /** Get the config for a level only if it's unlocked. */
  getUnlockedLevel(levelId: number): LevelConfig | undefined {
    if (!this.isUnlocked(levelId)) return undefined;
    return getLevel(levelId);
  }

  /** Get the best score for a level, or 0 if never played. */
  getBestScore(levelId: number): number {
    return this.progress.bestScores[levelId] ?? 0;
  }

  /**
   * Record a completed level attempt. Unlocks the next level if this is
   * the highest completed so far. Returns true if a new level was unlocked.
   */
  completeLevel(levelId: number, score: number): boolean {
    if (levelId < 1 || levelId > TOTAL_LEVELS) return false;

    // Update best score
    const prev = this.progress.bestScores[levelId] ?? 0;
    if (score > prev) {
      this.progress.bestScores[levelId] = score;
    }

    // Unlock next level if this was the frontier
    let newUnlock = false;
    if (
      levelId === this.progress.unlockedLevel &&
      levelId < TOTAL_LEVELS
    ) {
      this.progress.unlockedLevel = levelId + 1;
      newUnlock = true;
    }

    saveProgress(this.progress);
    return newUnlock;
  }

  /** Reset all progress (for testing or player choice). */
  resetProgress(): void {
    this.progress = { ...DEFAULT_PROGRESS };
    saveProgress(this.progress);
  }

  /** Get summary of levels with unlock/score status for UI rendering. */
  getLevelSummaries(): LevelSummary[] {
    return levels.map((level) => ({
      id: level.id,
      name: level.name,
      era: level.era,
      description: level.description,
      color: level.color,
      speedMultiplier: level.speedMultiplier,
      phraseCount: level.phrases.length,
      unlocked: this.isUnlocked(level.id),
      bestScore: this.getBestScore(level.id),
    }));
  }
}

export interface LevelSummary {
  id: number;
  name: string;
  era: string;
  description: string;
  color: string;
  speedMultiplier: number;
  phraseCount: number;
  unlocked: boolean;
  bestScore: number;
}
