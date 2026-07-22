-- Drop existing INSERT policies and recreate with editor OR assistant
DROP POLICY IF EXISTS "Editors can insert sessions" ON public.session;
DROP POLICY IF EXISTS "Editors can insert stock_movement" ON public.stock_movement;
DROP POLICY IF EXISTS "Editors can insert vegetal" ON public.vegetal;
DROP POLICY IF EXISTS "Editors can insert members" ON public.members;

-- Recreate policies to allow both editor and assistant roles for INSERT
CREATE POLICY "Editors and assistants can insert sessions" 
ON public.session 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'assistant'::app_role));

CREATE POLICY "Editors and assistants can insert stock_movement" 
ON public.stock_movement 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'assistant'::app_role));

CREATE POLICY "Editors and assistants can insert vegetal" 
ON public.vegetal 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'assistant'::app_role));

CREATE POLICY "Editors and assistants can insert members" 
ON public.members 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'assistant'::app_role));

-- Also allow assistant to update vegetal (for stock consumption)
DROP POLICY IF EXISTS "Editors can update vegetal" ON public.vegetal;
CREATE POLICY "Editors and assistants can update vegetal" 
ON public.vegetal 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'assistant'::app_role));