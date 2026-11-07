import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/sessionRegistration.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  external: ["@/integrations/supabase/client"],
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const calls = [];
const supabase = { rpc: async (name, args) => { calls.push({ name, args }); return { data: "sessao-simulada", error: null }; } };
const module = { exports: {} };
new Function("module", "exports", "require", outputFiles[0].text)(module, module.exports, () => ({ supabase }));
const { registerSessionWithConsumption } = module.exports;
const session = {
  date: "2026-11-07", type: "Extra", dirigente: "M. João", explanador: null,
  leitor: null, mestre_assistente: "M. Maria", registered_by_name: "Operador Teste",
  observation: null, participants: { mestres: 2, conselheiros: 0, instrutivo: 0, socios: 0, visitantes: 0, jovens: 0 },
  total_participants: 2, total_consumed: 1, is_united: false, has_photo: false, has_audio: false,
};

test("sessão simples envia o consumo solicitado em vez do saldo capturado", async () => {
  calls.length = 0;
  const sources = [{ vegetal_id: "lote-a", vegetal_name: "Lote A", amount_available: 100 }];
  assert.equal(await registerSessionWithConsumption(session, sources, []), "sessao-simulada");
  assert.equal(calls[0].name, "register_session_with_consumption");
  assert.equal(calls[0].args.p_sources[0].amount_available, 1);
  assert.equal(sources[0].amount_available, 100, "Não altera o rascunho do formulário");
});

test("união mantém as contribuições escolhidas e seu saldo", async () => {
  calls.length = 0;
  await registerSessionWithConsumption({ ...session, is_united: true }, [
    { vegetal_id: "lote-a", vegetal_name: "Lote A", amount_available: 2 },
    { vegetal_id: "lote-b", vegetal_name: "Lote B", amount_available: 3 },
  ], []);
  assert.deepEqual(calls[0].args.p_sources.map(source => source.amount_available), [2, 3]);
});
