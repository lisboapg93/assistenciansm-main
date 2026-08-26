-- reverse_session_consumption() inserted 'Ajuste' stock_movement rows with
-- the opposite sign convention used everywhere else in the app
-- (src/hooks/useVegetais.ts: positive Ajuste quantity = stock decreased,
-- negative = increased — see its comment "Saídas são positivas. No ajuste,
-- um valor negativo representa acréscimo."). That mismatch made
-- src/pages/Relatorios.tsx's stock charts classify a session-delete restock
-- (a stock increase) as a saída and a saldo-reversal (a stock decrease) as
-- an entrada. Fix the trigger going forward and correct the rows it already
-- wrote with the wrong sign.

CREATE OR REPLACE FUNCTION public.reverse_session_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement record;
BEGIN
  -- Restore quantity consumed from each vegetal source used by the session.
  FOR v_movement IN
    SELECT vegetal_id, sum(quantity) AS quantity
    FROM public.stock_movement
    WHERE session_id = OLD.id
      AND type = 'Consumo'
      AND vegetal_id IS NOT NULL
    GROUP BY vegetal_id
  LOOP
    UPDATE public.vegetal
    SET quantity = quantity + v_movement.quantity
    WHERE id = v_movement.vegetal_id;

    IF FOUND THEN
      INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
      VALUES ('Ajuste', -v_movement.quantity, v_movement.vegetal_id, OLD.id, 'Estorno por exclusão de sessão');
    END IF;
  END LOOP;

  -- A united session may have created a leftover-balance vegetal ('Saldo'
  -- movement). Reverse that addition too, but refuse to delete the session
  -- if the balance has already been partially consumed elsewhere, since the
  -- reversal would otherwise leave the ledger inconsistent.
  FOR v_movement IN
    SELECT sm.vegetal_id, sm.quantity, v.quantity AS current_quantity
    FROM public.stock_movement sm
    JOIN public.vegetal v ON v.id = sm.vegetal_id
    WHERE sm.session_id = OLD.id
      AND sm.type = 'Saldo'
      AND sm.vegetal_id IS NOT NULL
  LOOP
    IF v_movement.current_quantity < v_movement.quantity THEN
      RAISE EXCEPTION 'Não é possível excluir: o saldo do vegetal unido já foi parcialmente consumido em outra sessão';
    END IF;

    UPDATE public.vegetal
    SET quantity = quantity - v_movement.quantity
    WHERE id = v_movement.vegetal_id;

    INSERT INTO public.stock_movement (type, quantity, vegetal_id, session_id, details)
    VALUES ('Ajuste', v_movement.quantity, v_movement.vegetal_id, OLD.id, 'Estorno de saldo por exclusão de sessão');
  END LOOP;

  RETURN OLD;
END;
$$;

-- Correct historical rows this trigger already wrote with the inverted sign.
-- Both detail strings are only ever written by this trigger, so negating
-- them is safe and exactly reverses the mistake.
UPDATE public.stock_movement
SET quantity = -quantity
WHERE type = 'Ajuste'
  AND details IN ('Estorno por exclusão de sessão', 'Estorno de saldo por exclusão de sessão');
