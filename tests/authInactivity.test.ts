import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) { return this.items.has(key) ? this.items.get(key)! : null; }
  setItem(key: string, value: string) { this.items.set(key, String(value)); }
  removeItem(key: string) { this.items.delete(key); }
  clear() { this.items.clear(); }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

const inactivity = await import('../src/hooks/useAuthInactivity');
const { INACTIVITY_TIMEOUT_MS: TIMEOUT, LAST_ACTIVITY_STORAGE_KEY: KEY } = inactivity;

beforeEach(() => storage.clear());

test('chave ausente ou inválida não conta como inatividade', () => {
  assert.equal(TIMEOUT, 30 * 60 * 1000);
  assert.equal(inactivity.readLastActivity(), null);
  assert.equal(inactivity.isInactivityExpired(), false);
  storage.setItem(KEY, 'lixo');
  assert.equal(inactivity.readLastActivity(), null);
  assert.equal(inactivity.isInactivityExpired(), false);
});

test('expira exatamente após 30 minutos sem atividade', () => {
  const now = 1_800_000_000_000;
  inactivity.recordActivity(now - TIMEOUT + 1);
  assert.equal(inactivity.isInactivityExpired(now), false);
  inactivity.recordActivity(now - TIMEOUT);
  assert.equal(inactivity.isInactivityExpired(now), true);
  inactivity.clearLastActivity();
  assert.equal(inactivity.isInactivityExpired(now), false);
});

test('tentativa de login renova a atividade e é desfeita se falhar', () => {
  const stale = String(Date.now() - TIMEOUT - 1);
  storage.setItem(KEY, stale);
  const undo = inactivity.markLoginAttemptActivity();
  assert.equal(inactivity.isInactivityExpired(), false);
  undo();
  assert.equal(storage.getItem(KEY), stale);

  storage.clear();
  inactivity.markLoginAttemptActivity()();
  assert.equal(storage.getItem(KEY), null);
});

test('desfazer não sobrescreve atividade registrada por outra aba', () => {
  const undo = inactivity.markLoginAttemptActivity();
  storage.setItem(KEY, '42');
  undo();
  assert.equal(storage.getItem(KEY), '42');
});
