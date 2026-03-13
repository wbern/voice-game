// Shared types for the level content system

export interface Phrase {
  text: string;
  meaning: string;
  difficulty: number;
  hint: string;
}

export interface LevelData {
  id: number;
  name: string;
  era: string;
  description: string;
  phrases: Phrase[];
}

/** Full level configuration including visual and gameplay settings. */
export interface LevelConfig {
  id: number;
  name: string;
  era: string;
  description: string;
  /** CSS hex color for the level theme */
  color: string;
  /** Multiplier applied to game speed (1.0 = baseline) */
  speedMultiplier: number;
  phrases: Phrase[];
}

/** Player progress persisted to localStorage. */
export interface PlayerProgress {
  /** Highest level unlocked (1-indexed) */
  unlockedLevel: number;
  /** Best score per level id */
  bestScores: Record<number, number>;
}
