import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildSync } from "esbuild";

// Somente o transporte é simulado; classificação, sanitização e registro são reais.
function fixture(loggingFailure = false) {
  const calls = [];
  const supabase = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (loggingFailure) throw new Error("Falha simulada no transporte dos logs");
      return { data: null, error: null };
    },
  };
  const { outputFiles } = buildSync({
    entryPoints: [fileURLToPath(new URL("../src/lib/errorLogging.ts", import.meta.url))],
    bundle: true, write: false, format: "cjs", platform: "node",
    external: ["@/integrations/supabase/client"],
    tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", outputFiles[0].text)(module, module.exports, () => ({ supabase }));
  return { ...module.exports, calls };
}

const context = { location: "sessionRegistration.registerWithConsumption", operation: "create", entity: "session" };
const originalConsoleError = console.error;
console.error = () => {};
process.on("exit", () => { console.error = originalConsoleError; });

test("a restrição da sessão sobrevive ao registro e identifica a duplicidade", async () => {
  const { logAndThrow, getUniqueViolationEntity } = fixture();
  await assert.rejects(logAndThrow({
    code: "23505",
    message: 'duplicate key value violates unique constraint "session_no_duplicate_logical_record_idx"',
    details: "Key (date)=(2026-11-07) already exists.", hint: null,
  }, context), error => {
    assert.equal(error.constraint, "session_no_duplicate_logical_record_idx");
    assert.equal(getUniqueViolationEntity(error), "session");
    assert.match(error.message, /sessão.*registrada/i);
    return true;
  });
});

test("duplicidade de membro mantém a causa e não vira sessão duplicada", async () => {
  const { logAndThrow, getUniqueViolationEntity } = fixture();
  for (const raw of [
    { code: "23505", message: "Já existe um membro com este nome", details: null, hint: null },
    { code: "23505", message: 'duplicate key value violates unique constraint "members_identity_key_unique_idx"', details: null, hint: null },
  ]) {
    await assert.rejects(logAndThrow(raw, context), error => {
      assert.match(error.message, /membro/i);
      assert.equal(getUniqueViolationEntity(error), "members");
      return true;
    });
  }
});

test("23505 desconhecido não afirma que uma sessão já existe", async () => {
  const { logAndThrow, getUniqueViolationEntity } = fixture();
  await assert.rejects(logAndThrow({ code: "23505", message: 'duplicate key value violates unique constraint "outra_restricao"' }, context), error => {
    assert.equal(getUniqueViolationEntity(error), null);
    assert.doesNotMatch(error.message, /sessão.*registrada/i);
    return true;
  });
});

test("a classificação exige 23505 e aceita as restrições legadas de membros", () => {
  const { getUniqueViolationEntity } = fixture();
  for (const constraint of ["members_name_key", "members_person_name_key_unique_idx", "members_identity_key_unique_idx"]) {
    assert.equal(getUniqueViolationEntity({ code: "23505", constraint, message: "conflito" }), "members");
  }
  assert.equal(getUniqueViolationEntity({ code: "42501", constraint: "session_no_duplicate_logical_record_idx", message: "Sem permissão" }), null);
  for (const error of [null, undefined, {}, "23505", { code: "23505" }]) assert.equal(getUniqueViolationEntity(error), null);
});

test("os dois registros recebem diagnóstico técnico sem valores ou credenciais", async () => {
  const { logApplicationError, calls } = fixture();
  await logApplicationError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "members_identity_key_unique_idx"',
    details: "Key (email, name)=(pessoa@example.invalid, Nome Privado) already exists.\nFailing row contains (Outro Nome Privado, dado).",
    hint: 'Use https://banco.example.invalid/path?apikey=chave-privada or Bearer segredo-privado\n{"password":"senha privada", "refresh_token":"refresh-privado"}',
  }, { ...context, metadata: { source_count: 1, api_key: "chave-contexto", "api-key": "chave-com-hifen" }, inputPayload: { password: "senha-payload", nested: { token: "token-payload" } } });
  assert.deepEqual(calls.map(call => call.name), ["log_application_error", "log_operation_failure"]);
  for (const { args } of calls) {
    assert.match(args.p_metadata.original_message, /duplicate key/);
    assert.equal(args.p_metadata.error_constraint, "members_identity_key_unique_idx");
    assert.equal(args.p_metadata.error_code, "23505");
    assert.match(args.p_metadata.error_details, /Key \(email, name\)/);
    assert.equal(args.p_metadata.source_count, 1);
    assert.doesNotMatch(JSON.stringify(args), /pessoa@example|Nome Privado|dado\)|chave-privada|segredo-privado|senha privada|refresh-privado|chave-contexto|chave-com-hifen|senha-payload|token-payload/);
  }
});

