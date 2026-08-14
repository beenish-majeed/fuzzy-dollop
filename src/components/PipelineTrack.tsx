import { motion } from "motion/react";
import { Check, FileUp, Scissors, Database, Search, Sparkles } from "lucide-react";

export type PipelineStage = "idle" | "upload" | "chunk" | "index" | "retrieve" | "answer" | "done";

const STAGES = [
  { key: "upload", label: "Upload", icon: FileUp },
  { key: "chunk", label: "Chunk", icon: Scissors },
  { key: "index", label: "Index", icon: Database },
  { key: "retrieve", label: "Retrieve", icon: Search },
  { key: "answer", label: "Answer", icon: Sparkles },
] as const;

const ORDER: Record<Exclude<PipelineStage, "idle">, number> = {
  upload: 0,
  chunk: 1,
  index: 2,
  retrieve: 3,
  answer: 4,
  done: 5,
};

export function PipelineTrack({ stage, error }: { stage: PipelineStage; error?: boolean }) {
  const active = stage === "idle" ? -1 : ORDER[stage];

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          RAG Pipeline
        </span>
        <span
          className={`font-mono text-[11px] ${error ? "text-destructive" : stage === "done" ? "text-success" : stage === "idle" ? "text-muted-foreground" : "text-primary"}`}
        >
          {error
            ? "fault"
            : stage === "idle"
              ? "standby"
              : stage === "done"
                ? "complete"
                : "running"}
        </span>
      </div>

      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {STAGES.map((s, i) => {
          const done = active > i;
          const running = active === i;
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex flex-col items-center gap-2 text-center">
              <div className="relative flex w-full items-center justify-center">
                {i > 0 && (
                  <span className="absolute right-1/2 left-[-50%] top-1/2 h-px -translate-y-1/2 bg-border">
                    <motion.span
                      className="block h-px bg-primary"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: done || running ? 1 : 0 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      style={{ transformOrigin: "left" }}
                    />
                  </span>
                )}
                <motion.div
                  animate={{ scale: running ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    error && running
                      ? "border-destructive/60 bg-destructive/15 text-destructive"
                      : done
                        ? "border-success/50 bg-success/15 text-success"
                        : running
                          ? "animate-node border-primary/60 bg-primary/15 text-primary"
                          : "border-border bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </motion.div>
              </div>
              <span
                className={`font-mono text-[10px] tracking-wide sm:text-[11px] ${
                  done || running ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
