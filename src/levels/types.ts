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
