-- The original registration migration predates removal of the chamadas and
-- historias columns. Redefine the RPC after that schema change so all session
-- registrations use the current table shape.
CREATE OR REPLACE FUNCTION public.register_session_with_consumption(
  p_session jsonb,
  p_sources jsonb,
  p_member_names jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_total_consumed numeric;
  v_total_available numeric;
  v_is_united boolean;
  v_source_count integer;
  v_locked_source_count integer;
  v_source record;
  v_balance_id uuid;
  v_balance numeric;
  v_session_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'assistant'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar sessão';
  END IF;

  IF jsonb_typeof(p_session) <> 'object'
    OR jsonb_typeof(p_sources) <> 'array'
    OR jsonb_array_length(p_sources) = 0 THEN
    RAISE EXCEPTION 'Dados da sessão ou fontes de consumo inválidos';
  END IF;

  v_total_consumed := NULLIF(p_session->>'total_consumed', '')::numeric;
  v_is_united := COALESCE((p_session->>'is_united')::boolean, false);
  v_session_date := NULLIF(p_session->>'date', '')::date;

  IF v_total_consumed IS NULL OR v_total_consumed <= 0
    OR v_session_date IS NULL
    OR COALESCE(NULLIF(btrim(p_session->>'type'), ''), '') = ''
    OR COALESCE(NULLIF(btrim(p_session->>'dirigente'), ''), '') = ''
    OR COALESCE(NULLIF(btrim(p_session->>'mestre_assistente'), ''), '') = '' THEN
    RAISE EXCEPTION 'Dados obrigatórios da sessão inválidos';
  END IF;

  SELECT count(*), count(DISTINCT vegetal_id), COALESCE(sum(amount_available), 0)
    INTO v_source_count, v_locked_source_count, v_total_available
  FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric);

  IF v_source_count = 0 OR v_source_count <> v_locked_source_count
    OR (NOT v_is_united AND v_source_count <> 1)
    OR v_total_available <= 0 OR v_total_consumed > v_total_available THEN
    RAISE EXCEPTION 'Fontes de consumo inválidas ou saldo insuficiente';
  END IF;

  FOR v_source IN
    SELECT vegetal.id, vegetal.quantity, source.amount_available
    FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric)
    JOIN public.vegetal AS vegetal ON vegetal.id = source.vegetal_id
    ORDER BY vegetal.id
    FOR UPDATE OF vegetal
  LOOP
    IF v_source.amount_available IS NULL OR v_source.amount_available <= 0
      OR v_source.quantity < (
        CASE
          WHEN v_is_united THEN v_source.amount_available
          ELSE v_total_consumed
        END
      ) THEN
      RAISE EXCEPTION 'Saldo de vegetal insuficiente';
    END IF;
  END LOOP;

  SELECT count(*) INTO v_locked_source_count
  FROM public.vegetal AS vegetal
  JOIN jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric)
    ON vegetal.id = source.vegetal_id;

  IF v_locked_source_count <> v_source_count THEN
    RAISE EXCEPTION 'Uma ou mais fontes de vegetal não existem';
  END IF;

  INSERT INTO public.session (
    date, type, dirigente, explanador, leitor, mestre_assistente,
    observation, participants, total_participants, consumption,
    has_photo, has_audio
  ) VALUES (
    v_session_date::timestamptz,
    p_session->>'type',
    p_session->>'dirigente',
    NULLIF(p_session->>'explanador', ''),
    NULLIF(p_session->>'leitor', ''),
    NULLIF(p_session->>'mestre_assistente', ''),
    NULLIF(p_session->>'observation', ''),
    COALESCE(p_session->'participants', '{"mestres":0,"conselho":0,"instrutivo":0,"socios":0,"visitantes":0,"jovens":0}'::jsonb),
    COALESCE((p_session->>'total_participants')::integer, 0),
    jsonb_build_object('total_consumed', v_total_consumed, 'is_united', v_is_united, 'sources', p_sources),
    COALESCE((p_session->>'has_photo')::boolean, false),
    COALESCE((p_session->>'has_audio')::boolean, false)
  ) RETURNING id INTO v_session_id;

  IF v_is_united THEN
    FOR v_source IN
      SELECT vegetal.id, source.amount_available
      FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric)
      JOIN public.vegetal AS vegetal ON vegetal.id = source.vegetal_id
      ORDER BY vegetal.id
    LOOP
      UPDATE public.vegetal
      SET quantity = quantity - v_source.amount_available
      WHERE id = v_source.id;

      INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
      VALUES ('Consumo', v_source.amount_available, v_source.id, v_session_id, 'Vegetal unido para sessão');
    END LOOP;

    v_balance := v_total_available - v_total_consumed;
    IF v_balance > 0 THEN
      INSERT INTO public.vegetal (name, quantity, initial_quantity, envase_date, master, is_archived)
      VALUES ('Saldo ' || to_char(v_session_date, 'YYYY-MM-DD') || ' - ' || (p_session->>'type'), v_balance, v_balance, v_session_date, 'União', false)
      RETURNING id INTO v_balance_id;

      INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
      VALUES ('Saldo', v_balance, v_balance_id, v_session_id, 'Saldo do vegetal unido');
    END IF;
  ELSE
    SELECT vegetal_id INTO v_balance_id
    FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric)
    LIMIT 1;

    UPDATE public.vegetal
    SET quantity = quantity - v_total_consumed
    WHERE id = v_balance_id;

    INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
    VALUES ('Consumo', v_total_consumed, v_balance_id, v_session_id, 'Consumo em sessão');
  END IF;

  INSERT INTO public.members (name)
  SELECT DISTINCT btrim(value)
  FROM jsonb_array_elements_text(COALESCE(p_member_names, '[]'::jsonb)) AS names(value)
  WHERE btrim(value) <> ''
  ON CONFLICT (name) DO NOTHING;

  RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_session_with_consumption(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_session_with_consumption(jsonb, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
