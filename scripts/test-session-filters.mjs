import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createClient } from "@supabase/supabase-js";

// Usa o builder HTTP real do Supabase. Apenas a rede e o agendamento do
// React Query são substituídos; os filtros e a paginação vêm do hook real.
const requests = [];
const client = createClient("https://supabase.example.invalid", "chave-simulada", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: async (input, options) => {
      requests.push({ url: new URL(String(input)), headers: new Headers(options?.headers) });
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Range": "*/75" },
      });
    },
  },
});
const require = createRequire(import.meta.url);
const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/hooks/useSessions.ts", import.meta.url))],
  bundle: true, write: false, format: "cjs", platform: "node",
  external: ["@tanstack/react-query", "@/integrations/supabase/client"],
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const module = { exports: {} };
new Function("module", "exports", "require", outputFiles[0].text)(module, module.exports, (name) => {
  if (name === "@tanstack/react-query") return { useQuery: options => options };
  if (name === "@/integrations/supabase/client") return { supabase: client };
  return require(name);
});
const { usePaginatedSessions } = module.exports;
async function requestFor(filters, page = 0) {
  const result = await usePaginatedSessions(filters, page, 25).queryFn();
  return { ...requests.at(-1), result };
}

const allYears = await requestFor({});
assert.deepEqual(allYears.url.searchParams.getAll("date"), []);
const monthWithoutYear = await requestFor({ month: 1 });
assert.deepEqual(monthWithoutYear.url.searchParams.getAll("date"), [], "Mês sem ano não pode aplicar o ano atual silenciosamente");

const february = await requestFor({ year: 2024, month: 1 }, 2);
assert.deepEqual(february.url.searchParams.getAll("date"), [
  "gte.2024-01-01T00:00:00.000Z", "lt.2025-01-01T00:00:00.000Z",
  "gte.2024-02-01T00:00:00.000Z", "lt.2024-03-01T00:00:00.000Z",
]);
assert.equal(february.url.searchParams.get("offset"), "50");
assert.equal(february.url.searchParams.get("limit"), "25");
assert.match(february.headers.get("prefer"), /count=exact/);
assert.equal(february.result.total, 75);
assert.equal(february.result.page, 2);

const january = await requestFor({ year: 2025, month: 0 });
assert.ok(january.url.searchParams.getAll("date").includes("lt.2025-02-01T00:00:00.000Z"));
const december = await requestFor({ year: 2025, month: 11 });
assert.ok(december.url.searchParams.getAll("date").includes("gte.2025-12-01T00:00:00.000Z"));
assert.ok(december.url.searchParams.getAll("date").includes("lt.2026-01-01T00:00:00.000Z"));

const recent = await requestFor({ year: 2024, month: 1, lastMonths: 3 });
assert.equal(recent.url.searchParams.getAll("date").length, 1, "Período relativo mantém prioridade sobre ano/mês");
assert.ok(recent.url.searchParams.get("date").startsWith("gte."));
console.log("Regressões de filtros de ano/mês e paginação HTTP do histórico: OK");
