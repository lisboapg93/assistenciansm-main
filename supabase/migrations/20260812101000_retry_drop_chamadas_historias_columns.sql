-- migration 20260723120000_remove_chamadas_historias_from_sessions.sql is
-- recorded as applied in the migration history, but a schema audit found
-- `session.chamadas`/`session.historias` still present on the live database
-- (confirmed via `supabase gen types`, which introspects live schema).
-- Nothing in src/ reads or writes these columns. Re-run the drop; IF EXISTS
-- makes this a no-op if they somehow are already gone.
DROP INDEX IF EXISTS public.session_no_duplicate_logical_record_idx;

ALTER TABLE public.session
  DROP COLUMN IF EXISTS chamadas,
  DROP COLUMN IF EXISTS historias;

CREATE UNIQUE INDEX IF NOT EXISTS session_no_duplicate_logical_record_idx
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
