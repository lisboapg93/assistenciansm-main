-- Registro append-only das falhas de escrita. Diferente de error_logs, esta
-- tabela preserva a entrada sanitizada que a operação tentou processar.
CREATE TABLE public.operation_failure_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'import')),
  entity text NOT NULL,
  entity_id text,
  error_message text NOT NULL,
  error_code text,
  error_location text NOT NULL,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT operation_failure_logs_message_not_empty
    CHECK (length(btrim(error_message)) > 0),
  CONSTRAINT operation_failure_logs_location_not_empty
    CHECK (length(btrim(error_location)) > 0),
  CONSTRAINT operation_failure_logs_input_is_object
    CHECK (jsonb_typeof(input_payload) = 'object'),
  CONSTRAINT operation_failure_logs_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.operation_failure_logs IS
  'Falhas de create, update, delete e import com dados de entrada sanitizados.';

ALTER TABLE public.operation_failure_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can read operation failure logs"
  ON public.operation_failure_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::public.app_role));

REVOKE ALL ON TABLE public.operation_failure_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.operation_failure_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.log_operation_failure(
  p_error_message text,
  p_error_location text,
  p_operation text,
  p_entity text,
  p_entity_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_input_payload jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id uuid;
  v_input_payload jsonb;
  v_metadata jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para registrar uma falha operacional'
      USING ERRCODE = '42501';
  END IF;

  IF p_operation NOT IN ('create', 'update', 'delete', 'import')
    OR COALESCE(btrim(p_error_message), '') = ''
    OR COALESCE(btrim(p_error_location), '') = ''
    OR COALESCE(btrim(p_entity), '') = '' THEN
    RAISE EXCEPTION 'Dados inválidos para registrar falha operacional'
      USING ERRCODE = '22023';
  END IF;

  v_input_payload := CASE
    WHEN jsonb_typeof(COALESCE(p_input_payload, '{}'::jsonb)) = 'object'
      THEN COALESCE(p_input_payload, '{}'::jsonb)
    ELSE '{}'::jsonb
  END;
  v_metadata := CASE
    WHEN jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) = 'object'
      THEN COALESCE(p_metadata, '{}'::jsonb)
    ELSE '{}'::jsonb
  END;

  IF octet_length(v_input_payload::text) > 16384 THEN
    v_input_payload := jsonb_build_object('payload_truncated', true);
  END IF;
  IF octet_length(v_metadata::text) > 8192 THEN
    v_metadata := jsonb_build_object('metadata_truncated', true);
  END IF;

  INSERT INTO public.operation_failure_logs (
    operation,
    entity,
    entity_id,
    error_message,
    error_code,
    error_location,
    input_payload,
    metadata,
    user_id
  ) VALUES (
    p_operation,
    left(p_entity, 100),
    left(p_entity_id, 200),
    left(p_error_message, 4000),
    left(p_error_code, 100),
    left(p_error_location, 200),
    v_input_payload,
    v_metadata,
    auth.uid()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_operation_failure(text, text, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_operation_failure(text, text, text, text, text, text, jsonb, jsonb)
  TO authenticated;

CREATE INDEX operation_failure_logs_occurred_at_idx
  ON public.operation_failure_logs (occurred_at DESC);
CREATE INDEX operation_failure_logs_entity_occurred_at_idx
  ON public.operation_failure_logs (entity, occurred_at DESC);
