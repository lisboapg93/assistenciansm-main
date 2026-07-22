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
npm ci
npm run dev       # servidor Vite em http://localhost:3000
npm run build
npm run lint
npm run preview
```

O projeto não inclui uma suíte de testes automatizados no momento. Valide manualmente os fluxos alterados antes de entregar uma mudança.

## Configuração local

O cliente do Supabase depende das variáveis abaixo, lidas pelo Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nunca inclua valores reais dessas variáveis em commits, logs, documentação ou mensagens de erro. Não edite manualmente `src/integrations/supabase/types.ts`, pois esse arquivo é gerado a partir do schema do Supabase.

## Estrutura relevante

- `src/pages/`: telas da aplicação.
- `src/components/`: componentes reutilizáveis e componentes de interface.
- `src/components/ui/`: componentes base do shadcn/ui; evite alterações amplas sem necessidade.
- `src/hooks/`: acesso a dados e lógica de domínio para sessões, membros, estoque e estatísticas.
- `src/contexts/AuthContext.tsx`: autenticação, papel do usuário e permissões.
- `src/lib/`: utilitários compartilhados de data, exportação e formatação.
- `src/constants/`: constantes de domínio compartilhadas entre telas e formulários.
- `src/integrations/supabase/`: cliente e tipos gerados do Supabase.
- `src/types/database.ts`: tipos auxiliares do domínio.
- `supabase/migrations/`: migrations versionadas do banco de dados.

O acesso ao Supabase deve permanecer concentrado nos hooks de domínio sempre que possível. Após mutações, invalide as chaves relacionadas do React Query e apresente feedback de sucesso ou erro ao usuário.

## Rotas e permissões

As rotas ficam em `src/App.tsx` e são protegidas por `ProtectedRoute`. Os papéis válidos são `viewer`, `editor` e `assistant`.

| Rota | Viewer | Editor | Assistant |
| --- | --- | --- | --- |
| `/dashboard` | Sim | Sim | Não |
| `/estoque` | Sim | Sim | Sim |
| `/estoque/novo` | Não | Sim | Não |
| `/sessao/nova` | Não | Sim | Sim |
| `/sessao/editar/:id` | Não | Sim | Não |
| `/historico` | Sim | Sim | Não |
| `/relatorios` | Sim | Sim | Não |
| `/membros` | Não | Sim | Não |

Usuários não autenticados são enviados para `/`. Assistentes que tentarem acessar uma rota bloqueada são enviados para `/sessao/nova`. A sessão expira após 30 minutos sem atividade.

Ao alterar uma tela ou rota, preserve essas restrições ou atualize o modelo de permissões de forma explícita e consistente com o `AuthContext`.

## Diretrizes de desenvolvimento

- Prefira componentes e utilitários já existentes antes de adicionar novas dependências.
- Mantenha os aliases `@/` para importações a partir de `src/`.
- Preserve a segurança de tipos, mesmo que o projeto ainda esteja com `strict: false`; não introduza novos `any`. Ao tocar em um `any` legado, substitua-o por um tipo específico quando isso puder ser feito sem ampliar indevidamente o escopo.
- Preserve a interface em português e o formato de datas local (`pt-BR`) já utilizado pelo projeto.
- Para operações assíncronas, mantenha tratamento de erro e mensagens claras ao usuário.
- Não exponha nem altere valores sensíveis de `.env`. O cliente Supabase deve continuar usando variáveis de ambiente.
- Preserve as chaves de cache e o padrão de invalidação do React Query ao alterar consultas ou mutações.
- Use `src/lib/date.ts` para regras compartilhadas de datas e evite conversões que mudem o dia por causa do fuso horário.
- Para mudanças no banco, crie uma nova migration em `supabase/migrations/`; não reescreva migrations já aplicadas.

## Checklist antes de concluir

1. Rode `npm run build`.
2. Rode `npm run lint`.
3. Verifique manualmente login, logout, expiração por inatividade e o fluxo funcional alterado.
4. Confirme as permissões de `viewer`, `editor` e `assistant`, incluindo redirecionamentos.
5. Se houver alteração de schema, revise as políticas e tipos do Supabase relacionados.