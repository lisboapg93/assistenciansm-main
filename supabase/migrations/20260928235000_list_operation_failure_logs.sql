-- Consulta tipada pelo cliente até a próxima regeneração dos tipos Supabase.
-- SECURITY INVOKER preserva a RLS da tabela: somente editores recebem linhas.
CREATE OR REPLACE FUNCTION public.list_operation_failure_logs(
  p_limit integer DEFAULT 200
)
RETURNS SETOF public.operation_failure_logs
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.operation_failure_logs
  ORDER BY occurred_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.list_operation_failure_logs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_operation_failure_logs(integer) TO authenticated;
