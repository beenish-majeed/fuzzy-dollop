import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";

import type { Citation } from "@/lib/rag.functions";

export function CitationCard({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(citation.similarity * 100);

  return (
    <motion.div
      layout
      className={`glass-panel overflow-hidden rounded-xl ${
        citation.used ? "border-primary/40" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:focus-ring"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs ${
            citation.used ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          {citation.marker}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{citation.documentTitle}</span>
          </span>
          <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-muted-foreground">
            chunk {citation.chunkIndex + 1} · match {pct}%{citation.used ? " · cited" : ""}
          </span>
        </span>

        <span className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary sm:block">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="max-h-64 overflow-y-auto border-t border-border px-3.5 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {citation.content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
