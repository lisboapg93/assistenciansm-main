import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/lib/sessionCsv.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", outputFiles[0].text)(module, module.exports);
const { mapSessionCsvRows, CSV_TEMPLATE_HEADERS, decodeCsvBuffer } = module.exports;

// O cabeçalho reordena dirigente/assistente. O antigo fallback posicional
// aceitava as duas pessoas nas funções trocadas e também importava o cabeçalho.
const aliases = [
  "dt", "tipo_de_sessao", "assistente", "dirigente_nome", "registered_by_name",
  "consumo", "lotes", "qtd_socios", "registro_foto", "registro_audio", "obs",
];
const imported = mapSessionCsvRows([
  aliases,
  ["2026-02-01", "Extra", "Maria", "João", "Responsável", "1,5", "lote:1,5", "5", "sim", "não", "Sessão"],
]);
assert.equal(imported.error, undefined);
assert.equal(imported.rows.length, 1, "Cabeçalho com aliases não pode virar uma sessão");
assert.equal(imported.rows[0].rowNumber, 2);
assert.equal(imported.rows[0].values.dirigente, "João");
assert.equal(imported.rows[0].values.mestre_assistente, "Maria");
assert.equal(imported.rows[0].values.socios, "5");
assert.equal(imported.rows[0].values.tem_foto, "sim");
assert.equal(imported.rows[0].values.tem_audio, "não");

const required = ["data", "tipo", "dirigente", "mestre_assistente", "registrado_por", "consumo_total", "fontes_vegetal"];
for (const missing of required) {
  const incomplete = mapSessionCsvRows([required.filter(column => column !== missing), ["valor"]]);
  assert.ok(incomplete.error, `Cabeçalho sem ${missing} precisa ser rejeitado`);
  assert.equal(incomplete.rows.length, 0, "Cabeçalho incompleto não pode usar posição");
}
const duplicate = mapSessionCsvRows([
  [...required, "assistente"],
  ["2026-01-01", "Extra", "João", "Maria", "Responsável", "1", "lote:1", "José"],
]);
assert.match(duplicate.error, /repetid|ambígu/i);
assert.equal(duplicate.rows.length, 0);

const positionalRow = [
  "01/02/2026", "Extra", "João", "Maria", "Responsável", "", "", "0", "0", "0",
  "5", "0", "0", "1,5", "não", "sim", "não", "Áudio", "lote:1,5",
];
const positional = mapSessionCsvRows([positionalRow]);
assert.equal(positional.error, undefined);
assert.equal(positional.rows.length, 1);
assert.equal(positional.rows[0].rowNumber, 1);
assert.equal(positional.rows[0].values.dirigente, "João");
assert.equal(positional.rows[0].values.mestre_assistente, "Maria");
assert.equal(positional.rows[0].values.observacao, "Áudio", "Valor igual a um alias não torna a linha um cabeçalho");

const normalized = mapSessionCsvRows([
  ["\uFEFF Data ", "TIPO", "Dirigente", "Mestre Assistente", "REGISTRADO POR", "Consumo Total", "Fontes Vegetal", "Observação"],
  ["2026-02-01", "Extra", "João", "Maria", "Responsável", "1,5", "lote:1,5", "Sessão"],
]);
assert.equal(normalized.error, undefined);
assert.equal(normalized.rows[0].values.observacao, "Sessão");
assert.equal(mapSessionCsvRows([CSV_TEMPLATE_HEADERS]).rows.length, 0);

// Excel pt-BR salva em Windows-1252; ler como UTF-8 gerava "Jo�o".
const toBuffer = (bytes) => new Uint8Array(bytes).buffer;
const ansi = decodeCsvBuffer(toBuffer([0x4a, 0x6f, 0xe3, 0x6f, 0x3b, 0x4e, 0xe3, 0x6f]));
assert.equal(ansi.text, "João;Não");
assert.equal(ansi.encoding, "windows-1252");
const utf8 = decodeCsvBuffer(toBuffer([0xef, 0xbb, 0xbf, ...Buffer.from("João;Não", "utf8")]));
assert.equal(utf8.text, "João;Não");
assert.equal(utf8.encoding, "utf-8");
const utf16 = decodeCsvBuffer(toBuffer([0xff, 0xfe, ...Buffer.from("João", "utf16le")]));
assert.equal(utf16.text, "João");
assert.equal(utf16.encoding, "utf-16le");
assert.equal(decodeCsvBuffer(toBuffer([...Buffer.from("Sessão", "utf16le")])).text, "Sessão");

console.log("Regressões de aliases, cabeçalhos incompletos/ambíguos, CSV posicional e codificação: OK");
