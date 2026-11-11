import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/sessionConsumptionValidation.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { getConsumptionValidationError } = module.exports;
const source = { vegetal_id: "a", vegetal_name: "A", amount_available: 2 };
const valid = { sources: [source], isUnited: false, totalConsumed: 1, totalAvailable: 2, hasSourceQuantityMismatch: false };
assert.equal(getConsumptionValidationError(valid, "submit"), null);
assert.equal(getConsumptionValidationError({ ...valid, sources: [] }, "submit"), "Selecione pelo menos um vegetal");
assert.equal(getConsumptionValidationError({ ...valid, sources: [source, source] }, "step"), "Sem união, selecione apenas um lote.");
assert.match(getConsumptionValidationError({ ...valid, totalConsumed: 2.01 }, "submit"), /maior/);
assert.match(getConsumptionValidationError({ ...valid, totalConsumed: 0 }, "step"), /positivo/);
assert.match(getConsumptionValidationError({ ...valid, hasSourceQuantityMismatch: true }, "step"), /mudou de saldo/);
assert.match(getConsumptionValidationError({ ...valid, sources: [{ ...source, amount_available: 1.234 }], hasSourceQuantityMismatch: true }, "submit"), /quantidades positivas/);
assert.match(getConsumptionValidationError({ ...valid, sources: [{ ...source, amount_available: 1.234 }], hasSourceQuantityMismatch: true }, "step"), /mudou de saldo/);
console.log("Validação de consumo da sessão: OK");
