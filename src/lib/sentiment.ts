/**
 * Steam-style review sentiment. Kept free of DB imports so client
 * components (work cards) can use it too.
 */

export type SentimentTone = "positive" | "mixed" | "negative";

export interface ReviewSummary {
  label: string;
  tone: SentimentTone;
}

/** Collapse star reviews into a Steam-style verdict, null when unreviewed. */
export function reviewSummary(
  avgRating: number | null,
  ratingCount: number
): ReviewSummary | null {
  if (avgRating === null || ratingCount === 0) return null;
  if (avgRating >= 4.5) {
    return ratingCount >= 10
      ? { label: "Overwhelmingly Positive", tone: "positive" }
      : { label: "Very Positive", tone: "positive" };
  }
  if (avgRating >= 4) return { label: "Positive", tone: "positive" };
  if (avgRating >= 3.5) return { label: "Mostly Positive", tone: "positive" };
  if (avgRating >= 2.5) return { label: "Mixed", tone: "mixed" };
  if (avgRating >= 1.8) return { label: "Mostly Negative", tone: "negative" };
  return { label: "Negative", tone: "negative" };
}
