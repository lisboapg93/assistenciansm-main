-- Uma conta tem um papel efetivo. Contas antigas podem ter acumulado viewer
-- ao receber assistant/editor; manter somente o papel de maior permissão.
WITH ranked_roles AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY CASE role
        WHEN 'editor' THEN 1
        WHEN 'assistant' THEN 2
        ELSE 3
      END, created_at, id
    ) AS position
  FROM public.user_roles
)
DELETE FROM public.user_roles AS role
USING ranked_roles AS ranked
WHERE role.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user_idx
  ON public.user_roles (user_id);

-- Identidade é o nome exibido. "João" e "M. João" podem ser pessoas
-- distintas; "Mestre João" e "M. João" identificam a mesma pessoa.
CREATE OR REPLACE FUNCTION public.member_display_name(p_name text, p_grau text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_grau
    WHEN 'Quadro de Mestre' THEN
      'M. ' || regexp_replace(btrim(p_name), '^(mestre|mestra)[[:space:]]+|^m\.[[:space:]]*', '', 'i')
    WHEN 'Corpo do Conselho' THEN
      'C. ' || regexp_replace(btrim(p_name), '^(conselheiro|conselheira)[[:space:]]+|^c\.[[:space:]]*', '', 'i')
    ELSE p_name
  END;
$$;

CREATE OR REPLACE FUNCTION public.member_identity_key(p_name text, p_grau text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.person_name_key(
    CASE
      WHEN public.member_display_name(p_name, p_grau) ~* '^(mestre|mestra)[[:space:]]+' THEN
        'M. ' || regexp_replace(public.member_display_name(p_name, p_grau), '^(mestre|mestra)[[:space:]]+', '', 'i')
      WHEN public.member_display_name(p_name, p_grau) ~* '^m\.[[:space:]]*' THEN
        'M. ' || regexp_replace(public.member_display_name(p_name, p_grau), '^m\.[[:space:]]*', '', 'i')
      WHEN public.member_display_name(p_name, p_grau) ~* '^(conselheiro|conselheira)[[:space:]]+' THEN
        'C. ' || regexp_replace(public.member_display_name(p_name, p_grau), '^(conselheiro|conselheira)[[:space:]]+', '', 'i')
      WHEN public.member_display_name(p_name, p_grau) ~* '^c\.[[:space:]]*' THEN
        'C. ' || regexp_replace(public.member_display_name(p_name, p_grau), '^c\.[[:space:]]*', '', 'i')
      ELSE public.member_display_name(p_name, p_grau)
    END
  );
$$;

-- Consolidar identificações já duplicadas pela regra anterior. Nenhuma
-- tabela de domínio referencia members.id; sessões guardam nomes em texto.
CREATE TEMP TABLE member_identity_consolidation ON COMMIT DROP AS
SELECT
  id,
  first_value(id) OVER (
    PARTITION BY public.member_identity_key(name, grau)
    ORDER BY CASE grau
      WHEN 'Quadro de Mestre' THEN 1
      WHEN 'Corpo do Conselho' THEN 2
      WHEN 'Corpo Instrutivo' THEN 3
      WHEN 'Quadro de Sócios' THEN 4
      ELSE 5
    END, created_at, id
  ) AS canonical_id
FROM public.members;

WITH consolidated AS (
  SELECT mapping.canonical_id, bool_or(member.is_socio_nucleo) AS is_socio_nucleo
  FROM member_identity_consolidation AS mapping
  JOIN public.members AS member ON member.id = mapping.id
  GROUP BY mapping.canonical_id
)
UPDATE public.members AS member
SET is_socio_nucleo = consolidated.is_socio_nucleo
FROM consolidated
WHERE member.id = consolidated.canonical_id;

DELETE FROM public.members AS duplicate
USING member_identity_consolidation AS mapping
WHERE duplicate.id = mapping.id AND mapping.id <> mapping.canonical_id;

DROP INDEX IF EXISTS public.members_person_name_key_unique_idx;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_name_key;

CREATE UNIQUE INDEX members_identity_key_unique_idx
  ON public.members (public.member_identity_key(name, grau));

CREATE OR REPLACE FUNCTION public.prevent_member_display_name_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.members AS member
    WHERE member.id IS DISTINCT FROM NEW.id
      AND public.member_identity_key(member.name, member.grau) =
          public.member_identity_key(NEW.name, NEW.grau)
  ) THEN
    RAISE EXCEPTION 'Já existe um membro com este nome'
      USING ERRCODE = 'unique_violation',
            CONSTRAINT = 'members_identity_key_unique_idx';
  END IF;

  RETURN NEW;
END;
$$;

-- Armazenar a identificação exibida em sessões novas. Procurar pelo nome
-- bruto confundiria "João" com um mestre João quando há duas pessoas.
CREATE OR REPLACE FUNCTION public.normalize_session_person_names()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.dirigente := COALESCE(
    (SELECT public.member_display_name(name, grau)
     FROM public.members
     WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.dirigente, NULL)
     LIMIT 1),
    public.normalize_person_name(NEW.dirigente)
  );
  NEW.explanador := COALESCE(
    (SELECT public.member_display_name(name, grau)
     FROM public.members
     WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.explanador, NULL)
     LIMIT 1),
    public.normalize_person_name(NEW.explanador)
  );
  NEW.leitor := COALESCE(
    (SELECT public.member_display_name(name, grau)
     FROM public.members
     WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.leitor, NULL)
     LIMIT 1),
    public.normalize_person_name(NEW.leitor)
  );
  NEW.mestre_assistente := COALESCE(
    (SELECT public.member_display_name(name, grau)
     FROM public.members
     WHERE public.member_identity_key(name, grau) = public.member_identity_key(NEW.mestre_assistente, NULL)
     LIMIT 1),
    public.normalize_person_name(NEW.mestre_assistente)
  );
  RETURN NEW;
