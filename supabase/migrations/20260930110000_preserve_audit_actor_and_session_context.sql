-- Preserve the actor recorded at the time of each change. Removing an auth
-- account must not erase its identity from historical audit entries.
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE public.audit_logs
  ADD COLUMN actor_name text,
  ADD COLUMN origin text CHECK (origin IN ('direct', 'session')),
  ADD COLUMN related_session_id uuid;

COMMENT ON COLUMN public.audit_logs.actor_name IS
  'Nome do responsável no momento da operação, preservado mesmo se o perfil mudar.';
COMMENT ON COLUMN public.audit_logs.origin IS
  'direct: alteração principal; session: efeito automático de uma sessão. Nulo em registros antigos.';
COMMENT ON COLUMN public.audit_logs.related_session_id IS
  'Sessão associada, preservada mesmo após sua exclusão.';

-- Recover the current name for existing logs where the account still exists.
-- Names already lost through account deletion cannot be reconstructed.
UPDATE public.audit_logs AS log
SET actor_name = profile.display_name
FROM public.profiles AS profile
WHERE profile.user_id = log.actor_id
  AND profile.display_name IS NOT NULL;

-- Existing session and movement snapshots contain their session ID. Vegetal
-- updates from before this migration cannot be associated reliably.
UPDATE public.audit_logs
SET related_session_id = CASE
  WHEN entity_type = 'session' THEN entity_id
  ELSE COALESCE(
    NULLIF(new_data->>'session_id', '')::uuid,
    NULLIF(old_data->>'session_id', '')::uuid
  )
END
WHERE entity_type IN ('session', 'stock_movement');

-- A BEFORE DELETE trigger runs before the existing consumption reversal
-- trigger (PostgreSQL orders triggers of the same kind by name). The session
-- ID remains available to audit all nested stock changes in that transaction.
CREATE OR REPLACE FUNCTION public.set_session_delete_audit_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.audit_session_id', OLD.id::text, true);
  RETURN OLD;
END;
$$;

CREATE TRIGGER audit_session_delete_context
  BEFORE DELETE ON public.session
  FOR EACH ROW
  EXECUTE FUNCTION public.set_session_delete_audit_context();

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
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_session_id uuid;
  v_related_session_id uuid;
  v_origin text := 'direct';
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

  -- Session registration inserts the session before changing stock. This
  -- transaction-local setting tags the subsequent automatic changes.
  IF TG_TABLE_NAME = 'session' AND TG_OP = 'INSERT' THEN
    PERFORM set_config('app.audit_session_id', v_entity_id::text, true);
  END IF;

  IF v_actor_id IS NOT NULL THEN
    SELECT profile.display_name INTO v_actor_name
    FROM public.profiles AS profile
    WHERE profile.user_id = v_actor_id;
  END IF;

  v_session_id := NULLIF(current_setting('app.audit_session_id', true), '')::uuid;

  IF TG_TABLE_NAME = 'session' THEN
    v_related_session_id := v_entity_id;
  ELSIF v_session_id IS NOT NULL THEN
    v_related_session_id := v_session_id;
    v_origin := 'session';
  ELSIF TG_TABLE_NAME = 'stock_movement' THEN
    v_related_session_id := COALESCE(
      NULLIF(v_new_data->>'session_id', '')::uuid,
      NULLIF(v_old_data->>'session_id', '')::uuid
    );
  END IF;

  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    actor_id,
    actor_name,
    origin,
    related_session_id
  ) VALUES (
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_old_data,
    v_new_data,
    v_actor_id,
    v_actor_name,
    v_origin,
    v_related_session_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- The return shape changes, so replace the function in this migration.
DROP FUNCTION public.list_audit_logs(integer, integer, text, text, text, timestamptz, timestamptz);

CREATE FUNCTION public.list_audit_logs(
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
  origin text,
  related_session_id uuid,
  occurred_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    log.id,
    log.action,
    log.entity_type,
    log.entity_id,
    log.old_data,
    log.new_data,
    log.actor_id,
    log.actor_name,
    log.origin,
    log.related_session_id,
    log.occurred_at,
    count(*) OVER () AS total_count
  FROM public.audit_logs AS log
  WHERE (NULLIF(btrim(p_action), '') IS NULL OR log.action = p_action)
    AND (NULLIF(btrim(p_entity_type), '') IS NULL OR log.entity_type = p_entity_type)
    AND (
      NULLIF(btrim(p_actor_query), '') IS NULL
      OR COALESCE(log.actor_name, '') ILIKE '%' || btrim(p_actor_query) || '%'
      OR log.actor_id::text ILIKE '%' || btrim(p_actor_query) || '%'
    )
    AND (p_occurred_from IS NULL OR log.occurred_at >= p_occurred_from)
    AND (p_occurred_until IS NULL OR log.occurred_at < p_occurred_until)
  ORDER BY log.occurred_at DESC, log.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.list_audit_logs(integer, integer, text, text, text, timestamptz, timestamptz)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_audit_logs(integer, integer, text, text, text, timestamptz, timestamptz)
  TO authenticated;

CREATE INDEX audit_logs_related_session_idx
  ON public.audit_logs (related_session_id, occurred_at DESC)
  WHERE related_session_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
