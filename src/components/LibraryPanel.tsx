import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, FileText, Layers, Loader2, Trash2 } from "lucide-react";

export interface DocumentRow {
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  documents: DocumentRow[];
  loading: boolean;
  error: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
}

export function LibraryPanel({ documents, loading, error, deletingId, onDelete }: Props) {
  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="h-4 w-4 text-primary" />
          Document library
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {documents.length} indexed
        </span>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary/60" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-foreground">No documents yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a runbook, RFC or spec to build your index.
          </p>
        </div>
      )}

      {!loading && !error && documents.length > 0 && (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {documents.map((doc) => (
              <motion.li
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/40 px-3 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                  <p className="truncate font-mono text-[10px] tracking-wide text-muted-foreground">
                    {doc.chunk_count} chunks · {formatSize(doc.size_bytes)} ·{" "}
                    {doc.status === "ready" ? (
                      <span className="text-success">ready</span>
                    ) : doc.status === "failed" ? (
                      <span className="text-destructive">{doc.error_message ?? "failed"}</span>
                    ) : (
                      <span className="text-primary">{doc.status}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  aria-label={`Remove ${doc.title}`}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:focus-ring disabled:opacity-50"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
