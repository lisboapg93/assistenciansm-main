-- A UI compara nomes em NFD, sem as marcas U+0300–U+036F. O translate
-- anterior tratava apenas letras já compostas: "João" e "Joa\u0303o" podiam
-- gerar identidades diferentes no banco.
--
-- A definição IMMUTABLE é usada pelo índice de identidades. O bloco único
-- mantém a função, a verificação e a reconstrução do índice atômicas até
-- quando a migration é executada sem uma transação externa.
DO $migration$
DECLARE
  v_collision_count bigint;
  v_example_ids text;
BEGIN
  -- Impede alterações de membros entre a verificação e a criação do índice.
  LOCK TABLE public.members IN ACCESS EXCLUSIVE MODE;

  -- Não consulte o índice com as chaves antigas após trocar a função.
  DROP INDEX public.members_identity_key_unique_idx;

  EXECUTE $definition$
    CREATE OR REPLACE FUNCTION public.person_name_key(p_name text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    SET search_path = ''
    AS $function$
      SELECT NULLIF(lower(regexp_replace(
        normalize(regexp_replace(btrim(p_name), '\s+', ' ', 'g'), NFD),
        U&'[\0300-\036f]', '', 'g'
      )), '');
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
    -- O grau e o vínculo ao núcleo podem divergir. Não há escolha automática
    -- segura de cadastro a manter; abortar preserva todos os seus atributos,
    -- os nomes históricos e a definição/índice anteriores.
    RAISE EXCEPTION 'Normalização Unicode encontrou % grupo(s) de membros duplicados', v_collision_count
      USING ERRCODE = 'unique_violation',
        CONSTRAINT = 'members_identity_key_unique_idx',
        DETAIL = 'IDs de um grupo conflitante: ' || v_example_ids,
        HINT = 'Revise os cadastros conflitantes preservando grau, vínculo ao núcleo e histórico; depois reaplique a migration.';
  END IF;

  -- member_identity_key preserva M./C. como parte da identidade. Apenas as
  -- chaves são recalculadas; nomes, atributos e sessões não são reescritos.
  CREATE UNIQUE INDEX members_identity_key_unique_idx
    ON public.members (public.member_identity_key(name, grau));
END;
$migration$;

NOTIFY pgrst, 'reload schema';
