/** Client-side document parsing: PDF / TXT / MD -> plain text. */

export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"] as const;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class ParseError extends Error {}

export function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const ok = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!ok) return `${file.name}: unsupported format. Use PDF, TXT or MD.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: file is larger than 15 MB.`;
  if (file.size === 0) return `${file.name}: file is empty.`;
  return null;
}

export async function extractText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf")) {
    try {
      const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
      const buffer = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const { text } = await pdfExtract(pdf, { mergePages: true });
      const merged = Array.isArray(text) ? text.join("\n\n") : text;
      if (!merged || merged.trim().length < 20) {
        throw new ParseError(
          `${file.name}: no selectable text found. Scanned PDFs are not supported.`,
        );
      }
      return merged;
    } catch (error) {
      if (error instanceof ParseError) throw error;
      throw new ParseError(`${file.name}: could not be parsed as a PDF.`);
    }
  }

  const text = await file.text();
  if (text.trim().length < 20) {
    throw new ParseError(`${file.name}: too little text to index.`);
  }
  return text;
}

export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .slice(0, 200);
}
