/** A phrase the player must speak aloud to score points. */
export interface Phrase {
  /** The phrase text displayed on screen */
  text: string;
  /** Simplified phonetic hint (displayed below the phrase) */
  phonetic: string;
  /** Plain-English definition shown after the round */
  definition: string;
  /** Difficulty tier within the level (1 = easiest, 3 = hardest) */
  tier: 1 | 2 | 3;
}

/**
 * Level 1 — Gen Alpha slang.
 *
 * 24 phrases organised in three difficulty tiers so the game can
 * ramp up within a single level.
 */
export const level1Phrases: readonly Phrase[] = [
  // ── Tier 1: short, single-word phrases ────────────────────────
  {
    text: "Rizz",
    phonetic: "riz",
    definition: "Charisma or charm, especially when flirting",
    tier: 1,
  },
  {
    text: "Sus",
    phonetic: "suss",
    definition: "Suspicious or shady",
    tier: 1,
  },
  {
    text: "Sigma",
    phonetic: "SIG-muh",
    definition: "An independent, self-reliant person",
    tier: 1,
  },
  {
    text: "Mid",
    phonetic: "mid",
    definition: "Average, mediocre, nothing special",
    tier: 1,
  },
  {
    text: "Slay",
    phonetic: "slay",
    definition: "To do something exceptionally well",
    tier: 1,
  },
  {
    text: "Based",
    phonetic: "bayst",
    definition: "Unapologetically true to oneself",
    tier: 1,
  },
  {
    text: "Bussin",
    phonetic: "BUSS-in",
    definition: "Really good, especially food",
    tier: 1,
  },
  {
    text: "Bet",
    phonetic: "bet",
    definition: "Agreement — 'okay, sure, sounds good'",
    tier: 1,
  },

  // ── Tier 2: two-word / slightly longer phrases ────────────────
  {
    text: "No cap",
    phonetic: "no kap",
    definition: "No lie, for real",
    tier: 2,
  },
  {
    text: "Gyatt",
    phonetic: "gee-YAT",
    definition: "Exclamation of surprise or admiration",
    tier: 2,
  },
  {
    text: "Skibidi",
    phonetic: "ski-BID-ee",
    definition: "Nonsense hype word from the Skibidi Toilet meme",
    tier: 2,
  },
  {
    text: "Delulu",
    phonetic: "deh-LOO-loo",
    definition: "Delusional, living in a fantasy",
    tier: 2,
  },
  {
    text: "Fanum tax",
    phonetic: "FAN-um taks",
    definition: "Taking a bite of someone else's food",
    tier: 2,
  },
  {
    text: "Its giving",
    phonetic: "its GIV-ing",
    definition: "It has the vibe or energy of something",
    tier: 2,
  },
  {
    text: "Mewing",
    phonetic: "MYOO-ing",
    definition: "Pressing your tongue to the roof of your mouth for a jawline",
    tier: 2,
  },
  {
    text: "Ick factor",
    phonetic: "ik FAK-ter",
    definition: "A sudden turn-off or cringe moment",
    tier: 2,
  },

  // ── Tier 3: full expressions ──────────────────────────────────
  {
    text: "Main character energy",
    phonetic: "mayn KAR-ik-ter EN-er-jee",
    definition: "Acting like the protagonist of your own story",
    tier: 3,
  },
  {
    text: "Caught in 4K",
    phonetic: "kawt in for-KAY",
    definition: "Caught red-handed with undeniable proof",
    tier: 3,
  },
  {
    text: "Living rent free",
    phonetic: "LIV-ing rent free",
    definition: "Something you can't stop thinking about",
    tier: 3,
  },
  {
    text: "Understood the assignment",
    phonetic: "un-der-STOOD the uh-SINE-ment",
    definition: "Nailed it, did exactly what was needed",
    tier: 3,
  },
  {
    text: "That ain't it chief",
    phonetic: "that aynt it cheef",
    definition: "That's a bad take or wrong move",
    tier: 3,
  },
  {
    text: "Rent free in my head",
    phonetic: "rent free in my hed",
    definition: "Occupying your thoughts without permission",
    tier: 3,
  },
  {
    text: "On God no cap",
    phonetic: "on god no kap",
    definition: "I swear I'm telling the truth",
    tier: 3,
  },
  {
    text: "Vibe check failed",
    phonetic: "vyb chek fayld",
    definition: "The energy is off, something feels wrong",
    tier: 3,
  },
] as const;
