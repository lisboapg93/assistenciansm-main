import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { fileURLToPath } from "node:url";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/memberParticipation.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { getMembersWithoutParticipation } = module.exports;
const members = [
  { name: "João", grau: "Quadro de Mestre", is_socio_nucleo: true },
  { name: "Ana", grau: "Corpo do Conselho", is_socio_nucleo: true },
  { name: "Pedro", grau: "Quadro de Mestre", is_socio_nucleo: false },
];
const result = getMembersWithoutParticipation(members, [{ explanador: "M. João", leitor: "C. Ana" }]);
assert.deepEqual(result.naoExplanaram.map((m) => m.name), ["Ana"]);
assert.deepEqual(result.naoLeram.map((m) => m.name), ["João"]);
assert.deepEqual(getMembersWithoutParticipation(undefined, undefined), { naoExplanaram: [], naoLeram: [] });
console.log("Participação de sócios do núcleo: OK");
