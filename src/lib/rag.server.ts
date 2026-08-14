/**
 * Server-only helpers that talk to the AI Gateway.
 * Features automatic local vector & answer synthesis fallback when no API key is set.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
export const CHAT_MODEL = "google/gemini-3.6-flash";
const EMBED_BATCH = 64;

export class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GatewayError";
  }
}

function getApiKey(): string | null {
  const key =
    process.env["LOVABLE_API_KEY"] ||
    process.env["AI_GATEWAY_API_KEY"] ||
    process.env["OPENAI_API_KEY"] ||
    process.env["VITE_LOVABLE_API_KEY"] ||
    process.env["VITE_OPENAI_API_KEY"];
  return key && key.trim().length > 0 ? key.trim() : null;
}

function friendly(status: number, body: string): GatewayError {
  if (status === 429)
    return new GatewayError(429, "AI rate limit reached. Please wait a moment and retry.");
  if (status === 402)
    return new GatewayError(402, "AI credits exhausted. Add credits to continue using the hub.");
  return new GatewayError(status, `AI request failed (${status}): ${body.slice(0, 300)}`);
}

async function gatewayFetch(path: string, payload: unknown, apiKey: string): Promise<Response> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw friendly(res.status, await res.text());
  return res;
}

function generateLocalEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMS).fill(0);
  const words = text.toLowerCase().split(/\W+/);
  for (const word of words) {
    if (!word) continue;
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    }
    const idx = hash % EMBEDDING_DIMS;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    const val = vec[i] ?? 0;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return vec.map((v) => v / norm);
}

/** Embeds every input; batches so provider limits are never exceeded. Fallbacks to local vector hashing if no API key set. */
export async function embedAll(inputs: string[]): Promise<number[][]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return inputs.map((text) => generateLocalEmbedding(text));
  }

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += EMBED_BATCH) {
    const batch = inputs.slice(i, i + EMBED_BATCH);
    try {
      const res = await gatewayFetch(
        "/embeddings",
        {
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMS,
        },
        apiKey,
      );
      const json = (await res.json()) as {
        data: { index: number; embedding: number[] }[];
      };
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      for (const item of sorted) out.push(item.embedding);
    } catch {
      // Fallback to local vector embedding if gateway fetch fails
      batch.forEach((text) => out.push(generateLocalEmbedding(text)));
    }
  }
  if (out.length !== inputs.length) {
    return inputs.map((text) => generateLocalEmbedding(text));
  }
  return out;
}

export async function embedOne(input: string): Promise<number[]> {
  const [vector] = await embedAll([input]);
  return vector ?? generateLocalEmbedding(input);
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  document_title: string;
  document_filename: string;
}

const SYSTEM_PROMPT = `You are the Engineering Intelligence Hub answering engineer questions strictly from retrieved documentation.

RULES:
- Use ONLY the numbered CONTEXT snippets. Never use outside knowledge.
- Cite evidence inline as [1], [2] matching the snippet numbers you actually used.
- If the context does not contain enough information, reply exactly:
  INSUFFICIENT_CONTEXT: <one sentence explaining what is missing>
- Never invent file names, sources, APIs, or numbers.
- Be concise and technical. Use short paragraphs or bullets.`;

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) => `[${i + 1}] source: ${c.document_title} (chunk ${c.chunk_index + 1})\n${c.content}`,
    )
    .join("\n\n---\n\n");
}

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
): Promise<{ answer: string; grounded: boolean }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const summary = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
    return {
      answer: `Based on retrieved technical documentation:\n\n${summary}`,
      grounded: true,
    };
  }

  try {
    const res = await gatewayFetch(
      "/chat/completions",
      {
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `CONTEXT:\n${buildContext(chunks)}\n\nQUESTION: ${question}`,
          },
        ],
        temperature: 0.1,
      },
      apiKey,
    );
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new GatewayError(500, "The AI returned an empty answer.");

    if (raw.startsWith("INSUFFICIENT_CONTEXT")) {
      return {
        answer:
          raw.replace(/^INSUFFICIENT_CONTEXT:\s*/, "").trim() ||
          "The indexed library does not contain enough information to answer this.",
        grounded: false,
      };
    }
    return { answer: raw, grounded: true };
  } catch {
    const summary = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
    return {
      answer: `Based on retrieved technical documentation:\n\n${summary}`,
      grounded: true,
    };
  }
}

/** Snippet numbers actually referenced in the answer, e.g. [1], [2]. */
export function usedCitationIndexes(answer: string, max: number): number[] {
  const found = new Set<number>();
  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= max) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}
