# Assistência NSM

Aplicação web responsiva para administrar sessões, membros, lotes de vegetal,
movimentações de estoque e relatórios da Assistência NSM.

## Stack e comandos

- React 18 + TypeScript, Vite e React Router.
- Tailwind CSS, shadcn/ui (Radix UI), Lucide e `next-themes`.
- TanStack React Query para cache e mutações.
- Supabase para autenticação, banco, RLS e RPCs.
- Recharts para relatórios, Papa Parse para importação CSV e
  `write-excel-file` para exportação XLSX.

```bash
npm ci
npm run dev       # Vite em http://localhost:3000
npm run build
npm run lint
npm run preview
```

Não há suíte automatizada de testes. Para alterações de código, rode `npm run
build` e `npm run lint`, e valide manualmente o fluxo alterado e suas
permissões.

## Configuração e segurança

O cliente Supabase depende de `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY`, lidas pelo Vite. Nunca exponha valores reais
dessas variáveis em commits, logs, documentação ou mensagens de erro.

- Não edite manualmente `src/integrations/supabase/types.ts`: ele é gerado do
  schema do Supabase.
- `supabase/migrations/` é a fonte versionada das mudanças de schema, RLS,
  triggers e RPCs. Crie uma migration nova; não reescreva uma já aplicada.
- `local-db/schema.sql` serve apenas para testes manuais locais dos dados de
  domínio. Não substitui autenticação, RLS nem RPCs do Supabase e pode não
  acompanhar a migration mais recente.
- Registre erros de operações do Supabase com `logAndThrow` ou
  `logApplicationError`, em `src/lib/errorLogging.ts`; o RPC persiste os
  registros em `error_logs` sem ocultar o erro original.

## Estrutura e responsabilidades

- `src/App.tsx`: providers globais, carregamento preguiçoso das páginas e
  proteção de rotas.
- `src/contexts/AuthContext.tsx`: sessão Supabase, papel do usuário e expiração
  após 30 minutos de inatividade, sincronizada entre abas.
- `src/pages/`: telas. `NovaSessao` é um fluxo em quatro etapas; `EditarSessao`
  altera metadados/participantes, sem refazer consumo; `Historico` filtra,
  pagina, importa CSV, exporta backup XLSX e permite exclusão; `Relatorios`
  mostra estatísticas e evolução do estoque.
- `src/hooks/`: consultas e mutações por domínio. Preserve as query keys e
  invalide as chaves relacionadas após mutações.
- `src/lib/sessionRegistration.ts`: único caminho cliente para criar sessão
  com consumo. Chama a RPC transacional `register_session_with_consumption`.
- `src/lib/sessionRoleEligibility.ts`: regras de elegibilidade e de não
  duplicidade entre funções da sessão.
- `src/lib/memberDisplay.ts`: normalização, comparação e prefixos visuais
  (`M.`/`C.`) de nomes. Use estes utilitários em vez de recriar as regras.
- `src/lib/date.ts`: use para datas-calendário, filtros e exibição local;
  evite `toISOString()` para derivar uma data local.
- `src/components/session/CsvImportDialog.tsx`: importação de sessões.
- `src/components/vegetal/VegetalDetailModal.tsx`: detalhes e movimentações de
  um lote. Evite alterações amplas nos componentes base em `src/components/ui/`.

Mantenha aliases `@/` para importações a partir de `src/`. Preserve a UI em
português e datas em `pt-BR`. Não introduza `any`; se tocar em um `any` legado,
prefira estreitá-lo para um tipo específico quando o escopo permitir.

## Domínio e invariantes

### Sessões e estoque

- Tipos e grupos de participantes estão em `src/types/database.ts`.
- Uma nova sessão exige tipo, data, dirigente, mestre assistente, participantes
  e consumo válido. Alguns tipos também exigem explanador e leitor.
- As funções são validadas contra o grau do membro. Não permita a mesma pessoa
  em mais de uma entre dirigente, segundo dirigente, explanador e leitor.
- Transmissão da Assistência vale para Primeira Escala, Segunda Escala e Extra;
  exige segundo dirigente e limita ambos os dirigentes ao Quadro de Mestre. A
  informação é persistida no texto de observação.
- Criação com consumo deve sempre passar por
  `registerSessionWithConsumption`. A RPC valida autorização (`editor` ou
  `assistant`), fontes, saldo e unicidade, bloqueia os lotes, cria sessão e
  ledger, abate estoque e cria lote de saldo quando houver união. Não adicione
  `INSERT` direto em `session` para substituir essa operação.
- A exclusão de sessão aciona trigger no banco que reverte o consumo e invalida
  sessões, vegetais e movimentações. Não contorne esse fluxo.
- Atualizações de quantidade de vegetal usam trava otimista e devem criar a
  movimentação correspondente. Quantidades de `Saída` são positivas; em
  `Ajuste`, valor negativo representa acréscimo.
- Não há exclusão de lote na UI e a RLS não a permite: isso preserva a
  rastreabilidade do ledger.

### Membros

- Cada membro tem `name`, `grau` e `is_socio_nucleo`.
- O nome de exibição é derivado de `name` e `grau`; não existe mais campo de
  apelido/conhecido como.
- O banco normaliza nomes e impede duplicatas inclusive sem distinção de
  acentos e entre formas exibidas. Trate violação de unicidade com mensagem
  clara ao usuário.

## Rotas e permissões

As rotas são protegidas por `ProtectedRoute` em `src/App.tsx`. Os papéis são
`viewer`, `editor` e `assistant`.

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

Não autenticados são enviados a `/`. Assistentes enviados a uma rota negada
vão para `/sessao/nova`; outros usuários sem permissão de editor são enviados
ao dashboard. A UI é uma camada de experiência: mantenha as políticas RLS e
as permissões da RPC alinhadas a qualquer mudança de acesso.

## Checklist para mudanças de código

1. Rode `npm run build` e `npm run lint`.
2. Valide manualmente o fluxo funcional alterado, inclusive mensagens de erro.
3. Quando tocar autenticação/rotas, valide login, logout, expiração por
   inatividade, redirecionamentos e os três papéis.
4. Quando tocar dados, confira as invalidações do React Query, a integridade do
   estoque e o registro de erros.
5. Quando houver schema, revise migration, RLS, triggers/RPCs e regenere os
   tipos Supabase quando aplicável.
