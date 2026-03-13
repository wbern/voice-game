// Level system: generational themes with progression

import type { LevelConfig, Phrase } from "./types";
import { level1Phrases } from "./phrases";
import { phrases as genZPhrases } from "../data/gen-z-slang";
import { phrases as millennialPhrases } from "../data/millennial-slang";
import { level4 } from "./level4-genx";
import { level5 } from "./level5-boomer";
import { level6 } from "./level6-silent";

export type { Phrase, LevelConfig, PlayerProgress } from "./types";

/**
 * Adapt Level 1 (Gen Alpha) phrases from their local format
 * (text, phonetic, definition, tier) into the canonical Phrase shape.
 */
function adaptLevel1(): Phrase[] {
  return level1Phrases.map((p) => ({
    text: p.text,
    meaning: p.definition,
    difficulty: p.tier,
    hint: p.phonetic,
  }));
}

/**
 * Adapt Level 2/3 phrases from their local format (text, hint)
 * into the canonical Phrase shape. Difficulty is assigned by index position.
 */
function adaptSimplePhrases(
  source: readonly { text: string; hint: string }[],
): Phrase[] {
  const third = Math.ceil(source.length / 3);
  return source.map((p, i) => ({
    text: p.text,
    meaning: p.hint,
    difficulty: i < third ? 1 : i < third * 2 ? 2 : 3,
    hint: p.hint,
  }));
}

/** All 6 levels in sequential order, fully configured. */
export const levels: readonly LevelConfig[] = [
  {
    id: 1,
    name: "Gen Alpha",
    era: "2010s-present",
    description: "Skibidi rizz and brain rot energy",
    color: "#00e5ff",
    speedMultiplier: 1.0,
    phrases: adaptLevel1(),
  },
  {
    id: 2,
    name: "Gen Z",
    era: "Late 2000s-2010s",
    description: "Vibe checks and main character energy",
    color: "#8b5cf6",
    speedMultiplier: 1.15,
    phrases: adaptSimplePhrases(genZPhrases),
  },
  {
    id: 3,
    name: "Millennial",
    era: "1990s-2000s",
    description: "YOLO life and squad goals",
    color: "#ec4899",
    speedMultiplier: 1.3,
    phrases: adaptSimplePhrases(millennialPhrases),
  },
  {
    id: 4,
    name: level4.name,
    era: level4.era,
    description: level4.description,
    color: "#22c55e",
    speedMultiplier: 1.5,
    phrases: level4.phrases,
  },
  {
    id: 5,
    name: level5.name,
    era: level5.era,
    description: level5.description,
    color: "#f59e0b",
    speedMultiplier: 1.7,
    phrases: level5.phrases,
  },
  {
    id: 6,
    name: level6.name,
    era: level6.era,
    description: level6.description,
    color: "#94a3b8",
    speedMultiplier: 2.0,
    phrases: level6.phrases,
  },
];

/** Total number of levels in the game. */
export const TOTAL_LEVELS = levels.length;

/** Get a level by its 1-indexed id, or undefined if out of range. */
export function getLevel(id: number): LevelConfig | undefined {
  return levels.find((l) => l.id === id);
}
