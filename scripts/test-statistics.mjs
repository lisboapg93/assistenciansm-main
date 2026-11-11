import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/statistics.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { calculateStatistics } = module.exports;
const sessions = [
  { date: "2026-01-01", type: "Extra", dirigente: "M. João", mestre_assistente: "M. João", explanador: null, leitor: null, total_participants: 10, participants: { socios: 4 }, consumption: { total_consumed: 2 } },
  { date: "2026-01-31", type: "Extra", dirigente: "M. João", mestre_assistente: "M. João", explanador: null, leitor: null, total_participants: 20, participants: { socios: 6 }, consumption: { total_consumed: 4 } },
  { date: "2026-02-15", type: "Outro", dirigente: "Maria", mestre_assistente: null, explanador: null, leitor: null, total_participants: 1, participants: { socios: 1 }, consumption: { total_consumed: 1 } },
];
const stats = calculateStatistics(sessions, [{ quantity: 12 }], { type: "Extra" }, [{ name: "João", grau: "Quadro de Mestre" }]);
assert.equal(stats.totalSessions, 2);
assert.equal(stats.totalConsumed, 6);
assert.equal(stats.averageConsumptionPerMember, 0.6);
assert.equal(stats.averageParticipants, 15);
assert.equal(stats.frequencyDays, 30);
assert.equal(stats.sessionsRemaining, 4);
assert.deepEqual(stats.sessionsByType, { Extra: 2, Outro: 1 });
assert.deepEqual(stats.topDirigentes, [{ name: "M. João", count: 2 }]);
assert.equal(stats.sequenciaMestresAssistentes.length, 1);
assert.equal(calculateStatistics([], [{ quantity: 12 }]).totalStock, 12);
console.log("Estatísticas, filtros, nomes e previsão de estoque: OK");
