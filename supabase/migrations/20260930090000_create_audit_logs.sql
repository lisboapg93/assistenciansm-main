-- Registro imutável das operações de dados feitas pela aplicação.
-- Os triggers cobrem tanto as mutações diretas quanto as realizadas pelas
-- RPCs transacionais de sessão e estoque.

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type text NOT NULL CHECK (entity_type IN ('session', 'vegetal', 'stock_movement', 'members')),
  entity_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT audit_logs_old_data_is_object
    CHECK (old_data IS NULL OR jsonb_typeof(old_data) = 'object'),
  CONSTRAINT audit_logs_new_data_is_object
    CHECK (new_data IS NULL OR jsonb_typeof(new_data) = 'object'),
  CONSTRAINT audit_logs_action_payload
    CHECK (
      (action = 'create' AND old_data IS NULL AND new_data IS NOT NULL)
      OR (action = 'update' AND old_data IS NOT NULL AND new_data IS NOT NULL)
      OR (action = 'delete' AND old_data IS NOT NULL AND new_data IS NULL)
    )
);

COMMENT ON TABLE public.audit_logs IS
  'Registro imutável de cadastros, edições e exclusões de dados operacionais.';
COMMENT ON COLUMN public.audit_logs.actor_id IS
  'Conta autenticada que iniciou a operação; nula somente em operações internas sem sessão.';

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- A tabela é somente leitura para editores. As inclusões ocorrem pelo trigger
-- SECURITY DEFINER abaixo; não há política de INSERT, UPDATE ou DELETE.
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

CREATE POLICY "Editors can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role));

CREATE OR REPLACE FUNCTION public.audit_data_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text;
  v_entity_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_entity_id := NEW.id;
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_old_data := to_jsonb(OLD);
  ELSE
    RAISE EXCEPTION 'Operação de auditoria não suportada: %', TG_OP;
  END IF;

  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    actor_id
  ) VALUES (
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_old_data,
    v_new_data,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_session_data_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.session
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_data_change();

CREATE TRIGGER audit_vegetal_data_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.vegetal
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_data_change();

CREATE TRIGGER audit_stock_movement_data_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_movement
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_data_change();

CREATE TRIGGER audit_members_data_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_data_change();

CREATE INDEX audit_logs_occurred_at_idx
  ON public.audit_logs (occurred_at DESC, id DESC);
CREATE INDEX audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_logs_actor_occurred_at_idx
  ON public.audit_logs (actor_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.list_audit_logs(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_actor_query text DEFAULT NULL,
  p_occurred_from timestamptz DEFAULT NULL,
  p_occurred_until timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  actor_name text,
  occurred_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    audit_logs.id,
    audit_logs.action,
    audit_logs.entity_type,
    audit_logs.entity_id,
    audit_logs.old_data,
    audit_logs.new_data,
    audit_logs.actor_id,
    profiles.display_name AS actor_name,
    audit_logs.occurred_at,
    count(*) OVER () AS total_count
  FROM public.audit_logs
  LEFT JOIN public.profiles ON profiles.user_id = audit_logs.actor_id
  WHERE (NULLIF(btrim(p_action), '') IS NULL OR audit_logs.action = p_action)
    AND (NULLIF(btrim(p_entity_type), '') IS NULL OR audit_logs.entity_type = p_entity_type)
    AND (
      NULLIF(btrim(p_actor_query), '') IS NULL
      OR COALESCE(profiles.display_name, '') ILIKE '%' || btrim(p_actor_query) || '%'
    )
    AND (p_occurred_from IS NULL OR audit_logs.occurred_at >= p_occurred_from)
    AND (p_occurred_until IS NULL OR audit_logs.occurred_at < p_occurred_until)
  ORDER BY audit_logs.occurred_at DESC, audit_logs.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.list_audit_logs(integer, integer, text, text, text, timestamptz, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_audit_logs(integer, integer, text, text, text, timestamptz, timestamptz)
  TO authenticated;
