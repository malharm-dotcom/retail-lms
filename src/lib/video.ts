// Shared by the upload form (browser) and the file routes (server). No server imports here.
export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/** MP4/MOV carry "ftyp" at byte 4; WebM starts with the EBML magic. Returns the type to serve, or null. */
export function sniffVideoType(head: Uint8Array): string | null {
  if (head.length >= 8 && String.fromCharCode(...head.subarray(4, 8)) === "ftyp") return "video/mp4";
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video/webm";
  return null;
}

export function chunkCount(sizeBytes: number) {
  return Math.ceil(sizeBytes / VIDEO_CHUNK_BYTES);
}

/** Byte length chunk `index` must have for a file of `sizeBytes`. */
export function expectedChunkBytes(sizeBytes: number, index: number) {
  return Math.max(0, Math.min(VIDEO_CHUNK_BYTES, sizeBytes - index * VIDEO_CHUNK_BYTES));
}

/**
 * Resolve an HTTP Range header to the part of ONE chunk to send back (a shorter 206 than asked
 * for is valid; the browser asks again from where it stopped). Null means unsatisfiable.
 */
export function chunkRange(header: string, sizeBytes: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end = sizeBytes - 1;
  if (match[1]) {
    start = Number(match[1]);
    if (match[2]) end = Math.min(Number(match[2]), end);
  } else {
    start = Math.max(0, sizeBytes - Number(match[2]));
  }
  if (start >= sizeBytes || end < start) return null;
  const index = Math.floor(start / VIDEO_CHUNK_BYTES);
  end = Math.min(end, (index + 1) * VIDEO_CHUNK_BYTES - 1);
  return { index, start, end, offset: start - index * VIDEO_CHUNK_BYTES };
}