test("mensagem original e diagnóstico são limitados e sanitizados também em erros de leitura", async () => {
  const { logApplicationError, calls } = fixture();
  await logApplicationError({ code: "PGRST202", message: "Could not find function public.get_stock_forecast()", details: "x".repeat(10000), hint: null }, { location: "Estoque.getStockForecast", operation: "read", entity: "session" });
  assert.equal(calls.length, 1);
  const { p_metadata: metadata } = calls[0].args;
  assert.match(metadata.original_message, /get_stock_forecast/);
  assert.ok(metadata.error_details.length <= 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(metadata)) < 8192);
});

test("falha ao persistir logs não substitui o erro da operação", async () => {
  const { logAndThrow } = fixture(true);
  await assert.rejects(logAndThrow({ code: "23505", message: "Já existe um membro com este nome" }, context), error => {
    assert.equal(error.code, "23505");
    assert.match(error.message, /membro/);
    return true;
  });
});

test("credenciais em mensagens, JSON escapado e cabeçalhos não chegam aos logs", async () => {
  const { logApplicationError, calls } = fixture();
  const message = 'Falha de conexão: password="senha com espaços"; api_key=chave-erro';
  await logApplicationError({ message,
    details: JSON.stringify({ secret: 'valor com "aspas" privado', authorization: "Basic credencial-codificada" }),
    hint: "Cookie: sessao=valor-cookie; outra=outro-cookie\nAuthorization: Basic outra-credencial",
  }, context);
  assert.doesNotMatch(JSON.stringify(calls), /senha com espaços|chave-erro|privado|credencial-codificada|valor-cookie|outro-cookie|outra-credencial/);
});

test("mensagens de validação do servidor acentuadas e no plural chegam ao usuário", () => {
  const { getErrorMessage } = fixture();
  for (const message of [
    "Participantes inválidos",
    "Consumo inválido",
    "Tipo de movimentação inválido",
    "Total de participantes inválido ou diferente da soma dos grupos",
    "A transmissão exige um tipo permitido e o segundo dirigente",
    "Consumo deve ser positivo com no máximo 2 casas decimais",
  ]) {
    assert.equal(getErrorMessage(new Error(message)), message);
  }
});

test("erros do Postgres em inglês que citam vegetal continuam traduzidos", () => {
  const { getErrorMessage } = fixture();
  assert.equal(
    getErrorMessage({ message: 'new row violates row-level security policy for table "vegetal"' }),
    "Você não tem permissão para realizar esta operação.",
  );
  assert.equal(
    getErrorMessage({ message: 'null value in column "name" of relation "vegetal" violates not-null constraint' }),
    "Preencha todos os campos obrigatórios.",
  );
  assert.match(getErrorMessage({ message: "exclusion constraint violation" }), /inesperado/);
});

test("getErrorMessage é idempotente depois de logAndThrow", async () => {
  const { logAndThrow, getErrorMessage } = fixture();
  await assert.rejects(
    logAndThrow({ message: 'null value in column "name" violates not-null constraint' }, context),
    (error) => {
      assert.equal(error.message, "Preencha todos os campos obrigatórios.");
      assert.equal(getErrorMessage(error), "Preencha todos os campos obrigatórios.");
      return true;
    },
  );
});
