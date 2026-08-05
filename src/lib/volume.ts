/**
 * Volume + part numbering ("Vol. 1.2" = volume 1, part/chapter 2).
 * Pure helpers — safe to import from client components.
 */

export interface VolumeRef {
  volumeNumber: number | null;
  partNumber: number | null;
  createdAt: Date;
}

/** "1", "1.2", or null when unnumbered. */
export function volumeLabel(v: {
  volumeNumber: number | null;
  partNumber: number | null;
}): string | null {
  if (v.volumeNumber === null) return null;
  return v.partNumber !== null
    ? `${v.volumeNumber}.${v.partNumber}`
    : `${v.volumeNumber}`;
}

/** Reading order: volume (unnumbered last), then part (whole volume first), then age. */
export function compareVolumes(a: VolumeRef, b: VolumeRef): number {
  const av = a.volumeNumber ?? Number.MAX_SAFE_INTEGER;
  const bv = b.volumeNumber ?? Number.MAX_SAFE_INTEGER;
  if (av !== bv) return av - bv;
  const ap = a.partNumber ?? 0;
  const bp = b.partNumber ?? 0;
  if (ap !== bp) return ap - bp;
  return a.createdAt.getTime() - b.createdAt.getTime();
}
