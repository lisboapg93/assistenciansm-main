-- Chamadas e histórias deixaram de fazer parte do registro de sessões.
-- O índice de duplicidade dependia dessas colunas e precisa ser recriado.
DROP INDEX IF EXISTS public.session_no_duplicate_logical_record_idx;

ALTER TABLE public.session
  DROP COLUMN IF EXISTS chamadas,
  DROP COLUMN IF EXISTS historias;

CREATE UNIQUE INDEX session_no_duplicate_logical_record_idx
ON public.session (
  date,
  type,
  lower(btrim(dirigente)),
  lower(btrim(coalesce(mestre_assistente, ''))),
  lower(btrim(coalesce(explanador, ''))),
  lower(btrim(coalesce(leitor, ''))),
  total_participants,
  (coalesce(consumption->>'total_consumed', '')),
  (coalesce(observation, '')),
  has_photo,
  has_audio
);
