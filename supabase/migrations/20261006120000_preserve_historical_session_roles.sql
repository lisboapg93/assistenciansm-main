-- Os nomes e funções de uma sessão são fatos históricos. Alterações posteriores
-- no cadastro de membros não podem impedir a edição dos demais metadados da sessão.

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
    '^\\[Transmissão da Assistência - 2º Dirigente: ([^\\]\\r\\n]+)\\]');
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
      '^\\[Transmissão da Assistência - 2º Dirigente: ([^\\]\\r\\n]+)\\]');
    IF position('[Transmissão da Assistência' IN COALESCE(OLD.observation, '')) = 1 THEN
      v_old_second := NULLIF(btrim(v_old_transmission[1]), '');
    END IF;

    v_validate_dirigente := NEW.dirigente IS DISTINCT FROM OLD.dirigente;
    v_validate_second := v_second IS DISTINCT FROM v_old_second;
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

CREATE OR REPLACE FUNCTION public.update_session_metadata(p_session_id uuid, p_updates jsonb)
RETURNS public.session
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.session;
  v_previous_session public.session;
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
  SELECT * INTO v_previous_session FROM public.session WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
  v_session := v_previous_session;
  v_session := jsonb_populate_record(v_session, p_updates);
  IF p_updates ? 'date' THEN
    v_session.date := (p_updates->>'date')::date::timestamp AT TIME ZONE 'UTC';
  END IF;
  UPDATE public.session SET
    date = v_session.date, type = v_session.type, dirigente = v_session.dirigente,
    explanador = v_session.explanador, leitor = v_session.leitor,
    mestre_assistente = v_session.mestre_assistente, observation = v_session.observation,
    participants = v_session.participants, total_participants = v_session.total_participants,
    has_photo = v_session.has_photo, has_audio = v_session.has_audio
  WHERE id = p_session_id RETURNING * INTO v_session;

  -- Só uma nova atribuição pode criar um membro. Edições de dados históricos
  -- não recriam cadastros excluídos nem alteram a função registrada na época.
  PERFORM public.ensure_person_members(ARRAY[
    CASE WHEN v_session.dirigente IS DISTINCT FROM v_previous_session.dirigente THEN v_session.dirigente END,
    CASE WHEN v_session.mestre_assistente IS DISTINCT FROM v_previous_session.mestre_assistente THEN v_session.mestre_assistente END,
    CASE WHEN v_session.explanador IS DISTINCT FROM v_previous_session.explanador THEN v_session.explanador END,
    CASE WHEN v_session.leitor IS DISTINCT FROM v_previous_session.leitor THEN v_session.leitor END
  ]);
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.update_session_metadata(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_session_metadata(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
