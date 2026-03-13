/** Level 3: Millennial slang phrases for voice recognition challenges. */

export interface Phrase {
  /** The phrase the player must speak. */
  text: string;
  /** Short hint or definition shown to the player. */
  hint: string;
}

export const level = 3;
export const theme = "Millennial Slang";

export const phrases: readonly Phrase[] = [
  { text: "YOLO", hint: "You only live once" },
  { text: "on fleek", hint: "Perfectly styled or done" },
  { text: "adulting", hint: "Doing responsible grown-up tasks" },
  { text: "basic", hint: "Unoriginal, following mainstream trends" },
  { text: "squad goals", hint: "An aspirational ideal for your friend group" },
  { text: "Netflix and chill", hint: "Hanging out, often a date euphemism" },
  { text: "throwing shade", hint: "Subtly disrespecting someone" },
  { text: "fam", hint: "Close friends, your chosen family" },
  { text: "bae", hint: "Term of endearment for a partner" },
  { text: "savage", hint: "Brutally honest or fearless" },
  { text: "FOMO", hint: "Fear of missing out" },
  { text: "I can't even", hint: "So overwhelmed you can't process it" },
  { text: "it's lit", hint: "The event or situation is exciting" },
  { text: "slay", hint: "To do something exceptionally well" },
  { text: "dead", hint: "Something is so funny you can't handle it" },
  { text: "TBH", hint: "To be honest" },
  { text: "goals", hint: "Something you aspire to have or be" },
  { text: "low-key", hint: "Keeping something quiet or understated" },
  { text: "hundo P", hint: "One hundred percent, absolutely" },
  { text: "turnt", hint: "Excited, hyped up, or intoxicated" },
  { text: "bruh", hint: "Expression of disbelief or exasperation" },
  { text: "snatched", hint: "Looking amazing, perfectly put together" },
  { text: "extra", hint: "Over the top, doing too much" },
  { text: "sipping tea", hint: "Quietly observing drama unfold" },
  { text: "bye Felicia", hint: "Dismissing someone you don't care about" },
  { text: "keep it one hundred", hint: "Be completely real and honest" },
  { text: "thirsty", hint: "Desperate for attention or approval" },
  { text: "woke", hint: "Socially aware and informed" },
  { text: "gucci", hint: "Good, cool, going well" },
  { text: "clap back", hint: "A sharp comeback to criticism" },
] as const;
