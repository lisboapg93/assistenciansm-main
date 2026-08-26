-- 20260812100000 restricted session SELECT to viewer/editor, assuming the
-- 'assistant' role never reads the session table. That assumption was
-- wrong: /estoque (accessible to all three roles, including assistant) calls
-- useSessions() via useStatistics() to compute the stock-forecast numbers
-- shown on that page ("~N sessões restantes"). Restricting SELECT broke that
-- forecast for assistants. Revert to open read for any authenticated role;
-- properly scoping what an assistant can see would need a dedicated
-- aggregate view/RPC exposing only forecast inputs, not a table-level
-- policy — left as a follow-up, not done here.

DROP POLICY IF EXISTS "Viewers and editors can read sessions" ON public.session;
CREATE POLICY "Authenticated users can read sessions"
  ON public.session FOR SELECT
  TO authenticated
  USING (true);
