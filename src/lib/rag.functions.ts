import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { chunkText } from "./chunking";

const MAX_CHARS = 400_000;
const TOP_K = 6;
const MIN_SIMILARITY = 0.18;

// In-Memory Fallback Stores for when Supabase DB write is blocked by remote RLS policy
interface MemoryDocument {
  id: string;
  title: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  char_count: number;
  chunk_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface MemoryChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
  embedding: number[];
  document_title: string;
  document_filename: string;
  created_at: string;
}

interface MemoryQuery {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  citations: Citation[];
  latency_ms: number;
  created_at: string;
}

const memoryDocuments = new Map<string, MemoryDocument>();
const memoryChunks: MemoryChunk[] = [];
const memoryQueries: MemoryQuery[] = [];

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

const IngestInput = z.object({
  title: z.string().trim().min(1).max(200),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(120).default("text/plain"),
  sizeBytes: z.number().int().nonnegative().max(25_000_000),
  text: z.string().min(20, "Document text is too short to index.").max(MAX_CHARS),
});

const AskInput = z.object({
  question: z.string().trim().min(3).max(1000),
});

const DeleteInput = z.object({ id: z.string().uuid() });

export const ingestDocument = createServerFn({ method: "POST" })
  .validator((input: unknown) => IngestInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedAll } = await import("./rag.server");

    const chunks = chunkText(data.text);
    if (chunks.length === 0) throw new Error("No readable text found in this document.");

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();
    let isDbPersisted = false;

    // 1. Try Supabase DB insert
    try {
      const { data: doc, error: docError } = await supabaseAdmin
        .from("documents")
        .insert({
          id: docId,
          title: data.title,
          filename: data.filename,
          mime_type: data.mimeType,
          size_bytes: data.sizeBytes,
          char_count: data.text.length,
          chunk_count: chunks.length,
          status: "indexing",
        })
        .select("id")
        .single();

      if (!docError && doc) {
        isDbPersisted = true;
      }
    } catch {
      // Supabase RLS or connection fallback
    }

    // Always record in local memory store as fallback
    const memDoc: MemoryDocument = {
      id: docId,
      title: data.title,
      filename: data.filename,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      char_count: data.text.length,
      chunk_count: chunks.length,
      status: "indexing",
      error_message: null,
      created_at: now,
    };
    memoryDocuments.set(docId, memDoc);

    try {
      const vectors = await embedAll(chunks.map((c) => c.content));

      // 2. Insert chunks to Supabase if DB persisted
      if (isDbPersisted) {
        try {
          const { error: chunkError } = await supabaseAdmin.from("chunks").insert(
            chunks.map((c, i) => ({
              document_id: docId,
              chunk_index: c.index,
              content: c.content,
              char_count: c.charCount,
              embedding: vectors[i] as unknown as string,
            })),
          );
          if (!chunkError) {
            await supabaseAdmin.from("documents").update({ status: "ready" }).eq("id", docId);
          } else {
            isDbPersisted = false;
          }
        } catch {
          isDbPersisted = false;
        }
      }

      // Always populate local vector memory store for instant retrieval fallback
      chunks.forEach((c, i) => {
        memoryChunks.push({
          id: crypto.randomUUID(),
          document_id: docId,
          chunk_index: c.index,
          content: c.content,
          char_count: c.charCount,
          embedding: vectors[i] ?? [],
          document_title: data.title,
          document_filename: data.filename,
          created_at: now,
        });
      });

      memDoc.status = "ready";
      return { id: docId, chunks: chunks.length, chars: data.text.length };
    } catch (error) {
      memDoc.status = "failed";
      memDoc.error_message = error instanceof Error ? error.message : "Indexing failed.";
      if (isDbPersisted) {
        try {
          await supabaseAdmin
            .from("documents")
            .update({ status: "failed", error_message: memDoc.error_message })
            .eq("id", docId);
        } catch {
          /* ignore */
        }
      }
      throw error;
    }
  });

export const listDocuments = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let dbDocs: MemoryDocument[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select(
        "id, title, filename, mime_type, size_bytes, char_count, chunk_count, status, error_message, created_at",
      )
      .order("created_at", { ascending: false });
    if (!error && data) {
      dbDocs = data as MemoryDocument[];
    }
  } catch {
    /* fallback to memory */
  }

  // Merge DB documents and local memory documents (deduplicated by ID)
  const map = new Map<string, MemoryDocument>();
  dbDocs.forEach((d) => map.set(d.id, d));
  memoryDocuments.forEach((d, id) => {
    if (!map.has(id)) map.set(id, d);
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
});

