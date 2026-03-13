/** Level 2: Gen Z slang phrases for voice recognition challenges. */

export interface Phrase {
  /** The phrase the player must speak. */
  text: string;
  /** Short hint or definition shown to the player. */
  hint: string;
}

export const level = 2;
export const theme = "Gen Z Slang";

export const phrases: readonly Phrase[] = [
  { text: "vibe check", hint: "Assessing someone's mood or energy" },
  { text: "snatched", hint: "Looking really good, on point" },
  { text: "periodt", hint: "End of discussion, no debate" },
  { text: "yeet", hint: "To throw something with force" },
  { text: "CEO of", hint: "The best at something" },
  { text: "hits different", hint: "Feels uniquely good or special" },
  { text: "simp", hint: "Someone who does too much for a crush" },
  { text: "slaps", hint: "Something that is really good" },
  { text: "bet", hint: "Agreement, like saying okay or for sure" },
  { text: "stan", hint: "An enthusiastic superfan" },
  { text: "salty", hint: "Being bitter or upset" },
  { text: "spill the tea", hint: "Share the gossip" },
  { text: "on god", hint: "I swear, for real" },
  { text: "no cap", hint: "No lie, being completely honest" },
  { text: "it's giving", hint: "It has the vibe or energy of" },
  { text: "main character energy", hint: "Acting like the star of the show" },
  { text: "understood the assignment", hint: "Nailed it, did exactly right" },
  { text: "rent free", hint: "Living in your thoughts constantly" },
  { text: "bussin", hint: "Really good, especially food" },
  { text: "caught in 4K", hint: "Caught red-handed with clear proof" },
  { text: "sending me", hint: "Making me laugh uncontrollably" },
  { text: "ate and left no crumbs", hint: "Absolutely killed it, flawless" },
  { text: "big yikes", hint: "That is really embarrassing" },
  { text: "sus", hint: "Suspicious or shady" },
  { text: "lowkey", hint: "Secretly or somewhat" },
  { text: "highkey", hint: "Obviously or very much" },
  { text: "iykyk", hint: "If you know you know" },
  { text: "living for this", hint: "Absolutely loving it" },
  { text: "say less", hint: "I understand, no need to explain" },
  { text: "that ain't it", hint: "That's not good, disapproval" },
] as const;
