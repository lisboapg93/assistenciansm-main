// Executor dos testes automatizados (`npm test`), sem dependências extras.
//
// 1. tests/**/*.test.{ts,mts,mjs,js}: cada arquivo é empacotado com esbuild
//    (resolve TypeScript, imports sem extensão e o alias `@/`) e executado
//    com o runner nativo `node --test`.
// 2. scripts/test-*.mjs: regressões em script, executadas uma a uma.
//
// Ficam fora do padrão os testes que exigem infraestrutura externa:
//   npm run test:e2e  -> scripts/test-auth.mjs (Playwright + `npm run dev` em
//                        TEST_BASE_URL, padrão http://127.0.0.1:3101)
//   npm run test:sql  -> scripts/test-session-sql.mjs (PostgreSQL local;
//                        PG_BINDIR aponta para os binários)
//
// Uso: node scripts/run-tests.mjs [filtro...]  (filtra pelo caminho do arquivo)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTERNAL_SCRIPT_TESTS = new Set(["test-auth.mjs", "test-session-sql.mjs"]);
const UNIT_TEST_PATTERN = /\.test\.(ts|mts|mjs|js)$/;
const filters = process.argv.slice(2);

const matchesFilter = (file) => !filters.length || filters.some((filter) => file.includes(filter));
const relative = (file) => path.relative(root, file);

function listFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .filter((file) => matchesFilter(relative(file)))
    .sort();
}

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" }).status === 0;
}

function runUnitTests(files) {
  if (!files.length) return true;
  const outdir = mkdtempSync(path.join(tmpdir(), "assistencia-nsm-tests-"));
  try {
    let bundlesOk = true;
    const bundles = files.flatMap((file, index) => {
      const outfile = path.join(outdir, `${index}-${path.basename(file).replace(/\.[^.]+$/, "")}.mjs`);
      try {
        bundle(file, outfile);
        return [outfile];
      } catch {
        // O esbuild já imprimiu o erro de compilação.
        console.error(`✗ Não foi possível compilar ${relative(file)}`);
        bundlesOk = false;
        return [];
      }
    });
    if (!bundles.length) return false;
    console.log(`\n▶ node --test (${files.map(relative).join(", ")})`);
    return runNode(["--test", ...bundles]) && bundlesOk;
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
}

function bundle(entryPoint, outfile) {
  buildSync({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    sourcemap: "inline",
    logLevel: "error",
    tsconfig: path.join(root, "tsconfig.app.json"),
    // Dependências CommonJS empacotadas em ESM ainda podem usar require().
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
}

function runScriptTests(files) {
  const failed = [];
  for (const file of files) {
    console.log(`\n▶ ${relative(file)}`);
    if (!runNode([file])) failed.push(relative(file));
  }
  return failed;
}

const unitTests = listFiles(path.join(root, "tests"), (name) => UNIT_TEST_PATTERN.test(name));
const scriptTests = listFiles(
  path.join(root, "scripts"),
  (name) => /^test-.*\.mjs$/.test(name) && !EXTERNAL_SCRIPT_TESTS.has(name),
);

if (!unitTests.length && !scriptTests.length) {
  console.error("Nenhum teste encontrado.");
  process.exit(1);
}

const unitPassed = runUnitTests(unitTests);
const failedScripts = runScriptTests(scriptTests);

console.log("\n──────── Resumo ────────");
console.log(`Testes unitários (${unitTests.length} arquivos): ${unitPassed ? "OK" : "FALHOU"}`);
console.log(`Scripts de regressão: ${scriptTests.length - failedScripts.length}/${scriptTests.length} OK`);
for (const file of failedScripts) console.log(`  ✗ ${file}`);

process.exit(unitPassed && !failedScripts.length ? 0 : 1);
