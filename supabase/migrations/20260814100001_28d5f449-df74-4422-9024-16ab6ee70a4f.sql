CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'text/plain',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chunks_document_id_idx ON public.chunks(document_id);
CREATE INDEX chunks_embedding_idx ON public.chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE public.queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  grounded BOOLEAN NOT NULL DEFAULT false,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX queries_created_at_idx ON public.queries(created_at DESC);

GRANT ALL ON public.documents TO anon, authenticated, service_role;
GRANT ALL ON public.chunks TO anon, authenticated, service_role;
GRANT ALL ON public.queries TO anon, authenticated, service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to chunks" ON public.chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to queries" ON public.queries FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector(1536), match_count INT DEFAULT 6)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_index INTEGER,
  content TEXT,
  similarity DOUBLE PRECISION,
  document_title TEXT,
  document_filename TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.chunk_index, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity,
         d.title, d.filename
  FROM public.chunks c
  JOIN public.documents d ON d.id = c.document_id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, int) TO anon, authenticated, service_role;