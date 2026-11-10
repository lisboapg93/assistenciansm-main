-- Sessões históricas continuam editáveis e observações longas deixam de quebrar o índice.
-- 1) validate_session_data: tipo, obrigatórios, participantes e transmissão só são
--    validados quando o UPDATE os altera (INSERT valida tudo), como já ocorre com a
--    elegibilidade de membros.
-- 2) O índice único indexava a observação crua; textos acima de ~2.700 bytes
--    estouravam o limite do btree. Passa a indexar md5(observação), com a mesma
--    semântica de igualdade.

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
  v_is_insert boolean := TG_OP = 'INSERT';
  v_check_type boolean;
  v_check_required boolean;
  v_check_roles_required boolean;
  v_check_participants boolean;
  v_check_transmission boolean;
BEGIN
  -- Sessões históricas continuam editáveis: cada regra só vale para o que o
  -- UPDATE realmente altera. Inserções validam tudo.
  v_check_type := v_is_insert OR NEW.type IS DISTINCT FROM OLD.type;
  v_check_required := v_is_insert OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.date IS DISTINCT FROM OLD.date
    OR NEW.dirigente IS DISTINCT FROM OLD.dirigente
    OR NEW.mestre_assistente IS DISTINCT FROM OLD.mestre_assistente;
  v_check_roles_required := v_is_insert OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.explanador IS DISTINCT FROM OLD.explanador
    OR NEW.leitor IS DISTINCT FROM OLD.leitor;
  v_check_participants := v_is_insert OR NEW.participants IS DISTINCT FROM OLD.participants
    OR NEW.total_participants IS DISTINCT FROM OLD.total_participants;
  v_check_transmission := v_is_insert OR NEW.observation IS DISTINCT FROM OLD.observation
    OR NEW.type IS DISTINCT FROM OLD.type;

  IF v_check_type AND (NEW.type IS NULL OR NOT (NEW.type = ANY(ARRAY[
    'Primeira Escala','Segunda Escala','Extra','Escala Anual','Instrutiva',
    'Caráter Instrutivo','Quadro de Mestres','Direção','Casal','Adventício'
  ]))) THEN
    RAISE EXCEPTION 'Tipo de sessão inválido';
  END IF;
  IF v_check_required AND (NEW.date IS NULL OR NULLIF(btrim(NEW.dirigente), '') IS NULL
    OR NULLIF(btrim(NEW.mestre_assistente), '') IS NULL) THEN
    RAISE EXCEPTION 'Preencha os campos obrigatórios da sessão';
  END IF;
  IF v_check_roles_required
    AND NEW.type = ANY(ARRAY['Primeira Escala','Segunda Escala','Escala Anual','Adventício'])
    AND (NULLIF(btrim(NEW.explanador), '') IS NULL OR NULLIF(btrim(NEW.leitor), '') IS NULL) THEN
    RAISE EXCEPTION 'Explanador e leitor são obrigatórios para este tipo de sessão';
  END IF;

  IF jsonb_typeof(NEW.participants) = 'object' AND NEW.participants ? 'conselho' THEN
    NEW.participants := (NEW.participants - 'conselho') || jsonb_build_object(
      'conselheiros', COALESCE(NEW.participants->'conselheiros', NEW.participants->'conselho', '0'::jsonb)
    );
  END IF;
  IF v_check_participants THEN
    IF jsonb_typeof(NEW.participants) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Participantes inválidos';
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

  END IF;

  v_transmission := regexp_match(COALESCE(NEW.observation, ''),
    '^\[Transmissão da Assistência - 2º Dirigente: ([^\]\r\n]+)\]');
  IF position('[Transmissão da Assistência' IN COALESCE(NEW.observation, '')) = 1 THEN
    v_second := NULLIF(btrim(v_transmission[1]), '');
    IF v_check_transmission AND (v_second IS NULL
      OR NOT (NEW.type = ANY(ARRAY['Primeira Escala','Segunda Escala','Extra']))) THEN
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
        WHEN NEW.type = 'Quadro de Mestres' THEN member.grau IS NOT NULL
        WHEN NEW.type = 'Extra' THEN member.grau IS NOT NULL
          AND member.grau IS DISTINCT FROM 'Quadro de Sócios'
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

DROP INDEX IF EXISTS public.session_no_duplicate_logical_record_idx;
CREATE UNIQUE INDEX session_no_duplicate_logical_record_idx
ON public.session (
  date,
  type,
  lower(btrim(dirigente)),
  lower(btrim(coalesce(mestre_assistente, ''))),
  lower(btrim(coalesce(explanador, ''))),
  lower(btrim(coalesce(leitor, ''))),
  total_participants,
  (coalesce(consumption->>'total_consumed', '')),
  md5(coalesce(observation, '')),
  has_photo,
  has_audio
);
