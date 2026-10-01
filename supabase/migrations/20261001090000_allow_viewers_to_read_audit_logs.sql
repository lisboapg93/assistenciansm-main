-- O registro de atividades é somente leitura para editores e visualizadores.
DROP POLICY IF EXISTS "Editors can read audit logs" ON public.audit_logs;

CREATE POLICY "Editors and viewers can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'viewer'::public.app_role)
  );

NOTIFY pgrst, 'reload schema';
