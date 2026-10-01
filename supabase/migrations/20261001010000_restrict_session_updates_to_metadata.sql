-- Editar uma sessão altera apenas metadados e participantes. Impedir que
-- clientes editem o consumo diretamente preserva a relação com o estoque e
-- com o livro de movimentações criado pela RPC de registro.
REVOKE UPDATE ON TABLE public.session FROM PUBLIC, anon, authenticated;

GRANT UPDATE (
  date, type, dirigente, explanador, leitor, mestre_assistente,
  observation, participants, total_participants, has_photo, has_audio
) ON TABLE public.session TO authenticated;
