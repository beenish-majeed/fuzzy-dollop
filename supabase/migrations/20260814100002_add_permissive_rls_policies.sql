-- Migration to grant table access and add RLS policies for anon, authenticated, and service_role.

GRANT ALL ON public.documents TO anon, authenticated, service_role;
GRANT ALL ON public.chunks TO anon, authenticated, service_role;
GRANT ALL ON public.queries TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow public access to documents" ON public.documents;
CREATE POLICY "Allow public access to documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to chunks" ON public.chunks;
CREATE POLICY "Allow public access to chunks" ON public.chunks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access to queries" ON public.queries;
CREATE POLICY "Allow public access to queries" ON public.queries FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, int) TO anon, authenticated, service_role;
