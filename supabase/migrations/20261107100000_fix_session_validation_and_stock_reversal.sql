-- Corrige validação de sessões e serializa o estorno com consumos concorrentes.
-- Não altera sessões históricas, saldos nem movimentações existentes.

CREATE OR REPLACE FUNCTION public.validate_session_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_field text;
  v_count numeric;
  v_total numeric := 0;
  v_second text;
  v_old_second text;
  v_transmission text[];
  v_old_transmission text[];
  v_keys text[];
  v_validate_dirigente boolean;
  v_validate_second boolean;
  v_validate_explanador boolean;
  v_validate_leitor boolean;
  v_validate_mestre_assistente boolean;
BEGIN
  IF NEW.type IS NULL OR NOT (NEW.type = ANY(ARRAY[
    'Primeira Escala','Segunda Escala','Extra','Escala Anual','Instrutiva',
    'Caráter Instrutivo','Quadro de Mestres','Direção','Casal','Adventício'
  ])) THEN
    RAISE EXCEPTION 'Tipo de sessão inválido';
  END IF;
  IF NEW.date IS NULL OR NULLIF(btrim(NEW.dirigente), '') IS NULL
    OR NULLIF(btrim(NEW.mestre_assistente), '') IS NULL THEN
    RAISE EXCEPTION 'Preencha os campos obrigatórios da sessão';
  END IF;
  IF NEW.type = ANY(ARRAY['Primeira Escala','Segunda Escala','Escala Anual','Adventício'])
    AND (NULLIF(btrim(NEW.explanador), '') IS NULL OR NULLIF(btrim(NEW.leitor), '') IS NULL) THEN
    RAISE EXCEPTION 'Explanador e leitor são obrigatórios para este tipo de sessão';
  END IF;

  IF jsonb_typeof(NEW.participants) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Participantes inválidos';
  END IF;
  IF NEW.participants ? 'conselho' THEN
    NEW.participants := (NEW.participants - 'conselho') || jsonb_build_object(
      'conselheiros', COALESCE(NEW.participants->'conselheiros', NEW.participants->'conselho', '0'::jsonb)
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(NEW.participants) AS fields(field)
    WHERE NOT (field = ANY(ARRAY['mestres','conselheiros','instrutivo','socios','visitantes','jovens']))
  ) THEN
    RAISE EXCEPTION 'Grupo de participantes inválido';
  END IF;
  FOREACH v_field IN ARRAY ARRAY['mestres','conselheiros','instrutivo','socios','visitantes','jovens']
  LOOP
    IF jsonb_typeof(NEW.participants->v_field) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Informe quantidades inteiras não negativas para todos os participantes';
    END IF;
    v_count := (NEW.participants->>v_field)::numeric;
    IF v_count < 0 OR v_count <> trunc(v_count) OR v_count > 2147483647 THEN
      RAISE EXCEPTION 'Informe quantidades inteiras não negativas para os participantes';
    END IF;
    v_total := v_total + v_count;
  END LOOP;
  IF v_total <= 0 OR v_total > 2147483647 OR NEW.total_participants IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'Total de participantes inválido ou diferente da soma dos grupos';
  END IF;

  v_transmission := regexp_match(COALESCE(NEW.observation, ''),
    '^\[Transmissão da Assistência - 2º Dirigente: ([^\]\r\n]+)\]');
  IF position('[Transmissão da Assistência' IN COALESCE(NEW.observation, '')) = 1 THEN
    v_second := NULLIF(btrim(v_transmission[1]), '');
    IF v_second IS NULL OR NOT (NEW.type = ANY(ARRAY['Primeira Escala','Segunda Escala','Extra'])) THEN
      RAISE EXCEPTION 'A transmissão exige um tipo permitido e o segundo dirigente';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_validate_dirigente := true;
    v_validate_second := true;
    v_validate_explanador := true;
    v_validate_leitor := true;
    v_validate_mestre_assistente := true;
  ELSE
    v_old_transmission := regexp_match(COALESCE(OLD.observation, ''),
      '^\[Transmissão da Assistência - 2º Dirigente: ([^\]\r\n]+)\]');
    IF position('[Transmissão da Assistência' IN COALESCE(OLD.observation, '')) = 1 THEN
      v_old_second := NULLIF(btrim(v_old_transmission[1]), '');
    END IF;

    -- Mudanças de contexto são novas atribuições, mesmo com os mesmos nomes.
    -- Edições de observação/participantes sem mudar esse contexto mantêm o histórico.
    v_validate_dirigente := NEW.dirigente IS DISTINCT FROM OLD.dirigente
      OR NEW.type IS DISTINCT FROM OLD.type
      OR (v_second IS NOT NULL) IS DISTINCT FROM (v_old_second IS NOT NULL);
    v_validate_second := v_second IS DISTINCT FROM v_old_second
      OR NEW.type IS DISTINCT FROM OLD.type
      OR (v_second IS NOT NULL) IS DISTINCT FROM (v_old_second IS NOT NULL);
    v_validate_explanador := NEW.explanador IS DISTINCT FROM OLD.explanador;
    v_validate_leitor := NEW.leitor IS DISTINCT FROM OLD.leitor;
    v_validate_mestre_assistente := NEW.mestre_assistente IS DISTINCT FROM OLD.mestre_assistente;
  END IF;

  IF v_validate_dirigente OR v_validate_second OR v_validate_explanador
    OR v_validate_leitor OR v_validate_mestre_assistente THEN
    SELECT array_agg(public.member_identity_key(name, NULL)) INTO v_keys
    FROM unnest(ARRAY[NEW.dirigente, v_second, NEW.explanador, NEW.leitor]) AS names(name)
    WHERE NULLIF(btrim(name), '') IS NOT NULL;
    IF cardinality(v_keys) <> (SELECT count(DISTINCT key) FROM unnest(v_keys) AS keys(key)) THEN
      RAISE EXCEPTION 'A mesma pessoa não pode exercer mais de uma função na sessão';
    END IF;
  END IF;

  IF v_validate_dirigente AND NOT EXISTS (
    SELECT 1 FROM public.members AS member
    WHERE public.member_identity_key(member.name, member.grau) = public.member_identity_key(NEW.dirigente, NULL)
      AND CASE
        WHEN v_second IS NOT NULL THEN member.grau = 'Quadro de Mestre'
        WHEN NEW.type = ANY(ARRAY['Primeira Escala','Segunda Escala','Escala Anual'])
          THEN member.grau = ANY(ARRAY['Quadro de Mestre','Corpo do Conselho','Corpo Instrutivo'])
        WHEN NEW.type = 'Quadro de Mestres' THEN true
        WHEN NEW.type = 'Extra' THEN member.grau IS DISTINCT FROM 'Quadro de Sócios'
        ELSE member.grau = 'Quadro de Mestre'
      END
  ) THEN
    RAISE EXCEPTION 'O dirigente deve ser um membro elegível para este tipo de sessão';
  END IF;

  IF v_validate_second AND v_second IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members AS member
    WHERE public.member_identity_key(member.name, member.grau) = public.member_identity_key(v_second, NULL)
      AND member.grau = 'Quadro de Mestre'
  ) THEN
    RAISE EXCEPTION 'O segundo dirigente deve ser um membro elegível para este tipo de sessão';
  END IF;

  IF v_validate_mestre_assistente AND NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.mestre_assistente, NULL)
      AND grau = 'Quadro de Mestre'
  ) THEN
    RAISE EXCEPTION 'O mestre assistente deve ser um membro do Quadro de Mestre';
  END IF;

  IF v_validate_explanador AND NULLIF(btrim(NEW.explanador), '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.explanador, NULL)
      AND grau IS NOT NULL AND grau <> 'Quadro de Sócios'
  ) THEN
    RAISE EXCEPTION 'O explanador deve ser um membro cadastrado e não pode ser do Quadro de Sócios';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_session_data() FROM PUBLIC, anon, authenticated;


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
    OR (v_is_united AND (
      v_total_available > 99999999.99 OR v_total_consumed > v_total_available
    )) THEN
    RAISE EXCEPTION 'Fontes de consumo inválidas ou saldo insuficiente';
  END IF;

  -- Sem união, amount_available é apenas o saldo capturado pelo cliente.
  -- A quantidade debitada é o consumo solicitado, validado contra o saldo travado.
  FOR v_source IN
    SELECT vegetal.id, vegetal.name, vegetal.quantity, source.amount_available
    FROM jsonb_to_recordset(p_sources) AS source(vegetal_id uuid, amount_available numeric)
    JOIN public.vegetal AS vegetal ON vegetal.id = source.vegetal_id
    ORDER BY vegetal.id FOR UPDATE OF vegetal
  LOOP
    IF v_source.amount_available IS NULL OR v_source.amount_available <= 0
      OR v_source.amount_available <> round(v_source.amount_available, 2)
      OR v_source.amount_available > 99999999.99
      OR (v_is_united AND v_source.amount_available > v_source.quantity)
      OR (NOT v_is_united AND v_total_consumed > v_source.quantity) THEN
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

