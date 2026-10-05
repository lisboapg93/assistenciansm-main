-- Identifica quem informou cada sessão sem alterar registros históricos.
ALTER TABLE public.session
  ADD COLUMN IF NOT EXISTS registered_by_name text;

COMMENT ON COLUMN public.session.registered_by_name IS
  'Nome informado por quem registrou a sessão.';

CREATE OR REPLACE FUNCTION public.require_session_registered_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.registered_by_name := NULLIF(btrim(NEW.registered_by_name), '');

  IF NEW.registered_by_name IS NULL
    AND (TG_OP = 'INSERT' OR NEW.registered_by_name IS DISTINCT FROM OLD.registered_by_name) THEN
    RAISE EXCEPTION 'Informe quem registrou a sessão';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_session_registered_by() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS require_session_registered_by_before_write ON public.session;
CREATE TRIGGER require_session_registered_by_before_write
  BEFORE INSERT OR UPDATE OF registered_by_name ON public.session
  FOR EACH ROW EXECUTE FUNCTION public.require_session_registered_by();

CREATE OR REPLACE FUNCTION public.register_session_with_consumption(
  p_session jsonb, p_sources jsonb, p_member_names jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id uuid;
  v_total_consumed numeric;
  v_total_available numeric;
  v_is_united boolean;
  v_source_count integer;
  v_distinct_count integer;
  v_locked_count integer := 0;
  v_source record;
  v_balance_id uuid;
  v_balance numeric;
  v_session_date date;
  v_sources jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'assistant'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar sessão';
  END IF;
  IF jsonb_typeof(p_session) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_sources) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados da sessão ou fontes de consumo inválidos';
  END IF;
  IF jsonb_typeof(p_session->'total_consumed') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Consumo inválido';
  END IF;
  IF NULLIF(btrim(p_session->>'registered_by_name'), '') IS NULL THEN
    RAISE EXCEPTION 'Informe quem registrou a sessão';
  END IF;
  v_total_consumed := (p_session->>'total_consumed')::numeric;
  v_is_united := COALESCE((p_session->>'is_united')::boolean, false);
  v_session_date := NULLIF(p_session->>'date', '')::date;
  IF v_total_consumed <= 0 OR v_total_consumed > 99999999.99
    OR v_total_consumed <> round(v_total_consumed, 2) THEN
    RAISE EXCEPTION 'Consumo deve ser positivo com no máximo 2 casas decimais';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_sources) AS sources(source)
    WHERE jsonb_typeof(source) IS DISTINCT FROM 'object'
      OR jsonb_typeof(source->'amount_available') IS DISTINCT FROM 'number'
  ) THEN
    RAISE EXCEPTION 'Fontes de consumo inválidas';
  END IF;
  SELECT count(*), count(DISTINCT vegetal_id), COALESCE(sum(amount_available), 0)
    INTO v_source_count, v_distinct_count, v_total_available
  FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric);
  IF v_source_count = 0 OR v_source_count <> v_distinct_count
    OR (NOT v_is_united AND v_source_count <> 1)
    OR v_total_available > 99999999.99 OR v_total_consumed > v_total_available THEN
    RAISE EXCEPTION 'Fontes de consumo inválidas ou saldo insuficiente';
  END IF;

  FOR v_source IN
    SELECT vegetal.id, vegetal.name, vegetal.quantity, source.amount_available
    FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric)
    JOIN public.vegetal AS vegetal ON vegetal.id = source.vegetal_id
    ORDER BY vegetal.id FOR UPDATE OF vegetal
  LOOP
    IF v_source.amount_available IS NULL OR v_source.amount_available <= 0
      OR v_source.amount_available <> round(v_source.amount_available, 2)
      OR v_source.amount_available > v_source.quantity THEN
      RAISE EXCEPTION 'Quantidade da fonte inválida ou saldo de vegetal insuficiente';
    END IF;
    v_locked_count := v_locked_count + 1;
    v_sources := v_sources || jsonb_build_array(jsonb_build_object(
      'vegetal_id', v_source.id, 'vegetal_name', v_source.name,
      'amount_available', CASE WHEN v_is_united THEN v_source.amount_available ELSE v_total_consumed END
    ));
  END LOOP;
  IF v_locked_count <> v_source_count THEN
    RAISE EXCEPTION 'Uma ou mais fontes de vegetal não existem';
  END IF;

  INSERT INTO public.session (
    date, type, dirigente, explanador, leitor, mestre_assistente, registered_by_name,
    observation, participants, total_participants, consumption, has_photo, has_audio
  ) VALUES (
    v_session_date::timestamp AT TIME ZONE 'UTC', p_session->>'type',
    p_session->>'dirigente', NULLIF(p_session->>'explanador', ''),
    NULLIF(p_session->>'leitor', ''), NULLIF(p_session->>'mestre_assistente', ''),
    btrim(p_session->>'registered_by_name'), NULLIF(p_session->>'observation', ''), p_session->'participants',
    (p_session->>'total_participants')::integer,
    jsonb_build_object('total_consumed', v_total_consumed, 'is_united', v_is_united, 'sources', v_sources),
    COALESCE((p_session->>'has_photo')::boolean, false), COALESCE((p_session->>'has_audio')::boolean, false)
  ) RETURNING id INTO v_session_id;

  FOR v_source IN SELECT * FROM jsonb_to_recordset(v_sources)
    AS source(vegetal_id uuid, vegetal_name text, amount_available numeric)
  LOOP
    UPDATE public.vegetal SET quantity = quantity - v_source.amount_available WHERE id = v_source.vegetal_id;
    INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
    VALUES ('Consumo', v_source.amount_available, v_source.vegetal_id, v_session_id,
      CASE WHEN v_is_united THEN 'Vegetal unido para sessão' ELSE 'Consumo em sessão' END);
  END LOOP;
  IF v_is_united THEN
    v_balance := v_total_available - v_total_consumed;
    IF v_balance > 0 THEN
      INSERT INTO public.vegetal (name, quantity, initial_quantity, envase_date, master, is_archived)
      VALUES ('Saldo ' || to_char(v_session_date, 'YYYY-MM-DD') || ' - ' || (p_session->>'type'),
        v_balance, v_balance, v_session_date, 'União', false) RETURNING id INTO v_balance_id;
      INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
      VALUES ('Saldo', v_balance, v_balance_id, v_session_id, 'Saldo do vegetal unido');
    END IF;
  END IF;
  PERFORM public.ensure_person_members(ARRAY[
    p_session->>'dirigente', p_session->>'mestre_assistente',
    p_session->>'explanador', p_session->>'leitor', p_session->>'registered_by_name'
  ]);
  RETURN v_session_id;
END;
$$;
REVOKE ALL ON FUNCTION public.register_session_with_consumption(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_session_with_consumption(jsonb, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
