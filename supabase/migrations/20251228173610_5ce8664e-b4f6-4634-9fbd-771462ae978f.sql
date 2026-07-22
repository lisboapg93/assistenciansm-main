-- Create members table for autocomplete
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read members" ON public.members FOR SELECT USING (true);
CREATE POLICY "Allow public insert members" ON public.members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update members" ON public.members FOR UPDATE USING (true);

-- Add index for faster name lookups
CREATE INDEX idx_members_name ON public.members (name);

-- Add new fields to vegetal table
ALTER TABLE public.vegetal 
  ADD COLUMN IF NOT EXISTS mensageiro TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_chacrona TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_baticao TEXT;