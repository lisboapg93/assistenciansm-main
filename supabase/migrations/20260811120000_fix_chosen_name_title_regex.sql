-- The duplicate-detection trigger stripped only "mestre" and
-- "conselheiro"/"conselheira" titles, missing the "M."/"C." abbreviation
-- that the client already recognizes. This made the database-side check
-- disagree with the display name computed in the app
-- (src/lib/memberDisplay.ts), so a chosen name typed with the abbreviated
-- prefix (e.g. "M. João Silva") was not matched against an equivalent
-- existing member. Align the regex with the client so both layers treat the
-- same names as duplicates. (There is no "Mestra"/"Mestro" variant: the
-- feminine title for this degree is "Conselheira".)
CREATE OR REPLACE FUNCTION public.prevent_member_display_name_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.members AS member
    WHERE member.id IS DISTINCT FROM NEW.id
      AND (
        public.person_name_key(member.name) = public.person_name_key(NEW.name)
        OR public.person_name_key(
          CASE member.grau
            WHEN 'Quadro de Mestre' THEN
              'M. ' || regexp_replace(member.chosen_name, '^(mestre|m\.)\s*', '', 'i')
            WHEN 'Corpo do Conselho' THEN
              'C. ' || regexp_replace(member.chosen_name, '^(conselheiro|conselheira|c\.)\s*', '', 'i')
            ELSE NULL
          END
        ) = public.person_name_key(NEW.name)
      )
  ) THEN
    RAISE EXCEPTION 'Já existe um membro com este nome'
      USING ERRCODE = 'unique_violation',
            CONSTRAINT = 'members_person_name_key_unique_idx';
  END IF;

  RETURN NEW;
END;
$$;
