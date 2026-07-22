-- Add grau column to members table
ALTER TABLE public.members 
ADD COLUMN grau text DEFAULT NULL;

-- Add check constraint for valid values
ALTER TABLE public.members 
ADD CONSTRAINT members_grau_check 
CHECK (grau IS NULL OR grau IN ('Quadro de Mestre', 'Corpo do Conselho', 'Corpo Instrutivo', 'Quadro de Sócios'));