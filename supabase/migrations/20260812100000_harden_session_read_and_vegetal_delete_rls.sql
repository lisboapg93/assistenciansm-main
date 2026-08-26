-- Two RLS gaps found in a full-schema audit:
--
-- 1. "Authenticated users can read sessions" (session, FOR SELECT USING (true))
--    lets the 'assistant' role read the full session table directly via the
--    Supabase client, even though the app never sends assistants to
--    /historico or /relatorios (blocked only client-side by ProtectedRoute)
--    and src/pages/NovaSessao.tsx — the only route assistants can reach —
--    never queries the session table. Restrict SELECT to viewer/editor.
--
-- 2. "Editors can delete vegetal" has no corresponding UI (no delete-vegetal
--    button exists anywhere in src/), and stock_movement.vegetal_id is
--    ON DELETE SET NULL, so using this policy directly via the API would
--    orphan historical stock_movement rows (losing lot traceability) and
--    make reverse_session_consumption() silently skip restoring stock for a
--    since-deleted vegetal (its restore loops filter `WHERE vegetal_id IS
--    NOT NULL`). Drop it; nothing in the product relies on deleting a
--    vegetal lot.

DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.session;
CREATE POLICY "Viewers and editors can read sessions"
  ON public.session FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'viewer'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
  );

DROP POLICY IF EXISTS "Editors can delete vegetal" ON public.vegetal;
