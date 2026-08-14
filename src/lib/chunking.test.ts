import { describe, expect, it } from "vitest";

import { chunkText, normalizeText, CHUNK_SIZE } from "./chunking";
import { buildContext, usedCitationIndexes, type RetrievedChunk } from "./rag.server";

describe("normalizeText", () => {
  it("normalises line endings and collapses blank runs", () => {
    expect(normalizeText("a\r\n\r\n\r\n\r\nb")).toBe("a\n\nb");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeText("   hello   ")).toBe("hello");
  });
});

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("keeps short documents as a single chunk", () => {
    const chunks = chunkText("A short runbook entry about restarting the queue worker.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
  });

  it("splits long documents into sequential, bounded chunks", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Paragraph ${i} about deploys.`).join("\n\n");
    const chunks = chunkText(text, 300, 50);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.charCount).toBe(c.content.length);
      expect(c.charCount).toBeLessThanOrEqual(300);
    });
  });

  it("overlaps consecutive chunks so context is not lost at boundaries", () => {
    const text = "x".repeat(2000);
    const chunks = chunkText(text, 500, 100);
    const total = chunks.reduce((n, c) => n + c.charCount, 0);
    expect(total).toBeGreaterThan(2000);
  });

  it("preserves the full document content across chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Line ${i} of the spec.`).join("\n");
    const chunks = chunkText(text, 200, 40);
    expect(chunks.map((c) => c.content).join(" ")).toContain("Line 39 of the spec.");
    expect(chunks[0]!.content).toContain("Line 0 of the spec.");
  });

  it("rejects an overlap larger than the chunk size", () => {
    expect(() => chunkText("some text here for testing", 100, 100)).toThrow();
  });

  it("uses a sane default chunk size", () => {
    expect(CHUNK_SIZE).toBeGreaterThan(200);
  });
});

const chunk = (id: string, title: string, content: string): RetrievedChunk => ({
  id,
  document_id: "doc-1",
  chunk_index: 0,
  content,
  similarity: 0.9,
  document_title: title,
  document_filename: `${title}.md`,
});

describe("buildContext", () => {
  it("numbers snippets from 1 and labels their source", () => {
    const ctx = buildContext([
      chunk("a", "Runbook", "restart the worker"),
      chunk("b", "RFC", "use retries"),
    ]);
    expect(ctx).toContain("[1] source: Runbook");
    expect(ctx).toContain("[2] source: RFC");
    expect(ctx).toContain("restart the worker");
  });
});

describe("usedCitationIndexes", () => {
  it("extracts only in-range markers, de-duplicated and sorted", () => {
    expect(usedCitationIndexes("See [2] and [1], again [2]. Ignore [9].", 3)).toEqual([1, 2]);
  });

  it("returns nothing when no markers are present", () => {
    expect(usedCitationIndexes("No citations here.", 5)).toEqual([]);
  });
});
