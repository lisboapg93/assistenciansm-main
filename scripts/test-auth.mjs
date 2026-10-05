import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// API inteiramente simulada: nenhuma conta ou dado real é usado nos testes.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3101";
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const configuredUrl = env.split(/\r?\n/).find(line => line.startsWith("VITE_SUPABASE_URL="));
assert.ok(configuredUrl, "VITE_SUPABASE_URL precisa estar configurada");
const apiHost = new URL(configuredUrl.slice(configuredUrl.indexOf("=") + 1).replace(/^['"]|['"]$/g, "")).hostname;
const storageKey = `sb-${apiHost.split(".")[0]}-auth-token`;
const activityKey = "assistencia-nsm-last-activity";
const user = {
  id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated",
  email: "teste@example.invalid", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
};
let generation = 0;
function newSession() {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, role: user.role, exp: now + 3600, iat: now, jti: ++generation })}.simulado`,
    refresh_token: "refresh-simulado", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user,
  };
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
});
const contexts = [];
async function fixture(role = "assistant", seed = {}) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  contexts.push(context);
  const state = { role, roleError: false, noRole: false, passwordCalls: 0, roleCalls: 0, roleGate: null, logoutGate: null, pageErrors: [], sessions: [], sessionError: false, sessionRequests: [] };
  await context.routeWebSocket(`wss://${apiHost}/**`, socket => socket.close());
  await context.route(`https://${apiHost}/**`, async route => {
    const url = new URL(route.request().url());
    const json = async (value, status = 200, headers = {}) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value), headers: { "access-control-expose-headers": "content-range", ...headers } });
    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "password") ++state.passwordCalls;
      return json(newSession());
    }
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/logout") {
      if (state.logoutGate) await state.logoutGate;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/rest/v1/user_roles") {
      ++state.roleCalls;
      if (state.roleGate) await state.roleGate;
      return state.roleError
        ? json({ code: "XX000", message: "Falha ao consultar perfil de acesso." }, 500)
        : json(state.noRole ? [] : [{ role: state.role }]);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) return json(null);
    if (url.pathname === "/rest/v1/members") return json([
      { id: "00000000-0000-4000-8000-000000000011", name: "João Teste", grau: "Quadro de Mestre", is_socio_nucleo: true },
      { id: "00000000-0000-4000-8000-000000000012", name: "José Teste", grau: "Quadro de Mestre", is_socio_nucleo: true },
    ]);
    if (url.pathname === "/rest/v1/session") {
      state.sessionRequests.push({ method: route.request().method(), query: url.search });
      if (state.sessionError) return json({ code: "XX000", message: "Falha ao carregar sessões." }, 500);
      return json(state.sessions, 200, { "content-range": state.sessions.length ? `0-${state.sessions.length - 1}/${state.sessions.length}` : "*/0" });
    }
    if (url.pathname.startsWith("/rest/v1/")) return json([], 200, { "content-range": "*/0" });
    throw new Error(`Endpoint simulado não previsto: ${url.pathname}`);
  });
  await context.addInitScript(({ storageKey, activityKey, seed }) => {
    if (localStorage.getItem("auth-regression-seeded")) return;
    localStorage.setItem("auth-regression-seeded", "true");
    if (seed.session) localStorage.setItem(storageKey, JSON.stringify(seed.session));
    if (seed.activity) localStorage.setItem(activityKey, String(seed.activity));
  }, { storageKey, activityKey, seed });
  const page = await context.newPage();
  page.on("pageerror", error => state.pageErrors.push(error.message));
  page.setDefaultTimeout(10000);
  return { context, page, state };
}
async function login(page) {
  await page.goto(baseUrl);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-simulada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
async function expectHome(page, role) {
  await page.waitForURL(`**/${role === "assistant" ? "sessao/nova" : "dashboard"}`);
  await page.getByRole("link", { name: "Histórico", exact: true }).waitFor();
}
function checkErrors(state) { assert.deepEqual(state.pageErrors, []); }
try {
  for (const role of ["assistant", "editor", "viewer"]) {
    const { page, state } = await fixture(role, { activity: Date.now() - 31 * 60000 });
    await login(page);
    await expectHome(page, role);
    assert.equal(state.passwordCalls, 1, "Login deve funcionar na primeira tentativa");
    if (role !== "editor") {
      await page.goto(`${baseUrl}/membros`);
      await expectHome(page, role);
    }
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    checkErrors(state);
    console.log(`Login único, atividade antiga, rotas e logout (${role}): OK`);
  }

  {
    const { page, state } = await fixture();
    let release;
    state.roleGate = new Promise(resolve => { release = resolve; });
    await login(page);
    await page.getByText("Preparando seu acesso...", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/", "Não deve redirecionar antes do perfil");
    release();
    await expectHome(page, "assistant");
    await page.getByPlaceholder("Nome do dirigente", { exact: true }).fill("Rascunho preservado");
    const before = state.roleCalls;
    const roleResponse = page.waitForResponse(response => response.url().includes("/rest/v1/user_roles"));
    await page.evaluate(async () => {
      const { supabase } = await import("/src/integrations/supabase/client.ts");
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    });
    await page.waitForFunction(() => !document.body.textContent.includes("Preparando seu acesso..."));
    assert.equal(await page.getByPlaceholder("Nome do dirigente", { exact: true }).inputValue(), "Rascunho preservado");
    await roleResponse;
    assert.ok(state.roleCalls > before, "Renovação precisa revalidar papel sem desmontar formulário");
    checkErrors(state);
    console.log("Perfil lento e token renovado sem perder formulário: OK");
  }

  for (const missing of [false, true]) {
    const { page, state } = await fixture();
    state.roleError = !missing;
    state.noRole = missing;
    await login(page);
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.getByRole("link", { name: "Dashboard", exact: true }).count(), 0);
    state.roleError = false;
    state.noRole = false;
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await expectHome(page, "assistant");
    checkErrors(state);
    console.log(`${missing ? "Conta sem perfil" : "Falha de perfil"}: acesso bloqueado e nova tentativa recupera: OK`);
  }

  {
    const { page, state } = await fixture("assistant", { session: newSession(), activity: Date.now() - 31 * 60000 });
    await page.goto(`${baseUrl}/sessao/nova`);
    await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    assert.equal(state.roleCalls, 0, "Sessão vencida não deve iniciar consultas protegidas");
    await login(page);
    await expectHome(page, "assistant");
    await page.evaluate(key => {
      localStorage.setItem(key, String(Date.now() - 31 * 60000));
      window.dispatchEvent(new Event("focus"));
    }, activityKey);
    await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    checkErrors(state);
    console.log("Expiração ao restaurar sessão e ao retornar à aba: OK");
  }

  {
    const { context, page, state } = await fixture();
    await login(page);
    await expectHome(page, "assistant");
    const second = await context.newPage();
    await second.goto(`${baseUrl}/sessao/nova`);
    await expectHome(second, "assistant");
    let release;
    state.logoutGate = new Promise(resolve => { release = resolve; });
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    release();
    await second.getByRole("button", { name: "Entrar", exact: true }).waitFor();
    checkErrors(state);
    console.log("Logout local imediato e sincronizado entre abas: OK");
  }

  for (const role of ["assistant", "editor", "viewer"]) {
    const { page, state } = await fixture(role);
    state.sessions = [{
      id: "00000000-0000-4000-8000-000000000021", date: "2024-01-06T00:00:00Z", type: "Extra", dirigente: "João Teste",
      mestre_assistente: "José Teste", explanador: null, leitor: null, observation: "Sessão antiga de teste",
      participants: { mestres: 1, conselho: 1, instrutivo: 0, socios: 1, visitantes: 0, jovens: 0 }, total_participants: 3,
      consumption: { total_consumed: 1, is_united: false, sources: [] }, has_photo: false, has_audio: false,
      created_at: "2024-01-06T00:00:00Z", updated_at: "2024-01-06T00:00:00Z",
    }];
    await login(page);
    await expectHome(page, role);
    await page.getByRole("link", { name: "Histórico", exact: true }).click();
    await page.getByText("1 sessões encontradas", { exact: true }).waitFor();
    const query = state.sessionRequests.at(-1).query;
    assert.ok(!new URLSearchParams(query).has("date"), "Histórico inicial não deve ocultar sessões antigas");
    assert.equal(await page.getByRole("button", { name: "Exportar página XLSX", exact: true }).count(), role === "editor" ? 1 : 0);
    assert.equal(await page.getByRole("button", { name: "Importar CSV", exact: true }).count(), role === "editor" ? 1 : 0);
    await page.getByRole("row").filter({ hasText: "Extra" }).click();
    await page.getByRole("dialog").getByText("06/01/2024", { exact: true }).waitFor();
    for (const action of ["Editar Sessão", "Excluir Sessão"]) {
      assert.equal(await page.getByRole("button", { name: action, exact: true }).count(), role === "editor" ? 1 : 0);
    }
    assert.ok(state.sessionRequests.every(request => request.method === "GET"));
    checkErrors(state);
    console.log(`Histórico antigo, detalhes e permissões (${role}): OK`);
  }

  {
    const { page, state } = await fixture();
    state.sessionError = true;
    await login(page);
    await expectHome(page, "assistant");
    await page.getByRole("link", { name: "Histórico", exact: true }).click();
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
    assert.equal(await page.getByText("Nenhuma sessão encontrada", { exact: true }).count(), 0);
    state.sessionError = false;
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await page.getByText("Nenhuma sessão encontrada", { exact: true }).waitFor();
    checkErrors(state);
    console.log("Falha no histórico não aparece como lista vazia; nova tentativa recupera: OK");
  }
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
}
