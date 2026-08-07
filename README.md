# Assistência NSM

Aplicação web responsiva para administrar sessões, membros, estoque e relatórios da Assistência NSM.

## Funcionalidades

- Autenticação de usuários e controle de acesso por perfil.
- Cadastro, edição e consulta do histórico de sessões.
- Controle de estoque e registro de entradas.
- Gestão de membros.
- Dashboard e relatórios de acompanhamento.
- Exportação de dados para planilhas.

## Tecnologias

- React 18 e TypeScript
- Vite
- Tailwind CSS e componentes shadcn/ui
- React Router
- TanStack React Query
- Supabase (autenticação e banco de dados)
- Recharts e Papa Parse

## Requisitos

- Node.js 18 ou superior
- npm
- Projeto Supabase configurado

## Configuração

Instale as dependências:

```bash
npm ci
```

Crie um arquivo `.env.local` na raiz do projeto com as credenciais públicas do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

Não versione o arquivo `.env.local` nem exponha credenciais do projeto.

## Execução local

```bash
npm run dev
```

O servidor de desenvolvimento fica disponível em `http://localhost:3000`.

## Comandos disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento na porta 3000. |
| `npm run build` | Gera a versão de produção em `dist/`. |
| `npm run build:dev` | Gera uma build usando o modo `development`. |
| `npm run lint` | Executa a verificação de qualidade com ESLint. |
| `npm run preview` | Serve localmente a build de produção. |

## Perfis e permissões

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

Usuários não autenticados são enviados para a tela de login. Sessões expiram após 30 minutos sem atividade.

## Estrutura do projeto

```text
src/
├── components/       # Componentes reutilizáveis e interface
├── constants/        # Constantes de domínio
├── contexts/         # Autenticação e permissões
├── hooks/            # Acesso a dados e regras de domínio
├── integrations/     # Cliente e tipos do Supabase
├── lib/              # Utilitários compartilhados
├── pages/            # Telas da aplicação
└── types/            # Tipos auxiliares
supabase/
└── migrations/       # Migrations versionadas do banco de dados
```

## Validação antes de publicar

```bash
npm run build
npm run lint
```

Também valide manualmente o fluxo alterado, incluindo login, logout, expiração de sessão e permissões de cada perfil.
