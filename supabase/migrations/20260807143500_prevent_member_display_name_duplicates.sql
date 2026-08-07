-- Session forms save the public identification (for example, "M. Marcio Cruz").
-- Do not create a second member when that identification already belongs to an
-- existing master or counsellor.
CREATE OR REPLACE FUNCTION public.prevent_member_display_name_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.members AS member
    WHERE lower(btrim(member.name)) = lower(btrim(NEW.name))
      OR lower(
        CASE member.grau
          WHEN 'Quadro de Mestre' THEN
            'M. ' || regexp_replace(member.chosen_name, '^(mestre|mestra)\.?\s+', '', 'i')
          WHEN 'Corpo do Conselho' THEN
            'C. ' || regexp_replace(member.chosen_name, '^(conselheiro|conselheira)\.?\s+', '', 'i')
          ELSE NULL
        END
      ) = lower(btrim(NEW.name))
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_member_display_name_duplicates_before_insert
BEFORE INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_member_display_name_duplicates();
