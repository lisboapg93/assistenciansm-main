import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/sessionRoleEligibility.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { getSessionRoleEligibilityChecks, getSessionRoleValidationError } = module.exports;
const original = {
  type: "Primeira Escala", dirigente: "Ana", segundoDirigente: "",
  isTransmissaoAssistencia: false, explanador: "C. Maria", mestreAssistente: "M. João",
};
const members = [
  { name: "Ana", grau: "Corpo Instrutivo" },
  { name: "Maria", grau: "Corpo do Conselho" },
  { name: "João", grau: "Quadro de Mestre" },
];

function validate(current, currentMembers = members) {
  return getSessionRoleValidationError({
    ...current, members: currentMembers,
    onlyQuadroDeMestre: current.isTransmissaoAssistencia,
    validateEligibility: getSessionRoleEligibilityChecks(current, original),
  });
}

test("mudar tipo revalida dirigente inalterado", () => {
  assert.match(validate({ ...original, type: "Instrutiva" }), /dirigente.*elegível/);
});

test("ativar transmissão exige grau de mestre dos dois dirigentes", () => {
  assert.match(validate({ ...original, isTransmissaoAssistencia: true, segundoDirigente: "M. João" }), /dirigente.*elegível/);
});

test("metadados históricos continuam editáveis sem os antigos membros cadastrados", () => {
  assert.equal(validate(original, []), null);
  assert.equal(validate({ ...original, dirigente: "  Ana  " }, []), null);
});

test("uma nova atribuição continua sujeita à elegibilidade e à não duplicidade", () => {
  assert.match(validate({ ...original, dirigente: "Pessoa desconhecida" }), /dirigente.*elegível/);
  assert.match(validate({ ...original, dirigente: "C. Maria" }), /mesma pessoa/);
});

test("troca de contexto preserva funções históricas com grau independente do tipo", () => {
  const checks = getSessionRoleEligibilityChecks({ ...original, type: "Extra" }, original);
  assert.equal(checks.dirigente, true);
  assert.equal(checks.segundoDirigente, true);
  assert.equal(checks.explanador, false);
  assert.equal(checks.mestreAssistente, false);
});

test("sessão legada com a mesma pessoa em duas funções continua editável", () => {
  const legacy = { ...original, leitor: "Ana" };
  const check = (current) => getSessionRoleValidationError({
    ...current, members,
    validateEligibility: getSessionRoleEligibilityChecks(current, legacy),
  });
  assert.equal(check(legacy), null);
  assert.equal(check({ ...legacy, observation: "Texto novo" }), null);
  assert.match(check({ ...legacy, explanador: "Ana" }), /mesma pessoa/);
  assert.match(check({ ...legacy, leitor: "C. Maria" }), /mesma pessoa/);
});