END;
$$;

-- Antes desta mudança, o nome bruto era único: uma sessão antiga com
-- "João" referia-se ao único membro cadastrado com esse nome. Fixar o
-- prefixo nas sessões existentes antes que "João" e "M. João" possam
-- coexistir evita que o histórico passe a apontar para outra pessoa.
UPDATE public.session AS session
SET dirigente = public.member_display_name(member.name, member.grau)
FROM public.members AS member
WHERE public.person_name_key(session.dirigente) = public.person_name_key(member.name)
  AND session.dirigente IS DISTINCT FROM public.member_display_name(member.name, member.grau);

UPDATE public.session AS session
SET explanador = public.member_display_name(member.name, member.grau)
FROM public.members AS member
WHERE public.person_name_key(session.explanador) = public.person_name_key(member.name)
  AND session.explanador IS DISTINCT FROM public.member_display_name(member.name, member.grau);

UPDATE public.session AS session
SET leitor = public.member_display_name(member.name, member.grau)
FROM public.members AS member
WHERE public.person_name_key(session.leitor) = public.person_name_key(member.name)
  AND session.leitor IS DISTINCT FROM public.member_display_name(member.name, member.grau);

UPDATE public.session AS session
SET mestre_assistente = public.member_display_name(member.name, member.grau)
FROM public.members AS member
WHERE public.person_name_key(session.mestre_assistente) = public.person_name_key(member.name)
  AND session.mestre_assistente IS DISTINCT FROM public.member_display_name(member.name, member.grau);

-- A sala do vegetal precisa só da previsão agregada, sem acesso às sessões.
CREATE OR REPLACE FUNCTION public.get_stock_forecast()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_stock numeric;
  v_session_count bigint;
  v_total_consumed numeric;
  v_first_date timestamptz;
  v_last_date timestamptz;
  v_average_consumption numeric;
  v_frequency_days numeric;
  v_sessions_remaining numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'viewer'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
    OR public.has_role(auth.uid(), 'assistant'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar previsão de estoque'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(sum(quantity), 0)
  INTO v_total_stock
  FROM public.vegetal
  WHERE quantity > 0;

  SELECT count(*),
    COALESCE(sum(CASE
      WHEN consumption->>'total_consumed' ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (consumption->>'total_consumed')::numeric
      ELSE 0
    END), 0),
    min(date), max(date)
  INTO v_session_count, v_total_consumed, v_first_date, v_last_date
  FROM public.session;

  v_average_consumption := CASE WHEN v_session_count > 0
    THEN v_total_consumed / v_session_count ELSE 0 END;
  v_frequency_days := CASE WHEN v_session_count > 1
    THEN COALESCE(NULLIF(
      abs(extract(epoch FROM (v_last_date - v_first_date)) / 86400 / (v_session_count - 1)),
      0
    ), 30)
    ELSE 30
  END;
  v_sessions_remaining := CASE WHEN v_average_consumption > 0
    THEN v_total_stock / v_average_consumption ELSE 0 END;

  RETURN jsonb_build_object(
    'sessions_remaining', v_sessions_remaining,
    'months_remaining', v_sessions_remaining * v_frequency_days / 30.44
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_stock_forecast() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_forecast() TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.session;
DROP POLICY IF EXISTS "Viewers and editors can read sessions" ON public.session;
CREATE POLICY "Viewers and editors can read sessions"
  ON public.session FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'viewer'::public.app_role)
    OR public.has_role(auth.uid(), 'editor'::public.app_role)
  );
