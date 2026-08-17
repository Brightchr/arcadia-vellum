/**
 * Content-type detection from magic bytes. Upload routes store the sniffed
 * type, never the client-declared one — a File's `type` (or its filename
 * extension) is attacker-chosen, and whatever we store is later served back
 * verbatim as the Content-Type of a public URL.
 */

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.length >= end ? buf.toString("latin1", start, end) : "";
}

/** Image mime from magic bytes, or null if it isn't a known image format. */
export function sniffImageType(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    ascii(buf, 1, 4) === "PNG" &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  const gif = ascii(buf, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * Audio mime from magic bytes, or null. Values match AUDIO_TYPES in
 * src/lib/audio.ts so stored rows look the same as extension-derived ones.
 */
export function sniffAudioType(buf: Buffer): string | null {
  if (ascii(buf, 0, 3) === "ID3") return "audio/mpeg";
  // Raw MPEG frame sync (mp3 without an ID3 tag).
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (ascii(buf, 4, 8) === "ftyp") return "audio/mp4";
  if (ascii(buf, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WAVE") {
    return "audio/wav";
  }
  return null;
}
