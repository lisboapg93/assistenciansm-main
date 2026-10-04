-- Auxiliares podem consultar o histórico de sessões, mas continuam sem
-- permissões de escrita. As policies de UPDATE e DELETE seguem exclusivas
-- para editores.
DROP POLICY IF EXISTS "Viewers and editors can read sessions" ON public.session;

CREATE POLICY "Viewers, editors and assistants can read sessions"
  ON public.session FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'viewer'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'assistant'::public.app_role)
  );
