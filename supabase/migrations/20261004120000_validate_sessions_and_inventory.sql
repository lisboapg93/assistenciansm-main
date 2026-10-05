-- Mantém as regras de domínio dentro da transação, inclusive para chamadas
-- diretas à API. Não altera consumo nem estoque de sessões já registradas.
UPDATE public.session
SET participants = (participants - 'conselho') || jsonb_build_object(
  'conselheiros', COALESCE(participants->'conselheiros', participants->'conselho', '0'::jsonb)
)
WHERE jsonb_typeof(participants) = 'object' AND participants ? 'conselho';

ALTER TABLE public.session ALTER COLUMN participants SET DEFAULT
  '{"mestres":0,"conselheiros":0,"instrutivo":0,"socios":0,"visitantes":0,"jovens":0}'::jsonb;

CREATE OR REPLACE FUNCTION public.ensure_person_members(p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN SELECT DISTINCT btrim(name) FROM unnest(p_names) AS names(name)
    WHERE NULLIF(btrim(name), '') IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.members
      WHERE public.member_identity_key(name, grau) = public.member_identity_key(v_name, NULL)
    ) THEN
      CONTINUE;
    END IF;
    BEGIN
      INSERT INTO public.members (name) VALUES (v_name);
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_person_members(text[]) FROM PUBLIC, anon, authenticated;

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
  v_transmission text[];
  v_role record;
  v_keys text[];
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

  SELECT array_agg(public.member_identity_key(name, NULL)) INTO v_keys
  FROM unnest(ARRAY[NEW.dirigente, v_second, NEW.explanador, NEW.leitor]) AS names(name)
  WHERE NULLIF(btrim(name), '') IS NOT NULL;
  IF cardinality(v_keys) <> (SELECT count(DISTINCT key) FROM unnest(v_keys) AS keys(key)) THEN
    RAISE EXCEPTION 'A mesma pessoa não pode exercer mais de uma função na sessão';
  END IF;

  FOR v_role IN SELECT * FROM (VALUES
    ('dirigente', NEW.dirigente), ('segundo dirigente', v_second)
  ) AS roles(label, name) WHERE NULLIF(btrim(name), '') IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.members AS member
      WHERE public.member_identity_key(member.name, member.grau) = public.member_identity_key(v_role.name, NULL)
        AND CASE
          WHEN v_second IS NOT NULL THEN member.grau = 'Quadro de Mestre'
          WHEN NEW.type = ANY(ARRAY['Primeira Escala','Segunda Escala','Escala Anual'])
            THEN member.grau = ANY(ARRAY['Quadro de Mestre','Corpo do Conselho','Corpo Instrutivo'])
          WHEN NEW.type = 'Quadro de Mestres' THEN true
          WHEN NEW.type = 'Extra' THEN member.grau IS DISTINCT FROM 'Quadro de Sócios'
          ELSE member.grau = 'Quadro de Mestre'
        END
    ) THEN
      RAISE EXCEPTION 'O % deve ser um membro elegível para este tipo de sessão', v_role.label;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.mestre_assistente, NULL)
      AND grau = 'Quadro de Mestre'
  ) THEN
    RAISE EXCEPTION 'O mestre assistente deve ser um membro do Quadro de Mestre';
  END IF;
  IF NULLIF(btrim(NEW.explanador), '') IS NOT NULL AND NOT EXISTS (
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
CREATE TRIGGER validate_session_data_before_write
  BEFORE INSERT OR UPDATE OF date, type, dirigente, explanador, leitor,
    mestre_assistente, observation, participants, total_participants
  ON public.session FOR EACH ROW EXECUTE FUNCTION public.validate_session_data();

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
    date, type, dirigente, explanador, leitor, mestre_assistente,
    observation, participants, total_participants, consumption, has_photo, has_audio
  ) VALUES (
    v_session_date::timestamp AT TIME ZONE 'UTC', p_session->>'type',
    p_session->>'dirigente', NULLIF(p_session->>'explanador', ''),
    NULLIF(p_session->>'leitor', ''), NULLIF(p_session->>'mestre_assistente', ''),
    NULLIF(p_session->>'observation', ''), p_session->'participants',
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
  -- Somente os nomes da sessão podem gerar membros. O argumento legado
  -- p_member_names permanece na assinatura por compatibilidade com clientes.
  PERFORM public.ensure_person_members(ARRAY[
    p_session->>'dirigente', p_session->>'mestre_assistente',
    p_session->>'explanador', p_session->>'leitor'
  ]);
  RETURN v_session_id;
END;
$$;
REVOKE ALL ON FUNCTION public.register_session_with_consumption(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_session_with_consumption(jsonb, jsonb, jsonb) TO authenticated;

CREATE FUNCTION public.update_session_metadata(p_session_id uuid, p_updates jsonb)
RETURNS public.session
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.session;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para editar sessão';
  END IF;
  IF jsonb_typeof(p_updates) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Dados da sessão inválidos';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_updates) AS fields(field) WHERE NOT (
    field = ANY(ARRAY['date','type','dirigente','explanador','leitor','mestre_assistente',
      'observation','participants','total_participants','has_photo','has_audio'])
  )) THEN
    RAISE EXCEPTION 'A edição permite somente metadados e participantes da sessão';
  END IF;
  SELECT * INTO v_session FROM public.session WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
  v_session := jsonb_populate_record(v_session, p_updates);
  IF p_updates ? 'date' THEN
    -- A coluna guarda uma data-calendário em meia-noite UTC, não um instante
    -- interpretado no fuso configurado na conexão do banco.
    v_session.date := (p_updates->>'date')::date::timestamp AT TIME ZONE 'UTC';
  END IF;
  UPDATE public.session SET
    date = v_session.date, type = v_session.type, dirigente = v_session.dirigente,
    explanador = v_session.explanador, leitor = v_session.leitor,
    mestre_assistente = v_session.mestre_assistente, observation = v_session.observation,
    participants = v_session.participants, total_participants = v_session.total_participants,
    has_photo = v_session.has_photo, has_audio = v_session.has_audio
  WHERE id = p_session_id RETURNING * INTO v_session;
  PERFORM public.ensure_person_members(ARRAY[
    v_session.dirigente, v_session.mestre_assistente, v_session.explanador, v_session.leitor
  ]);
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.update_session_metadata(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_session_metadata(uuid, jsonb) TO authenticated;
-- Mantém a grant de metadados existente durante a publicação: clientes ainda
-- abertos continuam editando, mas o trigger acima já aplica as validações.
-- O cliente novo usa a RPC para incluir membros na mesma transação.

CREATE OR REPLACE FUNCTION public.create_vegetal_with_movement(p_vegetal jsonb)
RETURNS public.vegetal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vegetal public.vegetal;
  v_quantity numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar vegetal';
  END IF;
  IF jsonb_typeof(p_vegetal) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados do vegetal inválidos'; END IF;
  v_quantity := NULLIF(p_vegetal->>'quantity', '')::numeric;
  IF NULLIF(btrim(p_vegetal->>'name'), '') IS NULL
    OR NULLIF(btrim(p_vegetal->>'master'), '') IS NULL
    OR NULLIF(p_vegetal->>'envase_date', '') IS NULL
    OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 99999999.99
    OR v_quantity <> round(v_quantity, 2)
    OR (p_vegetal->>'initial_quantity')::numeric IS DISTINCT FROM v_quantity THEN
    RAISE EXCEPTION 'Dados obrigatórios ou quantidade do vegetal inválidos';
  END IF;
  INSERT INTO public.vegetal (
    name, quantity, initial_quantity, envase_date, master, auxiliary,
    mariri_species, chacrona_species, is_archived, registered_by_name,
    mensageiro, responsavel_chacrona, responsavel_baticao
  ) VALUES (
    btrim(p_vegetal->>'name'), v_quantity, v_quantity, (p_vegetal->>'envase_date')::date,
    btrim(p_vegetal->>'master'), NULLIF(btrim(p_vegetal->>'auxiliary'), ''),
    NULLIF(btrim(p_vegetal->>'mariri_species'), ''), NULLIF(btrim(p_vegetal->>'chacrona_species'), ''), false,
    NULLIF(btrim(p_vegetal->>'registered_by_name'), ''), NULLIF(btrim(p_vegetal->>'mensageiro'), ''),
    NULLIF(btrim(p_vegetal->>'responsavel_chacrona'), ''), NULLIF(btrim(p_vegetal->>'responsavel_baticao'), '')
  ) RETURNING * INTO v_vegetal;
  INSERT INTO public.stock_movement (type, quantity, vegetal_id, details)
  VALUES ('Entrada', v_quantity, v_vegetal.id, 'Novo lote cadastrado: ' || v_vegetal.name);
  PERFORM public.ensure_person_members(ARRAY[v_vegetal.master, v_vegetal.auxiliary,
    v_vegetal.registered_by_name, v_vegetal.mensageiro, v_vegetal.responsavel_chacrona, v_vegetal.responsavel_baticao]);
  RETURN v_vegetal;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_vegetal_stock(
  p_vegetal_id uuid, p_operation text, p_quantity numeric,
  p_expected_quantity numeric, p_details text
)
RETURNS public.vegetal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vegetal public.vegetal;
  v_new_quantity numeric;
  v_movement_quantity numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para alterar estoque';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 99999999.99
    OR p_quantity <> round(p_quantity, 2) THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT * INTO v_vegetal FROM public.vegetal WHERE id = p_vegetal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote de vegetal não encontrado'; END IF;
  IF p_expected_quantity IS NULL OR p_expected_quantity <> v_vegetal.quantity THEN
    RAISE EXCEPTION 'O saldo foi alterado por outra pessoa. Atualize a página e tente novamente';
  END IF;
  IF p_operation = 'Saída' THEN
    IF p_quantity <= 0 OR p_quantity > v_vegetal.quantity THEN
      RAISE EXCEPTION 'Quantidade de saída inválida ou saldo insuficiente';
    END IF;
    v_new_quantity := v_vegetal.quantity - p_quantity;
    v_movement_quantity := p_quantity;
  ELSIF p_operation = 'Ajuste' THEN
    IF p_quantity = v_vegetal.quantity THEN RAISE EXCEPTION 'A nova quantidade deve ser diferente do saldo atual'; END IF;
    v_new_quantity := p_quantity;
    v_movement_quantity := v_vegetal.quantity - p_quantity;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido';
  END IF;
  UPDATE public.vegetal SET quantity = v_new_quantity WHERE id = v_vegetal.id RETURNING * INTO v_vegetal;
  INSERT INTO public.stock_movement (type, quantity, vegetal_id, details)
  VALUES (p_operation, v_movement_quantity, v_vegetal.id,
    COALESCE(NULLIF(btrim(p_details), ''), p_operation || ' de estoque'));
  RETURN v_vegetal;
END;
$$;
NOTIFY pgrst, 'reload schema';
