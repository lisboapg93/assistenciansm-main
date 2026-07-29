-- Some existing projects have the application schema but no migration
-- history. Ensure the role used by the registration RPC exists in a separate
-- transaction before the function casts values to this enum.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant';
