-- Trata espaços que btrim() não remove e compõe nomes Unicode antes de
-- capitalizá-los. Assim tab, CR/LF e NBSP não viram membros vazios nem
-- identidades diferentes; NFD também não produz "JoãO" na exibição.
DO $migration$
DECLARE
  v_collision_count bigint;
  v_example_ids text;
BEGIN
  LOCK TABLE public.members IN ACCESS EXCLUSIVE MODE;

  DROP INDEX public.members_identity_key_unique_idx;

  EXECUTE $definition$
    CREATE OR REPLACE FUNCTION public.normalize_person_name(p_name text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    SET search_path = ''
    AS $function$
      SELECT NULLIF(array_to_string(ARRAY(
        SELECT upper(translate(left(part, 1),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ'
        )) || lower(translate(substr(part, 2),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'áàâãäéèêëíìîïóòôõöúùûüçñ'
        ))
        FROM unnest(regexp_split_to_array(
          btrim(regexp_replace(
            translate(normalize(p_name, NFC),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'áàâãäéèêëíìîïóòôõöúùûüçñ'
            ),
            U&'[\0009\000A\000B\000C\000D\0020\00A0]+',
            ' ',
            'g'
          )),
          ' '
        )) AS parts(part)
      ), ' '), '');
    $function$;
  $definition$;

  EXECUTE $definition$
    CREATE OR REPLACE FUNCTION public.person_name_key(p_name text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    SET search_path = ''
    AS $function$
      SELECT NULLIF(lower(regexp_replace(
        normalize(public.normalize_person_name(p_name), NFD),
        U&'[\0300-\036F]',
        '',
        'g'
      )), '');
    $function$;
  $definition$;

  EXECUTE $definition$
    CREATE OR REPLACE FUNCTION public.member_display_name(p_name text, p_grau text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    SET search_path = ''
    AS $function$
      SELECT CASE p_grau
        WHEN 'Quadro de Mestre' THEN
          'M. ' || regexp_replace(public.normalize_person_name(p_name),
            '^(mestre|mestra)[[:space:]]+|^m\.[[:space:]]*', '', 'i')
        WHEN 'Corpo do Conselho' THEN
          'C. ' || regexp_replace(public.normalize_person_name(p_name),
            '^(conselheiro|conselheira)[[:space:]]+|^c\.[[:space:]]*', '', 'i')
        ELSE public.normalize_person_name(p_name)
      END;
    $function$;
  $definition$;

  SELECT count(*), min(collision.ids)
  INTO v_collision_count, v_example_ids
  FROM (
    SELECT string_agg(id::text, ', ' ORDER BY created_at, id) AS ids
    FROM public.members
    WHERE public.member_identity_key(name, grau) IS NOT NULL
    GROUP BY public.member_identity_key(name, grau)
    HAVING count(*) > 1
  ) AS collision;

  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'Normalização de espaços encontrou % grupo(s) de membros duplicados', v_collision_count
      USING ERRCODE = 'unique_violation',
        CONSTRAINT = 'members_identity_key_unique_idx',
        DETAIL = 'IDs de um grupo conflitante: ' || v_example_ids,
        HINT = 'Revise os cadastros conflitantes antes de reaplicar a migration.';
  END IF;

  CREATE UNIQUE INDEX members_identity_key_unique_idx
    ON public.members (public.member_identity_key(name, grau));
END;
$migration$;

CREATE OR REPLACE FUNCTION public.normalize_member_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.name := public.normalize_person_name(NEW.name);
  IF NEW.name IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do membro';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_member_name() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_person_members(p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT DISTINCT public.normalize_person_name(name)
    FROM unnest(p_names) AS names(name)
    WHERE public.normalize_person_name(name) IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.members
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

CREATE OR REPLACE FUNCTION public.require_session_registered_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.registered_by_name := public.normalize_person_name(NEW.registered_by_name);

  IF NEW.registered_by_name IS NULL
    AND (TG_OP = 'INSERT' OR NEW.registered_by_name IS DISTINCT FROM OLD.registered_by_name) THEN
    RAISE EXCEPTION 'Informe quem registrou a sessão';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_session_registered_by() FROM PUBLIC, anon, authenticated;

-- `Ajuste` é deliberadamente assinado: negativo aumenta estoque e positivo
-- reduz. Os demais movimentos nunca podem ter quantidade negativa.
ALTER TABLE public.vegetal
  ADD CONSTRAINT vegetal_quantity_nonnegative CHECK (quantity >= 0) NOT VALID;

ALTER TABLE public.stock_movement
  ADD CONSTRAINT stock_movement_nonnegative_except_adjustment
  CHECK (type = 'Ajuste' OR quantity >= 0) NOT VALID;

NOTIFY pgrst, 'reload schema';
