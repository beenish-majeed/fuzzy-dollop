import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CornerDownLeft, Cpu, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AnswerPanel, type AnswerResult } from "@/components/AnswerPanel";
import { CinematicBackground } from "@/components/CinematicBackground";
import { HistoryPanel, type QueryRow } from "@/components/HistoryPanel";
import { LibraryPanel, type DocumentRow } from "@/components/LibraryPanel";
import { PipelineTrack, type PipelineStage } from "@/components/PipelineTrack";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UploadDropzone, type IngestPayload } from "@/components/UploadDropzone";
import {
  askQuestion,
  deleteDocument,
  ingestDocument,
  listDocuments,
  listQueries,
} from "@/lib/rag.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Engineering Intelligence Hub — Grounded RAG for Technical Docs" },
      {
        name: "description",
        content:
          "Upload runbooks, RFCs and specs, then ask questions and get grounded answers with expandable source citations for faster onboarding and troubleshooting.",
      },
      { property: "og:title", content: "Engineering Intelligence Hub" },
      {
        property: "og:description",
        content:
          "A real retrieval-augmented answering console for engineering documentation, with verifiable source citations.",
      },
    ],
  }),
  component: Home,
});

const SUGGESTIONS = [
  "How do I roll back a failed deployment?",
  "What are the service's rate limits?",
  "Which environment variables are required?",
];

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

function Home() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [pipelineError, setPipelineError] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useServerFn(listDocuments);
  const fetchQueries = useServerFn(listQueries);
  const runIngest = useServerFn(ingestDocument);
  const runAsk = useServerFn(askQuestion);
  const runDelete = useServerFn(deleteDocument);

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () => fetchDocuments() as Promise<DocumentRow[]>,
  });
  const historyQuery = useQuery({
    queryKey: ["queries"],
    queryFn: () => fetchQueries() as Promise<QueryRow[]>,
  });

  const documents = documentsQuery.data ?? [];
  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);

  const ingestMutation = useMutation({
    mutationFn: (payload: IngestPayload) => runIngest({ data: payload }),
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => runAsk({ data: { question: q } }),
  });

  async function handleParsed(payload: IngestPayload) {
    setPipelineError(false);
    setStage("chunk");
    setBusyLabel(`Chunking ${payload.filename}…`);
    await new Promise((r) => setTimeout(r, 350));
    setStage("index");
    setBusyLabel(`Embedding & indexing ${payload.filename}…`);
    try {
      const res = await ingestMutation.mutateAsync(payload);
      setStage("done");
      setBusyLabel(null);
      toast.success(`Indexed ${payload.filename}`, {
        description: `${res.chunks} chunks · ${res.chars.toLocaleString()} characters`,
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      setTimeout(() => setStage("idle"), 1600);
    } catch (error) {
      setPipelineError(true);
      setBusyLabel(null);
      toast.error("Indexing failed", { description: errorMessage(error) });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  }

  async function handleAsk(raw?: string) {
    const q = (raw ?? question).trim();
    setAskError(null);
    if (q.length < 3) {
      setAskError("Enter a question of at least 3 characters.");
      return;
    }
    if (documents.length === 0) {
      setAskError("Upload and index a document before asking questions.");
      return;
    }
    setQuestion(q);
    setPipelineError(false);
    setStage("retrieve");
    await new Promise((r) => setTimeout(r, 250));
    setStage("answer");
    try {
      const res = await askMutation.mutateAsync(q);
      setResult({ question: q, ...res });
      setStage("done");
      await queryClient.invalidateQueries({ queryKey: ["queries"] });
      setTimeout(() => setStage("idle"), 1600);
    } catch (error) {
      setPipelineError(true);
      setAskError(errorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await runDelete({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document removed from the index");
    } catch (error) {
      toast.error("Could not remove document", { description: errorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  }

  const asking = askMutation.isPending;
  const ingesting = ingestMutation.isPending || busyLabel !== null;

  return (
    <div className="relative min-h-screen">
      <CinematicBackground />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 overflow-hidden shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <img src="/aegis-icon.png" alt="Aegis Logo" className="h-full w-full object-cover" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Engineering Intelligence Hub
            </p>
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              Retrieval · Grounding · Citations
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="py-8 sm:py-14"
        >
          <span className="glass-panel inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            <Sparkles className="h-3 w-3 text-primary" />
            Real RAG · no invented sources
          </span>
          <h1 className="text-gradient mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
            Ask your engineering docs anything.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Upload runbooks, RFCs and specs. Every answer is retrieved from your own indexed content
            and shipped with the exact evidence chunks behind it.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="glass-panel rounded-lg px-3 py-1.5">{documents.length} documents</span>
            <span className="glass-panel rounded-lg px-3 py-1.5">{totalChunks} indexed chunks</span>
            <span className="glass-panel rounded-lg px-3 py-1.5">
              {historyQuery.data?.length ?? 0} questions asked
            </span>
          </div>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            <PipelineTrack stage={stage} error={pipelineError} />

            <div className="glass-panel rounded-2xl p-4 sm:p-5">
              <label
                htmlFor="question"
                className="mb-2 block font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase"
              >
                Ask the index
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <textarea
                  id="question"
                  rows={2}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAsk();
                    }
                  }}
                  placeholder="e.g. What steps recover the ingestion service after a queue backlog?"
                  className="min-h-[64px] flex-1 resize-y rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:focus-ring"
                />
                <button
                  type="button"
                  onClick={() => void handleAsk()}
                  disabled={asking}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 focus-visible:focus-ring disabled:opacity-60 sm:h-auto"
                >
                  {asking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CornerDownLeft className="h-4 w-4" />
                  )}
                  {asking ? "Reasoning" : "Ask"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void handleAsk(s)}
                    disabled={asking}
                    className="rounded-lg border border-border/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:focus-ring disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {askError && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {askError}
                </p>
              )}
            </div>

            <AnimatePresence mode="wait">
              {asking ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-panel space-y-3 rounded-2xl p-6"
                >
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-secondary" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-secondary" />
                  <div className="h-3 w-5/6 animate-pulse rounded-full bg-secondary" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary" />
                  <p className="pt-2 font-mono text-[11px] text-muted-foreground">
                    retrieving nearest chunks · grounding answer…
                  </p>
                </motion.div>
              ) : result ? (
                <AnswerPanel key="answer" result={result} />
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-panel rounded-2xl px-6 py-12 text-center"
                >
                  <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
                  <p className="text-sm font-medium text-foreground">No answer yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    Index a document, then ask a question. Answers appear here with the exact source
                    chunks used to produce them.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="space-y-5">
            <UploadDropzone
              disabled={ingesting}
              busyLabel={busyLabel}
              onParsingStart={(filename) => {
                setPipelineError(false);
                setStage("upload");
                setBusyLabel(`Parsing ${filename}…`);
              }}
              onParsed={handleParsed}
              onError={(message) => {
                setPipelineError(true);
                setBusyLabel(null);
                toast.error("Upload rejected", { description: message });
              }}
            />

            <LibraryPanel
              documents={documents}
              loading={documentsQuery.isLoading}
              error={documentsQuery.error ? errorMessage(documentsQuery.error) : null}
              deletingId={deletingId}
              onDelete={(id) => void handleDelete(id)}
            />

            <HistoryPanel
              queries={historyQuery.data ?? []}
              loading={historyQuery.isLoading}
              onReplay={(q) => void handleAsk(q)}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
