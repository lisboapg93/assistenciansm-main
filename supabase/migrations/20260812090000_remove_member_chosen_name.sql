-- The ceremonial display name (e.g. "M. José") is now derived only from
-- `name` + `grau`; there is no longer a separate "conhecido como" field.
-- Align the duplicate-detection trigger with this and drop the column.
--
-- The comparison strips a title/abbreviation already present in `name`
-- ("Mestre "/"M." or "Conselheiro(a) "/"C.") before re-adding the display
-- prefix, mirroring src/lib/memberDisplay.ts, so a record already stored as
-- "M. João Silva" is not double-prefixed into "M. M. João Silva" when
-- computing its comparison key.

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
        -- Raw-name collision. Already covered by members_person_name_key_unique_idx;
        -- kept here so this trigger raises the friendlier message below instead of
        -- Postgres's raw unique-violation text. Not dead code.
        public.person_name_key(member.name) = public.person_name_key(NEW.name)
        OR public.person_name_key(
          CASE member.grau
            WHEN 'Quadro de Mestre' THEN
              'M. ' || regexp_replace(member.name, '^(mestre|m\.)\s*', '', 'i')
            WHEN 'Corpo do Conselho' THEN
              'C. ' || regexp_replace(member.name, '^(conselheiro|conselheira|c\.)\s*', '', 'i')
            ELSE NULL
          END
        ) = public.person_name_key(NEW.name)
        OR public.person_name_key(member.name) = public.person_name_key(
          CASE NEW.grau
            WHEN 'Quadro de Mestre' THEN
              'M. ' || regexp_replace(NEW.name, '^(mestre|m\.)\s*', '', 'i')
            WHEN 'Corpo do Conselho' THEN
              'C. ' || regexp_replace(NEW.name, '^(conselheiro|conselheira|c\.)\s*', '', 'i')
            ELSE NULL
          END
        )
      )
  ) THEN
    RAISE EXCEPTION 'Já existe um membro com este nome'
      USING ERRCODE = 'unique_violation',
            CONSTRAINT = 'members_person_name_key_unique_idx';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_member_display_name_duplicates_before_write ON public.members;

CREATE TRIGGER prevent_member_display_name_duplicates_before_write
BEFORE INSERT OR UPDATE OF name, grau ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_member_display_name_duplicates();

ALTER TABLE public.members
DROP CONSTRAINT IF EXISTS members_chosen_name_for_supported_graus_check;

ALTER TABLE public.members
DROP COLUMN IF EXISTS chosen_name;
