import { motion } from "motion/react";
import { History, Search } from "lucide-react";
import { useMemo, useState } from "react";

export interface QueryRow {
  id: string;
  question: string;
  answer: string;
  grounded: boolean;
  latency_ms: number;
  created_at: string;
}

interface Props {
  queries: QueryRow[];
  loading: boolean;
  onReplay: (question: string) => void;
}

export function HistoryPanel({ queries, loading, onReplay }: Props) {
  const [term, setTerm] = useState("");

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return queries;
    return queries.filter(
      (row) => row.question.toLowerCase().includes(q) || row.answer.toLowerCase().includes(q),
    );
  }, [queries, term]);

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4 text-accent" />
          Q&amp;A history
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">{queries.length}</span>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search past questions"
          aria-label="Search past questions"
          className="w-full rounded-xl border border-border bg-background/40 py-2 pr-3 pl-8.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:focus-ring"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          {queries.length === 0
            ? "Ask your first question to start the log."
            : "No history matches that search."}
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {filtered.map((row) => (
            <motion.li key={row.id} layout>
              <button
                type="button"
                onClick={() => onReplay(row.question)}
                className="w-full rounded-xl border border-border/70 bg-card/40 px-3 py-2.5 text-left transition-colors hover:border-primary/50 focus-visible:focus-ring"
              >
                <p className="line-clamp-2 text-sm text-foreground">{row.question}</p>
                <p className="mt-1 font-mono text-[10px] tracking-wide text-muted-foreground">
                  {row.grounded ? (
                    <span className="text-success">grounded</span>
                  ) : (
                    <span className="text-warning">insufficient</span>
                  )}{" "}
                  · {(row.latency_ms / 1000).toFixed(1)}s ·{" "}
                  {new Date(row.created_at).toLocaleString()}
                </p>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
