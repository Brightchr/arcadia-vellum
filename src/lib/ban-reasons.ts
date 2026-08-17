/**
 * Built-in moderation reasons. The code is what's stored; the label is what
 * the banned party sees — at sign-in for account bans, on their own shelves
 * for work takedowns. Shared by account bans, IP bans, and work takedowns so
 * the admin UI offers one consistent list.
 */
export const BAN_REASONS = {
  spam: "Spam or deceptive behavior",
  harassment: "Harassment or abusive conduct toward other members",
  hate: "Hate speech or extremist content",
  illegal: "Illegal content or activity",
  copyright: "Copyright or rights-holder complaint",
  guidelines: "Content that violates the community guidelines",
  ban_evasion: "Evading a previous ban",
  other: "Violating the Vellum community rules",
} as const;

export type BanReasonCode = keyof typeof BAN_REASONS;

export function isBanReason(value: unknown): value is BanReasonCode {
  return typeof value === "string" && value in BAN_REASONS;
}

/** Falls back to the generic reason for unknown/legacy codes. */
export function banReasonLabel(code: string | null | undefined): string {
  return isBanReason(code) ? BAN_REASONS[code] : BAN_REASONS.other;
}
