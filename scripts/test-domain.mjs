import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const load = (path) => {
  const { outputFiles } = buildSync({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true, write: false, format: "cjs", platform: "node",
    tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
  });
  const module = { exports: {} };
  new Function("module", "exports", outputFiles[0].text)(module, module.exports);
  return module.exports;
};
const { isStockQuantity, sumStockQuantities } = load("../src/lib/stockQuantity.ts");
const { normalizeParticipants, areParticipantsValid } = load("../src/lib/sessionData.ts");
const { brazilianIsoDate, subtractMonthsFromIsoDate, brazilianDateBoundaryIso, formatBrazilianDateTime } = load("../src/lib/date.ts");
const { getSessionRoleValidationError } = load("../src/lib/sessionRoleEligibility.ts");

for (const value of [0.001, 1.234, -1, Infinity, NaN, 100000000]) assert.equal(isStockQuantity(value), false);
for (const value of [0.01, 0.1, 1.23, 99999999.99]) assert.equal(isStockQuantity(value), true);
assert.equal(isStockQuantity(0), false);
assert.equal(isStockQuantity(0, true), true);
assert.equal(sumStockQuantities([0.1, 0.2]), 0.3);
assert.deepEqual(normalizeParticipants({ mestres: 1, conselho: 4 }), {
  mestres: 1, conselheiros: 4, instrutivo: 0, socios: 0, visitantes: 0, jovens: 0,
});
assert.equal(normalizeParticipants({ conselho: 4, conselheiros: 2 }).conselheiros, 2);
assert.equal(areParticipantsValid(normalizeParticipants({ mestres: 1.5 })), false);
assert.equal(areParticipantsValid(normalizeParticipants({ mestres: -1 })), false);
assert.equal(areParticipantsValid(normalizeParticipants({ mestres: 2147483647, socios: 1 })), false);
assert.equal(areParticipantsValid(normalizeParticipants({ mestres: 2147483647 })), true);
assert.equal(subtractMonthsFromIsoDate("2024-03-31", 1), "2024-02-29");
assert.equal(subtractMonthsFromIsoDate("2026-03-31", 1), "2026-02-28");
for (const timezone of ["UTC", "America/Fortaleza", "Asia/Tokyo", "America/Los_Angeles"]) {
  process.env.TZ = timezone;
  assert.equal(brazilianIsoDate("2027-01-01T01:00:00Z"), "2026-12-31");
  assert.equal(brazilianIsoDate("2026-03-01T02:59:59Z"), "2026-02-28");
  assert.equal(brazilianDateBoundaryIso("2027-01-01"), "2027-01-01T03:00:00.000Z");
  assert.equal(formatBrazilianDateTime("2027-01-01T01:00:05Z", true), "31/12/2026 às 22:00:05");
}
const members = [
  { name: "João", grau: "Quadro de Mestre" },
  { name: "Maria", grau: "Corpo do Conselho" },
  { name: "Pedro", grau: "Quadro de Sócios" },
];
assert.equal(getSessionRoleValidationError({
  type: "Primeira Escala", dirigente: "M. João", explanador: "C. Maria",
  leitor: "Pedro", mestreAssistente: "M. João", members,
}), null);
assert.match(getSessionRoleValidationError({
  type: "Primeira Escala", dirigente: "Mestre João", leitor: "M. Joao", members,
}), /mesma pessoa/);
assert.match(getSessionRoleValidationError({
  type: "Primeira Escala", dirigente: "Pedro", members,
}), /elegível/);
console.log("Regressões de quantidades, participantes, funções e fusos: OK");
