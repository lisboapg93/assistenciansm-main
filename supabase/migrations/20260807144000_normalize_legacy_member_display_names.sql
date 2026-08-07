-- Older records may have stored the display prefix as part of the member's
-- name. Keep the name clean; the application adds the degree prefix only when
-- it is displayed.
UPDATE public.members AS member
SET
  name = regexp_replace(btrim(name), '^m\.\s+', '', 'i'),
  chosen_name = regexp_replace(btrim(name), '^m\.\s+', '', 'i')
WHERE member.grau = 'Quadro de Mestre'
  AND member.chosen_name IS NULL
  AND member.name ~* '^m\.\s+'
  AND NOT EXISTS (
    SELECT 1
    FROM public.members AS other_member
    WHERE other_member.id <> member.id
      AND lower(btrim(other_member.name)) = lower(regexp_replace(btrim(member.name), '^m\.\s+', '', 'i'))
  );

UPDATE public.members AS member
SET
  name = regexp_replace(btrim(name), '^c\.\s+', '', 'i'),
  chosen_name = regexp_replace(btrim(name), '^c\.\s+', '', 'i')
WHERE member.grau = 'Corpo do Conselho'
  AND member.chosen_name IS NULL
  AND member.name ~* '^c\.\s+'
  AND NOT EXISTS (
    SELECT 1
    FROM public.members AS other_member
    WHERE other_member.id <> member.id
      AND lower(btrim(other_member.name)) = lower(regexp_replace(btrim(member.name), '^c\.\s+', '', 'i'))
  );

-- Where no separate preferred name was recorded, retain the existing name as
-- the chosen name. This puts every current master and counsellor on the new
-- structure without inventing information that is not available.
UPDATE public.members
SET chosen_name = name
WHERE grau IN ('Quadro de Mestre', 'Corpo do Conselho')
  AND chosen_name IS NULL;
