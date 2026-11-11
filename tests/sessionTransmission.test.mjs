import test from 'node:test';
import assert from 'node:assert/strict';
import * as sessionData from '../src/lib/sessionData.ts';

test('preserva o formato da transmissão e a observação ao editar', () => {
  const stored = sessionData.formatTransmissionObservation('Maria', 'Observação');
  assert.equal(stored, '[Transmissão da Assistência - 2º Dirigente: Maria]\nObservação');
  assert.deepEqual(sessionData.parseTransmissionObservation(stored), {
    segundoDirigente: 'Maria', observation: 'Observação',
  });
});

test('mantém observações comuns e interpreta prefixos legados com CRLF', () => {
  assert.deepEqual(sessionData.parseTransmissionObservation('Texto simples'), {
    segundoDirigente: null, observation: 'Texto simples',
  });
  assert.deepEqual(sessionData.parseTransmissionObservation('[Transmissão da Assistência - 2º Dirigente:  Maria ]\r\nTexto'), {
    segundoDirigente: 'Maria', observation: 'Texto',
  });
});

test('restringe a transmissão aos tipos permitidos', () => {
  assert.equal(sessionData.allowsTransmission('Primeira Escala'), true);
  assert.equal(sessionData.allowsTransmission('Segunda Escala'), true);
  assert.equal(sessionData.allowsTransmission('Extra'), true);
  assert.equal(sessionData.allowsTransmission('Quadro de Mestres'), false);
});
