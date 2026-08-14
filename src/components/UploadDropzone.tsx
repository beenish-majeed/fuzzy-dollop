import { motion } from "motion/react";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import {
  ACCEPTED_EXTENSIONS,
  extractText,
  titleFromFilename,
  validateFile,
} from "@/lib/extract-text";

export interface IngestPayload {
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  text: string;
}

interface Props {
  disabled: boolean;
  busyLabel: string | null;
  onParsed: (payload: IngestPayload) => Promise<void>;
  onError: (message: string) => void;
  onParsingStart: (filename: string) => void;
}

export function UploadDropzone({ disabled, busyLabel, onParsed, onError, onParsingStart }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const invalid = validateFile(file);
      if (invalid) {
        onError(invalid);
        continue;
      }
      try {
        onParsingStart(file.name);
        const text = await extractText(file);
        await onParsed({
          title: titleFromFilename(file.name) || file.name,
          filename: file.name,
          mimeType: file.type || "text/plain",
          sizeBytes: file.size,
          text,
        });
      } catch (error) {
        onError(error instanceof Error ? error.message : `${file.name}: parsing failed.`);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) void handleFiles(e.dataTransfer.files);
      }}
      className={`glass-panel relative overflow-hidden rounded-2xl transition-all duration-300 ${
        dragging ? "border-primary/70 ring-2 ring-primary/25 shadow-md" : ""
      } ${disabled ? "opacity-70" : ""}`}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/25 to-transparent" />
      )}
      {busyLabel && (
        <div className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/20 to-transparent" />
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-3 px-6 py-9 text-center focus-visible:focus-ring disabled:cursor-not-allowed"
      >
        <motion.span
          animate={dragging ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"
        >
          {busyLabel ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : dragging ? (
            <FileText className="h-6 w-6" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </motion.span>

        <span className="text-sm font-medium text-foreground">
          {busyLabel ?? (dragging ? "Release to ingest" : "Drop technical docs or browse")}
        </span>
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
          {ACCEPTED_EXTENSIONS.join("  ·  ")} · max 15 MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
