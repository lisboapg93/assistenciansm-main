-- Remove duplicated session rows created by repeated submissions and reverse their stock consumption.
WITH duplicate_groups AS (
  SELECT
    array_agg(id ORDER BY created_at, id) AS ids
  FROM public.session
  GROUP BY
    date,
    type,
    lower(btrim(dirigente)),
    lower(btrim(coalesce(mestre_assistente, ''))),
    lower(btrim(coalesce(explanador, ''))),
    lower(btrim(coalesce(leitor, ''))),
    total_participants,
    coalesce(consumption->>'total_consumed', ''),
    coalesce(chamadas, ''),
    coalesce(historias, ''),
    coalesce(observation, ''),
    has_photo,
    has_audio
  HAVING count(*) > 1
), duplicate_sessions AS (
  SELECT unnest(ids[2:array_length(ids, 1)]) AS session_id
  FROM duplicate_groups
), reversed_consumption AS (
  SELECT
    sm.vegetal_id,
    sum(sm.quantity) AS quantity_to_restore
  FROM public.stock_movement sm
  JOIN duplicate_sessions ds ON ds.session_id = sm.session_id
  WHERE sm.type = 'Consumo'
    AND sm.vegetal_id IS NOT NULL
  GROUP BY sm.vegetal_id
), restore_stock AS (
  UPDATE public.vegetal v
  SET quantity = v.quantity + rc.quantity_to_restore
  FROM reversed_consumption rc
  WHERE v.id = rc.vegetal_id
  RETURNING v.id
), delete_duplicate_movements AS (
  DELETE FROM public.stock_movement sm
  USING duplicate_sessions ds
  WHERE sm.session_id = ds.session_id
  RETURNING sm.id
)
DELETE FROM public.session s
USING duplicate_sessions ds
WHERE s.id = ds.session_id;

-- Prevent the same logical session from being saved more than once.
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
  (coalesce(chamadas, '')),
  (coalesce(historias, '')),
  (coalesce(observation, '')),
  has_photo,
  has_audio
);