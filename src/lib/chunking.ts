/**
 * Deterministic, dependency-free text chunker used by the ingestion pipeline.
 * Pure module so it can be unit-tested without a server/runtime.
 */

export interface Chunk {
  index: number;
  content: string;
  charCount: number;
}

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 180;

export function normalizeText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, "\n")
      // eslint-disable-next-line no-control-regex
      .replace(/\u0000/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Splits text into overlapping chunks, preferring paragraph and sentence
 * boundaries so retrieved evidence stays human-readable.
 */
export function chunkText(
  raw: string,
  size: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP,
): Chunk[] {
  const text = normalizeText(raw);
  if (!text) return [];
  if (overlap >= size) throw new Error("overlap must be smaller than size");

  const chunks: Chunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let end = Math.min(cursor + size, text.length);

    if (end < text.length) {
      const window = text.slice(cursor, end);
      const minBreak = Math.floor(size * 0.5);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
      );
      if (breakAt > minBreak) end = cursor + breakAt + 1;
    }

    const content = text.slice(cursor, end).trim();
    if (content) {
      chunks.push({ index: chunks.length, content, charCount: content.length });
    }

    if (end >= text.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}
