-- Keep member names in a single canonical form so case-only and
-- accent-only variations do not create separate people in reports.
CREATE OR REPLACE FUNCTION public.normalize_person_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(initcap(lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))), '');
$$;

CREATE OR REPLACE FUNCTION public.person_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    lower(public.normalize_person_name(p_name)),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_member_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := public.normalize_person_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_member_name_before_write ON public.members;

CREATE TRIGGER normalize_member_name_before_write
  BEFORE INSERT OR UPDATE OF name ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_member_name();

-- Map every existing case/accent variation to the member record that will be
-- retained. Prefer a spelling with accents and the most complete registration.
CREATE TEMP TABLE member_name_consolidation ON COMMIT DROP AS
WITH normalized_members AS (
  SELECT
    member.id,
    member.name,
    member.is_socio_nucleo,
    member.grau,
    member.created_at,
    public.normalize_person_name(member.name) AS normalized_name,
    public.person_name_key(member.name) AS name_key
  FROM public.members AS member
  WHERE public.person_name_key(member.name) IS NOT NULL
),
canonical_members AS (
  SELECT DISTINCT ON (name_key)
    name_key,
    id AS canonical_member_id,
    normalized_name
  FROM normalized_members
  ORDER BY
    name_key,
    (lower(name) <> translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) DESC,
    is_socio_nucleo DESC,
    (grau IS NOT NULL) DESC,
    created_at,
    id
)
SELECT
  member.id AS member_id,
  canonical.canonical_member_id,
  canonical.normalized_name,
  member.name_key
FROM normalized_members AS member
JOIN canonical_members AS canonical USING (name_key);

-- Normalize historic session names first, then point them to the retained
-- member spelling whenever an equivalent member exists.
UPDATE public.session
SET
  dirigente = public.normalize_person_name(dirigente),
  explanador = public.normalize_person_name(explanador),
  leitor = public.normalize_person_name(leitor),
  mestre_assistente = public.normalize_person_name(mestre_assistente);

UPDATE public.session AS session
SET dirigente = consolidation.normalized_name
FROM member_name_consolidation AS consolidation
WHERE public.person_name_key(session.dirigente) = consolidation.name_key;

UPDATE public.session AS session
SET explanador = consolidation.normalized_name
FROM member_name_consolidation AS consolidation
WHERE public.person_name_key(session.explanador) = consolidation.name_key;

UPDATE public.session AS session
SET leitor = consolidation.normalized_name
FROM member_name_consolidation AS consolidation
WHERE public.person_name_key(session.leitor) = consolidation.name_key;

UPDATE public.session AS session
SET mestre_assistente = consolidation.normalized_name
FROM member_name_consolidation AS consolidation
WHERE public.person_name_key(session.mestre_assistente) = consolidation.name_key;

-- Preserve member attributes before removing duplicate records.
WITH consolidated_attributes AS (
  SELECT
    consolidation.canonical_member_id,
    bool_or(member.is_socio_nucleo) AS is_socio_nucleo,
    (array_agg(member.grau ORDER BY member.created_at) FILTER (WHERE member.grau IS NOT NULL))[1] AS grau
  FROM member_name_consolidation AS consolidation
  JOIN public.members AS member ON member.id = consolidation.member_id
  GROUP BY consolidation.canonical_member_id
)
UPDATE public.members AS member
SET
  is_socio_nucleo = attributes.is_socio_nucleo,
  grau = COALESCE(member.grau, attributes.grau)
FROM consolidated_attributes AS attributes
WHERE member.id = attributes.canonical_member_id;

DELETE FROM public.members AS duplicate
USING member_name_consolidation AS consolidation
WHERE duplicate.id = consolidation.member_id
  AND consolidation.member_id <> consolidation.canonical_member_id;

UPDATE public.members AS member
SET name = consolidation.normalized_name
FROM (
  SELECT DISTINCT canonical_member_id, normalized_name
  FROM member_name_consolidation
) AS consolidation
WHERE member.id = consolidation.canonical_member_id;

-- Sessions can be entered as free text. Reuse the canonical member spelling
-- on every write so those values keep feeding reports as one person.
CREATE OR REPLACE FUNCTION public.normalize_session_person_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dirigente := COALESCE(
    (SELECT name FROM public.members WHERE public.person_name_key(name) = public.person_name_key(NEW.dirigente) LIMIT 1),
    public.normalize_person_name(NEW.dirigente)
  );
  NEW.explanador := COALESCE(
    (SELECT name FROM public.members WHERE public.person_name_key(name) = public.person_name_key(NEW.explanador) LIMIT 1),
    public.normalize_person_name(NEW.explanador)
  );
  NEW.leitor := COALESCE(
    (SELECT name FROM public.members WHERE public.person_name_key(name) = public.person_name_key(NEW.leitor) LIMIT 1),
    public.normalize_person_name(NEW.leitor)
  );
  NEW.mestre_assistente := COALESCE(
    (SELECT name FROM public.members WHERE public.person_name_key(name) = public.person_name_key(NEW.mestre_assistente) LIMIT 1),
    public.normalize_person_name(NEW.mestre_assistente)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_session_person_names_before_write ON public.session;

CREATE TRIGGER normalize_session_person_names_before_write
  BEFORE INSERT OR UPDATE OF dirigente, explanador, leitor, mestre_assistente ON public.session
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_session_person_names();
