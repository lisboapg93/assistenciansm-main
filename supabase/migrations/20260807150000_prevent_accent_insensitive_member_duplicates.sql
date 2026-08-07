-- A member's name identifies the person. Treat changes in case, whitespace or
-- accents as the same name, including writes that do not pass through the UI.
CREATE UNIQUE INDEX IF NOT EXISTS members_person_name_key_unique_idx
ON public.members (public.person_name_key(name));

-- The existing display-name guard previously cancelled inserts silently. Raise
-- a constraint error instead so the client can give the user clear feedback.
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
              'M. ' || regexp_replace(member.chosen_name, '^(mestre|mestra)\.?\s+', '', 'i')
            WHEN 'Corpo do Conselho' THEN
              'C. ' || regexp_replace(member.chosen_name, '^(conselheiro|conselheira)\.?\s+', '', 'i')
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

DROP TRIGGER IF EXISTS prevent_member_display_name_duplicates_before_insert ON public.members;

CREATE TRIGGER prevent_member_display_name_duplicates_before_write
BEFORE INSERT OR UPDATE OF name, chosen_name, grau ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_member_display_name_duplicates();
