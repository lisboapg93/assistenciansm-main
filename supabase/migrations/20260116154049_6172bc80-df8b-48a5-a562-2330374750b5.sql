-- Remover política permissiva de leitura
DROP POLICY IF EXISTS "Authenticated users can read stock_movement" ON public.stock_movement;

-- Criar política restritiva: apenas editores podem ver movimentações de estoque
CREATE POLICY "Editors can read stock_movement" 
ON public.stock_movement 
FOR SELECT 
USING (has_role(auth.uid(), 'editor'::app_role));