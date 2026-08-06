/**
 * Content safety for user-supplied text (usernames, bios, tags, reviews).
 * Normalizes leetspeak/symbol substitutions and checks two lists:
 *  - SEVERE: slurs and sexual-violence terms — rejected anywhere in the text
 *  - PROFANE: common profanity — rejected as standalone words
 * Deliberately conservative; false negatives can be handled by future report
 * flows, false positives by keeping the severe list to unambiguous strings.
 */

const SUBSTITUTIONS: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
  "+": "t",
};

/** Lowercase, fold substitutions, drop separators so "f_u.c-k" reads plainly. */
export function normalizeForSafety(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => SUBSTITUTIONS[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[^a-z]/g, "");
}

// Severe: never acceptable in any position.
const SEVERE = [
  "nigger",
  "nigga",
  "faggot",
  "kike",
  "spic",
  "chink",
  "wetback",
  "tranny",
  "raghead",
  "beaner",
  "rapeher",
  "rapehim",
  "childporn",
  "loli",
  "pedo",
  "molest",
];

// Profane: rejected as words (normalized text is letters-only, so check as
// substrings of the collapsed string bounded by the original word splits).
const PROFANE = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "bastard",
  "twat",
  "wank",
  "jizz",
  "cum",
  "porn",
  "sex",
  "nazi",
  "hitler",
  "rape",
  "rapist",
];

/** True when the text is clean enough to store. */
export function isTextSafe(text: string): boolean {
  const collapsed = normalizeForSafety(text);
  if (SEVERE.some((w) => collapsed.includes(w))) return false;

  // Word-level pass: split on whitespace only, then normalize each token so
  // in-word obfuscation ("f_u.c-k", "sh!t") collapses back to the plain word.
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeForSafety)
    .filter(Boolean);
  return !words.some((w) => PROFANE.includes(w));
}

/** Shared message so every surface explains rejections the same way. */
export const UNSAFE_TEXT_ERROR =
  "That text isn't allowed — keep names, tags, and reviews free of profanity and unsafe content.";
