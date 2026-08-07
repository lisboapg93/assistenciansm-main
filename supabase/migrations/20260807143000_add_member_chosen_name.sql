-- Store the preferred ceremonial name used to identify masters and counsellors.
ALTER TABLE public.members
ADD COLUMN chosen_name text;

ALTER TABLE public.members
ADD CONSTRAINT members_chosen_name_for_supported_graus_check
CHECK (
  chosen_name IS NULL
  OR grau IN ('Quadro de Mestre', 'Corpo do Conselho')
);
