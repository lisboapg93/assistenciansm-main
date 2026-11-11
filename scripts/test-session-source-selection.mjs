import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/sessionSourceSelection.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { toggleSessionSource } = module.exports;
const selected = { vegetal_id: "a", vegetal_name: "Lote A", amount_available: 2 };
const other = { vegetal_id: "b", vegetal_name: "Lote B", amount_available: 1 };
assert.deepEqual(toggleSessionSource([selected, other], "a", []), [other]);
assert.deepEqual(toggleSessionSource([], "a", [{ id: "a", name: "Lote A", quantity: 2 }]), [selected]);
assert.deepEqual(toggleSessionSource([selected], "b", []), [selected]);
assert.deepEqual(toggleSessionSource([selected], "a", [{ id: "a", name: "Lote A", quantity: 2 }]), []);
console.log("Seleção e remoção de lotes da sessão: OK");
