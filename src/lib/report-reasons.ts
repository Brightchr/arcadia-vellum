/** Report taxonomy — client-safe (no DB imports); logic lives in reports.ts. */

export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam / bot activity" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
];

export function isReportReason(v: unknown): v is ReportReason {
  return REPORT_REASONS.some((r) => r.value === v);
}
