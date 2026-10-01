-- Session creation must pass through register_session_with_consumption so the
-- session, stock deduction and ledger entries remain in one transaction.
-- The SECURITY DEFINER RPC retains its ability to insert as its owner.
DROP POLICY IF EXISTS "Editors can insert sessions" ON public.session;
DROP POLICY IF EXISTS "Editors and assistants can insert sessions" ON public.session;
DROP POLICY IF EXISTS "Allow public insert session" ON public.session;

REVOKE INSERT ON TABLE public.session FROM PUBLIC, anon, authenticated;
