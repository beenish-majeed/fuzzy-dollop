import { motion } from "motion/react";
import { AlertTriangle, Quote, ShieldCheck, Timer } from "lucide-react";

import { CitationCard } from "@/components/CitationCard";
import type { Citation } from "@/lib/rag.functions";

export interface AnswerResult {
  question: string;
  answer: string;
  grounded: boolean;
  citations: Citation[];
  latencyMs: number;
}

function renderAnswer(answer: string) {
  return answer.split(/\n{2,}/).map((block, i) => {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l));
    if (isList) {
      return (
        <ul key={i} className="list-disc space-y-1.5 pl-5">
          {lines.map((l, j) => (
            <li key={j}>{l.replace(/^\s*([-*•]|\d+\.)\s+/, "")}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{block}</p>;
  });
}

export function AnswerPanel({ result }: { result: AnswerResult }) {
  const used = result.citations.filter((c) => c.used);
  const shown = used.length > 0 ? used : result.citations;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-4"
      aria-live="polite"
    >
      <div className="glass-panel relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase ${
              result.grounded ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {result.grounded ? (
              <ShieldCheck className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {result.grounded ? "Grounded answer" : "Insufficient context"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            <Quote className="h-3 w-3" />
            {used.length || result.citations.length} sources
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            <Timer className="h-3 w-3" />
            {(result.latencyMs / 1000).toFixed(1)}s
          </span>
        </div>

        <p className="mb-3 font-mono text-xs text-muted-foreground">{result.question}</p>

        <div className="space-y-3 text-[15px] leading-relaxed text-foreground">
          {renderAnswer(result.answer)}
        </div>
      </div>

      {shown.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Evidence — expand to verify
          </h3>
          {shown.map((c) => (
            <CitationCard key={c.chunkId} citation={c} />
          ))}
        </div>
      )}
    </motion.section>
  );
}
