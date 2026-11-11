import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as details from '../src/lib/auditData';

test('ignora campos técnicos e objetos equivalentes na comparação de atividades', () => {
  assert.equal(typeof details.getAuditChanges, 'function');
  const previous = { id: '1', updated_at: 'antes', participants: { mestres: 1, socios: 2 }, name: 'Antigo' };
  const current = { id: '1', updated_at: 'depois', participants: { socios: 2, mestres: 1 }, name: 'Novo' };
  assert.deepEqual(details.getAuditChanges(previous, current), [{ field: 'name', oldValue: 'Antigo', newValue: 'Novo' }]);
});
