-- Remover política restritiva de leitura
DROP POLICY IF EXISTS "Editors can read stock_movement" ON public.stock_movement;

-- Criar política de leitura para todos os usuários autenticados (apenas visualização)
CREATE POLICY "Authenticated users can read stock_movement" 
ON public.stock_movement 
FOR SELECT 
USING (auth.uid() IS NOT NULL);