-- Bloqueia fontes e saldos na mesma ordem usada pela RPC de registro.
-- As validações usam o saldo confirmado após qualquer consumo concorrente.
CREATE OR REPLACE FUNCTION public.reverse_session_consumption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_movement record;
BEGIN
  PERFORM vegetal.id
  FROM public.vegetal AS vegetal
  WHERE EXISTS (
    SELECT 1 FROM public.stock_movement AS movement
    WHERE movement.session_id = OLD.id
      AND movement.type IN ('Consumo', 'Saldo')
      AND movement.vegetal_id = vegetal.id
  )
  ORDER BY vegetal.id
  FOR UPDATE OF vegetal;

  -- Valida todos os saldos antes de qualquer estorno. Os locks acima duram
  -- até o fim da exclusão e impedem que uma sessão consuma o saldo no intervalo.
  FOR v_movement IN
    SELECT movement.vegetal_id, sum(movement.quantity) AS quantity,
      vegetal.quantity AS current_quantity
    FROM public.stock_movement AS movement
    JOIN public.vegetal AS vegetal ON vegetal.id = movement.vegetal_id
    WHERE movement.session_id = OLD.id AND movement.type = 'Saldo'
    GROUP BY movement.vegetal_id, vegetal.quantity
  LOOP
    IF v_movement.current_quantity < v_movement.quantity THEN
      RAISE EXCEPTION 'Não é possível excluir: o saldo do vegetal unido já foi parcialmente consumido em outra sessão';
    END IF;
  END LOOP;

  FOR v_movement IN
    SELECT vegetal_id, sum(quantity) AS quantity
    FROM public.stock_movement
    WHERE session_id = OLD.id AND type = 'Consumo' AND vegetal_id IS NOT NULL
    GROUP BY vegetal_id
    ORDER BY vegetal_id
  LOOP
    UPDATE public.vegetal
    SET quantity = quantity + v_movement.quantity
    WHERE id = v_movement.vegetal_id;

    IF FOUND THEN
      INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
      VALUES ('Ajuste', -v_movement.quantity, v_movement.vegetal_id, OLD.id, 'Estorno por exclusão de sessão');
    END IF;
  END LOOP;

  FOR v_movement IN
    SELECT vegetal_id, quantity
    FROM public.stock_movement
    WHERE session_id = OLD.id AND type = 'Saldo' AND vegetal_id IS NOT NULL
    ORDER BY vegetal_id, id
  LOOP
    UPDATE public.vegetal
    SET quantity = quantity - v_movement.quantity
    WHERE id = v_movement.vegetal_id;

    IF FOUND THEN
      INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
      VALUES ('Ajuste', v_movement.quantity, v_movement.vegetal_id, OLD.id, 'Estorno de saldo por exclusão de sessão');
    END IF;
  END LOOP;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.reverse_session_consumption() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
