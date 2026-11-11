import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/stockReports.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { getMovementsByType, getStockEvolution } = module.exports;
const movement = (date, type, quantity, session_id = null) => ({ date, type, quantity, session_id });
const movements = [
  movement("2024-12-01T12:00:00Z", "Entrada", 10),
  movement("2025-01-10T12:00:00Z", "Consumo", 2, "s1"),
  movement("2025-01-10T12:00:00Z", "Consumo", 3, "s1"),
  movement("2025-02-10T12:00:00Z", "Ajuste", -1),
];
const consumption = new Map([["s1", 4]]);
assert.deepEqual(getMovementsByType(movements, 2025, consumption), [
  { type: "Consumo", quantidade: 2, litros: 4 },
  { type: "Ajuste", quantidade: 1, litros: 1 },
]);
const evolution = getStockEvolution(movements, 2025, 99, consumption, 2026);
assert.deepEqual(evolution.map(({ entrada, consumo, saldo }) => ({ entrada, consumo, saldo })), [
  { entrada: 0, consumo: 4, saldo: 5 },
  { entrada: 1, consumo: 0, saldo: 6 },
]);
assert.equal(getStockEvolution(movements, 2025, 7.25, consumption, 2025).at(-1).saldo, 7.25);
assert.deepEqual(getStockEvolution([], 2025, 0, consumption, 2025), []);
console.log("Relatórios de movimentação e evolução de estoque: OK");
