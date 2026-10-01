-- Keep each inventory change and its ledger row in one transaction. The
-- authenticated client can only change stock through the constrained RPCs.
DROP POLICY IF EXISTS "Editors can insert vegetal" ON public.vegetal;
DROP POLICY IF EXISTS "Editors can update vegetal" ON public.vegetal;
DROP POLICY IF EXISTS "Editors can insert stock_movement" ON public.stock_movement;
DROP POLICY IF EXISTS "Editors can update stock_movement" ON public.stock_movement;
DROP POLICY IF EXISTS "Editors can delete stock_movement" ON public.stock_movement;

REVOKE INSERT, UPDATE, DELETE ON public.vegetal FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stock_movement FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_vegetal_with_movement(p_vegetal jsonb)
RETURNS public.vegetal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vegetal public.vegetal;
  v_name text;
  v_master text;
  v_quantity numeric;
  v_initial_quantity numeric;
  v_envase_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar vegetal';
  END IF;

  IF p_vegetal IS NULL OR jsonb_typeof(p_vegetal) <> 'object' THEN
    RAISE EXCEPTION 'Dados do vegetal inválidos';
  END IF;

  v_name := NULLIF(btrim(p_vegetal->>'name'), '');
  v_master := NULLIF(btrim(p_vegetal->>'master'), '');
  v_quantity := NULLIF(p_vegetal->>'quantity', '')::numeric;
  v_initial_quantity := NULLIF(p_vegetal->>'initial_quantity', '')::numeric;
  v_envase_date := NULLIF(p_vegetal->>'envase_date', '')::date;

  IF v_name IS NULL OR v_master IS NULL OR v_envase_date IS NULL
    OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 99999999.99
    OR v_quantity <> round(v_quantity, 2)
    OR v_initial_quantity IS NULL OR v_initial_quantity <> v_quantity THEN
    RAISE EXCEPTION 'Dados obrigatórios ou quantidade do vegetal inválidos';
  END IF;

  INSERT INTO public.vegetal (
    name, quantity, initial_quantity, envase_date, master, auxiliary,
    mariri_species, chacrona_species, is_archived, registered_by_name,
    mensageiro, responsavel_chacrona, responsavel_baticao
  ) VALUES (
    v_name, v_quantity, v_quantity, v_envase_date, v_master,
    NULLIF(btrim(p_vegetal->>'auxiliary'), ''),
    NULLIF(btrim(p_vegetal->>'mariri_species'), ''),
    NULLIF(btrim(p_vegetal->>'chacrona_species'), ''),
    false,
    NULLIF(btrim(p_vegetal->>'registered_by_name'), ''),
    NULLIF(btrim(p_vegetal->>'mensageiro'), ''),
    NULLIF(btrim(p_vegetal->>'responsavel_chacrona'), ''),
    NULLIF(btrim(p_vegetal->>'responsavel_baticao'), '')
  ) RETURNING * INTO v_vegetal;

  INSERT INTO public.stock_movement (type, quantity, vegetal_id, details)
  VALUES ('Entrada', v_quantity, v_vegetal.id, 'Novo lote cadastrado: ' || v_name);

  RETURN v_vegetal;
END;
$$;

CREATE FUNCTION public.change_vegetal_stock(
  p_vegetal_id uuid,
  p_operation text,
  p_quantity numeric,
  p_expected_quantity numeric,
  p_details text
)
RETURNS public.vegetal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vegetal public.vegetal;
  v_new_quantity numeric;
  v_movement_quantity numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'editor'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão para alterar estoque';
  END IF;

  IF p_quantity IS NULL OR p_quantity > 99999999.99
    OR p_quantity <> round(p_quantity, 2) THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT * INTO v_vegetal
  FROM public.vegetal
  WHERE id = p_vegetal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de vegetal não encontrado';
  END IF;

  IF p_operation = 'Saída' THEN
    IF p_quantity <= 0 OR p_quantity > v_vegetal.quantity THEN
      RAISE EXCEPTION 'Quantidade de saída inválida ou saldo insuficiente';
    END IF;
    v_new_quantity := v_vegetal.quantity - p_quantity;
    v_movement_quantity := p_quantity;
  ELSIF p_operation = 'Ajuste' THEN
    IF p_quantity < 0 THEN
      RAISE EXCEPTION 'Quantidade de ajuste inválida';
    END IF;
    IF p_expected_quantity IS NULL OR p_expected_quantity <> v_vegetal.quantity THEN
      RAISE EXCEPTION 'O saldo foi alterado por outra pessoa. Atualize a página e tente novamente';
    END IF;
    IF p_quantity = v_vegetal.quantity THEN
      RAISE EXCEPTION 'A nova quantidade deve ser diferente do saldo atual';
    END IF;
    v_new_quantity := p_quantity;
    -- Positive adjustment decreases stock; negative adjustment increases it.
    v_movement_quantity := v_vegetal.quantity - p_quantity;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido';
  END IF;

  UPDATE public.vegetal
  SET quantity = v_new_quantity
  WHERE id = v_vegetal.id
  RETURNING * INTO v_vegetal;

  INSERT INTO public.stock_movement (type, quantity, vegetal_id, details)
  VALUES (
    p_operation, v_movement_quantity, v_vegetal.id,
    COALESCE(NULLIF(btrim(p_details), ''), p_operation || ' de estoque')
  );

  RETURN v_vegetal;
END;
$$;

REVOKE ALL ON FUNCTION public.create_vegetal_with_movement(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_vegetal_stock(uuid, text, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vegetal_with_movement(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_vegetal_stock(uuid, text, numeric, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
