import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as validation from '../src/lib/sessionCsvValidation';

const lot = { id: '11111111-1111-1111-1111-111111111111', name: 'Lote A', quantity: 5 };
const members = [
  { name: 'João', grau: 'Quadro de Mestre' },
  { name: 'Maria', grau: 'Quadro de Mestre' },
];
const row = {
  data: '15/01/2025', tipo: 'Extra', dirigente: 'M. João', mestre_assistente: 'M. Maria',
  registrado_por: 'Maria', mestres: '1', consumo_total: '2,5',
  fontes_vegetal: `${lot.id}:2,5`,
};

test('valida linha com data e consumo brasileiros', () => {
  assert.equal(typeof validation.validateSessionCsvRow, 'function');
  const result = validation.validateSessionCsvRow(row, members, [lot]);
  assert.equal(result.isValid, true);
  assert.equal(result.date, '2025-01-15');
  assert.equal(result.total_consumed, 2.5);
  assert.deepEqual(result.sources, [{ vegetal_id: lot.id, vegetal_name: lot.name, amount_available: 2.5 }]);
});

test('rejeita data inexistente e consumo superior ao saldo', () => {
  const result = validation.validateSessionCsvRow({ ...row, data: '31/02/2025', consumo_total: '6', fontes_vegetal: `${lot.id}:6` }, members, [lot]);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes('Data inválida'));
  assert.ok(result.errors.includes('Quantidade inválida para o lote Lote A'));
});

test('exige segundo dirigente em sessão de transmissão', () => {
  const result = validation.validateSessionCsvRow({ ...row, transmissao_assistencia: 'sim' }, members, [lot]);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes('A transmissão exige tipo permitido e segundo dirigente'));
});