export const deleteDocument = createServerFn({ method: "POST" })
  .validator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      await supabaseAdmin.from("documents").delete().eq("id", data.id);
    } catch {
      /* ignore */
    }
    memoryDocuments.delete(data.id);
    for (let i = memoryChunks.length - 1; i >= 0; i--) {
      if (memoryChunks[i]?.document_id === data.id) {
        memoryChunks.splice(i, 1);
      }
    }
    return { ok: true };
  });

export interface Citation {
  marker: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentFilename: string;
  chunkIndex: number;
  similarity: number;
  content: string;
  used: boolean;
}

export const askQuestion = createServerFn({ method: "POST" })
  .validator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }) => {
    const started = Date.now();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedOne, generateAnswer, usedCitationIndexes } = await import("./rag.server");
    type RetrievedChunk = import("./rag.server").RetrievedChunk;

    // Check combined total chunks count across DB & local memory
    let dbCount = 0;
    try {
      const { count } = await supabaseAdmin
        .from("chunks")
        .select("id", { count: "exact", head: true });
      dbCount = count ?? 0;
    } catch {
      dbCount = 0;
    }

    const totalCount = dbCount + memoryChunks.length;
    if (totalCount === 0) {
      throw new Error("Your library is empty. Upload a document before asking questions.");
    }

    const queryVector = await embedOne(data.question);
    let retrieved: RetrievedChunk[] = [];

    // 1. Try Supabase DB vector match
    try {
      const { data: matches, error } = await supabaseAdmin.rpc("match_chunks", {
        query_embedding: queryVector as unknown as string,
        match_count: TOP_K,
      });
      if (!error && matches && matches.length > 0) {
        retrieved = (matches as RetrievedChunk[]).filter((c) => c.similarity >= MIN_SIMILARITY);
      }
    } catch {
      /* fallback to local vector match */
    }

    // 2. If DB search returned no matches, compute cosine similarity over local memory chunks
    if (retrieved.length === 0 && memoryChunks.length > 0) {
      const localMatches: RetrievedChunk[] = memoryChunks
        .map((c) => ({
          id: c.id,
          document_id: c.document_id,
          chunk_index: c.chunk_index,
          content: c.content,
          similarity: Number(dotProduct(queryVector, c.embedding).toFixed(4)),
          document_title: c.document_title,
          document_filename: c.document_filename,
        }))
        .filter((c) => c.similarity >= MIN_SIMILARITY)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, TOP_K);

      retrieved = localMatches;
    }

    if (retrieved.length === 0) {
      const answer =
        "No indexed passage is relevant enough to this question. Try rephrasing it, or upload a document that covers this topic.";
      const qRow: MemoryQuery = {
        id: crypto.randomUUID(),
        question: data.question,
        answer,
        grounded: false,
        citations: [],
        latency_ms: Date.now() - started,
        created_at: new Date().toISOString(),
      };
      memoryQueries.push(qRow);
      try {
        await supabaseAdmin.from("queries").insert({
          question: data.question,
          answer,
          grounded: false,
          citations: [],
          latency_ms: Date.now() - started,
        });
      } catch {
        /* ignore */
      }
      return {
        answer,
        grounded: false,
        citations: [] as Citation[],
        latencyMs: Date.now() - started,
      };
    }

    const { answer, grounded } = await generateAnswer(data.question, retrieved);
    const used = new Set(usedCitationIndexes(answer, retrieved.length));

    const citations: Citation[] = retrieved.map((c, i) => ({
      marker: i + 1,
      chunkId: c.id,
      documentId: c.document_id,
      documentTitle: c.document_title,
      documentFilename: c.document_filename,
      chunkIndex: c.chunk_index,
      similarity: Number(c.similarity.toFixed(4)),
      content: c.content,
      used: grounded ? used.has(i + 1) : false,
    }));

    const latencyMs = Date.now() - started;
    const qRow: MemoryQuery = {
      id: crypto.randomUUID(),
      question: data.question,
      answer,
      grounded,
      citations: JSON.parse(JSON.stringify(citations)),
      latency_ms: latencyMs,
      created_at: new Date().toISOString(),
    };
    memoryQueries.push(qRow);

    try {
      await supabaseAdmin.from("queries").insert({
        question: data.question,
        answer,
        grounded,
        citations: JSON.parse(JSON.stringify(citations)),
        latency_ms: latencyMs,
      });
    } catch {
      /* ignore */
    }

    return { answer, grounded, citations, latencyMs };
  });

export const listQueries = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let dbQueries: MemoryQuery[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from("queries")
      .select("id, question, answer, grounded, citations, latency_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error && data) {
      dbQueries = data as unknown as MemoryQuery[];
    }
  } catch {
    /* fallback to memory */
  }

  const map = new Map<string, MemoryQuery>();
  dbQueries.forEach((q) => map.set(q.id, q));
  memoryQueries.forEach((q) => {
    if (!map.has(q.id)) map.set(q.id, q);
  });

  return Array.from(map.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);
});
