-- Permite que o Histórico receba em tempo real sessões cadastradas por
-- qualquer perfil autenticado. A RLS de SELECT continua controlando quais
-- linhas cada conexão pode receber.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session;
  END IF;
END;
$$;
