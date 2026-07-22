-- Add new 'assistant' role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant';

-- Update the role for assistente@gmail.com user (if exists)
-- This will be done via the setup-users function or manually