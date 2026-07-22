# Assistência NSM

Aplicação web responsiva para administrar sessões, membros, estoque e relatórios da Assistência NSM.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS e componentes shadcn/ui (Radix UI)
- React Router
- TanStack React Query
- Supabase (autenticação e banco de dados)
- Recharts e Papa Parse

## Comandos

```bash
npm install
npm run dev
npm run build
npm run lint
```

O projeto não inclui uma suíte de testes automatizados no momento. Valide manualmente os fluxos alterados antes de entregar uma mudança.

## Estrutura relevante

- `src/pages/`: telas da aplicação.
- `src/components/`: componentes reutilizáveis e componentes de interface.
- `src/components/ui/`: componentes base do shadcn/ui; evite alterações amplas sem necessidade.
- `src/hooks/`: acesso a dados e lógica de domínio para sessões, membros, estoque e estatísticas.
- `src/contexts/AuthContext.tsx`: autenticação, papel do usuário e permissões.
- `src/integrations/supabase/`: cliente e tipos gerados do Supabase.
- `src/types/database.ts`: tipos auxiliares do domínio.
- `supabase/migrations/`: migrations versionadas do banco de dados.

## Rotas e permissões

As rotas ficam em `src/App.tsx` e são protegidas por `ProtectedRoute`.

- Usuários não autenticados são enviados para `/`.
- Editores acessam operações administrativas, como criar entradas no estoque e gerenciar membros.
- Assistentes podem criar sessões, mas são bloqueados do dashboard, histórico e relatórios.

Ao alterar uma tela ou rota, preserve essas restrições ou atualize o modelo de permissões de forma explícita e consistente com o `AuthContext`.

## Diretrizes de desenvolvimento

- Prefira componentes e utilitários já existentes antes de adicionar novas dependências.
- Mantenha os aliases `@/` para importações a partir de `src/`.
- Use TypeScript estrito; evite introduzir `any`. Se houver um `any` legado, tente substituí-lo por um tipo específico quando tocar no código.
- Preserve a interface em português e o formato de datas local (`pt-BR`) já utilizado pelo projeto.
- Para operações assíncronas, mantenha tratamento de erro e mensagens claras ao usuário.
- Não exponha nem altere valores sensíveis de `.env`. O cliente Supabase deve continuar usando variáveis de ambiente.
- Para mudanças no banco, crie uma nova migration em `supabase/migrations/`; não reescreva migrations já aplicadas.

## Checklist antes de concluir

1. Rode `npm run build`.
2. Rode `npm run lint`.
3. Verifique manualmente o fluxo de autenticação e o fluxo funcional alterado.
4. Confirme que as permissões de editor e assistente continuam corretas.
5. Se houver alteração de schema, revise as políticas e tipos do Supabase relacionados.
