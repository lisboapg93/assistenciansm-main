-- Add column to track if member is a "Sócio do Núcleo"
ALTER TABLE public.members
ADD COLUMN is_socio_nucleo boolean NOT NULL DEFAULT false;