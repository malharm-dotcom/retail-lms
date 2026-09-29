import { describe, expect, it } from "vitest";
import { chunkCount, chunkRange, expectedChunkBytes, sniffVideoType, VIDEO_CHUNK_BYTES as C } from "./video";

describe("video storage", () => {
  it("recognises MP4/MOV and WebM headers only", () => {
    expect(sniffVideoType(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBe("video/mp4");
    expect(sniffVideoType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBe("video/webm");
    expect(sniffVideoType(new TextEncoder().encode("%PDF-1.7 hello"))).toBeNull();
  });

  it("splits files into fixed chunks with a short last one", () => {
    const size = 2 * C + 5;
    expect(chunkCount(size)).toBe(3);
    expect([0, 1, 2, 3].map((index) => expectedChunkBytes(size, index))).toEqual([C, C, 5, 0]);
  });

  it("serves a range from inside a single chunk", () => {
    const size = 2 * C + 5;
    expect(chunkRange("bytes=0-", size)).toEqual({ index: 0, start: 0, end: C - 1, offset: 0 });
    expect(chunkRange("bytes=10-20", size)).toEqual({ index: 0, start: 10, end: 20, offset: 10 });
    expect(chunkRange(`bytes=${C + 3}-`, size)).toEqual({ index: 1, start: C + 3, end: 2 * C - 1, offset: 3 });
    expect(chunkRange("bytes=-5", size)).toEqual({ index: 2, start: 2 * C, end: 2 * C + 4, offset: 0 });
    expect(chunkRange(`bytes=${size}-`, size)).toBeNull();
    expect(chunkRange("bytes=0-1,4-5", size)).toBeNull();
  });
});
