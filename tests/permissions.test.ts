import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute, getHomeRoute, resolveEffectiveRole, ROUTE_ROLES, type AppRole, type ProtectedRoutePath } from '../src/lib/permissions';

const ROLES: AppRole[] = ['viewer', 'editor', 'assistant'];

// Espelha a tabela de permissões do CLAUDE.md/README, incluindo as rotas
// liberadas depois (/historico para assistente, /atividades e /erros).
const EXPECTED: Record<ProtectedRoutePath, Record<AppRole, boolean>> = {
  '/dashboard': { viewer: true, editor: true, assistant: false },
  '/estoque': { viewer: true, editor: true, assistant: true },
  '/estoque/novo': { viewer: false, editor: true, assistant: false },
  '/sessao/nova': { viewer: false, editor: true, assistant: true },
  '/sessao/editar/:id': { viewer: false, editor: true, assistant: false },
  '/historico': { viewer: true, editor: true, assistant: true },
  '/relatorios': { viewer: true, editor: true, assistant: false },
  '/membros': { viewer: false, editor: true, assistant: false },
  '/atividades': { viewer: true, editor: true, assistant: false },
  '/erros': { viewer: false, editor: true, assistant: false },
};

test('cada papel acessa exatamente as rotas previstas', () => {
  assert.deepEqual(Object.keys(ROUTE_ROLES).sort(), Object.keys(EXPECTED).sort());
  for (const [path, byRole] of Object.entries(EXPECTED) as [ProtectedRoutePath, Record<AppRole, boolean>][]) {
    for (const role of ROLES) assert.equal(canAccessRoute(role, path), byRole[role], `${role} em ${path}`);
  }
});

test('sem papel nenhuma rota protegida é liberada', () => {
  for (const path of Object.keys(ROUTE_ROLES) as ProtectedRoutePath[]) {
    assert.equal(canAccessRoute(null, path), false);
  }
});

test('tela inicial: assistente vai para nova sessão e todo papel acessa a própria tela inicial', () => {
  assert.equal(getHomeRoute('assistant'), '/sessao/nova');
  assert.equal(getHomeRoute('viewer'), '/dashboard');
  assert.equal(getHomeRoute('editor'), '/dashboard');
  for (const role of ROLES) assert.equal(canAccessRoute(role, getHomeRoute(role)), true);
});

test('papel efetivo segue a precedência editor > assistente > visualizador', () => {
  assert.equal(resolveEffectiveRole(['viewer', 'editor']), 'editor');
  assert.equal(resolveEffectiveRole(['viewer', 'assistant']), 'assistant');
  assert.equal(resolveEffectiveRole(['viewer']), 'viewer');
  assert.equal(resolveEffectiveRole([]), null);
  assert.equal(resolveEffectiveRole(['admin']), null);
});
