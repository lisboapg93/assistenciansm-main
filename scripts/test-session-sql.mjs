// Regressões contra PostgreSQL real e descartável. Não usa credenciais nem banco remoto.
// PG_BINDIR=/opt/homebrew/opt/postgresql@17/bin node scripts/test-session-sql.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUnicodeTests } from './test-member-unicode.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.PG_BINDIR || '/opt/homebrew/opt/postgresql@17/bin';
const temp = mkdtempSync(path.join(tmpdir(), 'nsm-session-sql-'));
const data = path.join(temp, 'data');
const env = { ...process.env, PGHOST: temp, PGPORT: '55482', PGUSER: 'postgres', PGDATABASE: 'postgres' };
const ids = {
  editor: '10000000-0000-0000-0000-000000000001',
  assistant: '10000000-0000-0000-0000-000000000002',
  viewer: '10000000-0000-0000-0000-000000000003',
};
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const psqlArgs = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
function sql(statement, options = {}) {
  return execFileSync(path.join(bin, 'psql'), psqlArgs, {
    env, input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options,
  }).trim();
}
function asRole(role, statement) {
  return `SET ROLE authenticated; SET request.jwt.claim.sub=${quote(ids[role])}; ${statement}`;
}
function error(statement, expected) {
  assert.throws(() => sql(statement), (e) => {
    assert.match(e.stderr.toString(), expected);
    return true;
  });
}
function check(statement, expected) { assert.equal(sql(statement), String(expected)); }
const participants = { mestres: 1, conselheiros: 0, instrutivo: 0, socios: 0, visitantes: 0, jovens: 0 };
let sessionSequence = 0;
const session = (extra = {}) => ({
  date: `2027-${String(1 + Math.floor(sessionSequence / 28)).padStart(2, '0')}-${String(1 + sessionSequence++ % 28).padStart(2, '0')}`,
  type: 'Extra', dirigente: 'M. Alfa', mestre_assistente: 'M. Auxiliar',
  registered_by_name: 'Operador', participants, total_participants: 1,
  total_consumed: 1, is_united: false, ...extra,
});
function lot(quantity = 100) {
  return sql(`INSERT INTO public.vegetal(name,quantity,initial_quantity,envase_date,master)
    VALUES ('Fonte',${quantity},${quantity},'2026-11-07','M. Alfa') RETURNING id;`);
}
function registration(data, sources, role = 'editor') {
  return asRole(role, `SELECT public.register_session_with_consumption(${json(data)},${json(sources)});`);
}
function register(data = session(), stock = lot(), amount = 100, role = 'editor') {
  return sql(registration(data, [{ vegetal_id: stock, amount_available: amount }], role));
}
const metadata = (id, updates, role = 'editor') => asRole(role,
  `SELECT (public.update_session_metadata(${quote(id)},${json(updates)})).id;`);

function bootstrap() {
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
    CREATE PUBLICATION supabase_realtime;`);
  for (const file of readdirSync(path.join(root, 'supabase/migrations')).sort()) {
    if (file >= '20261107000000') continue;
    // Cada arquivo tem sua própria transação, inclusive tabelas ON COMMIT DROP.
    // Corpos legados inválidos são substituídos antes dos testes; o cliente psql
    // seguinte volta ao check_function_bodies padrão e compila as funções finais.
    sql(`SET check_function_bodies=off; BEGIN;\n${readFileSync(path.join(root, 'supabase/migrations', file), 'utf8')}\nCOMMIT;`);
  }
  sql(`INSERT INTO auth.users(id,email) VALUES
    (${quote(ids.editor)},'editor@example.invalid'),
    (${quote(ids.assistant)},'assistant@example.invalid'),
    (${quote(ids.viewer)},'viewer@example.invalid');
    UPDATE public.user_roles SET role='editor' WHERE user_id=${quote(ids.editor)};
    UPDATE public.user_roles SET role='assistant' WHERE user_id=${quote(ids.assistant)};
    INSERT INTO public.members(name,grau) VALUES
    ('Alfa','Quadro de Mestre'),('Beta','Quadro de Mestre'),('Auxiliar','Quadro de Mestre'),
    ('Instrutor','Corpo Instrutivo'),('Explanador','Corpo Instrutivo'),('Leitor','Quadro de Sócios');`);
}

function openPsql(statement) {
  const child = spawn(path.join(bin, 'psql'), psqlArgs, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise((resolve) => child.on('close', (code) => resolve({ code, stdout, stderr })));
  child.stdin.write(statement);
  return { child, done, output: () => stdout };
}
async function until(predicate) {
  const deadline = Date.now() + 8000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Tempo excedido esperando sincronização das transações');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
async function concurrentReversal(fixed) {
  const source = lot(10);
  const id = register(session({ is_united: true, total_consumed: 6 }), source, 10);
  const balance = sql(`SELECT vegetal_id FROM public.stock_movement WHERE session_id=${quote(id)} AND type='Saldo';`);
  // Mantém um consumo real ainda não confirmado no saldo. A exclusão deve
  // esperar o lock e só então decidir se o saldo já foi consumido.
  const holder = openPsql(`BEGIN; ${registration(session(), [{ vegetal_id: balance, amount_available: 4 }])}
    SELECT 'HOLDER_READY';\n`);
  await until(() => holder.output().includes('HOLDER_READY'));
  const deletion = openPsql(`SET application_name='nsm_delete_race';
    ${asRole('editor', `DELETE FROM public.session WHERE id=${quote(id)};`)}\n`);
  deletion.child.stdin.end();
  try {
    await until(() => sql(`SELECT count(*) FROM pg_stat_activity
      WHERE application_name='nsm_delete_race' AND wait_event_type='Lock';`) === '1');
  } finally {
    holder.child.stdin.end('COMMIT;\n');
  }
  assert.equal((await holder.done).code, 0);
  const result = await deletion.done;
  if (fixed) {
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /saldo do vegetal unido já foi parcialmente consumido/);
    check(`SELECT quantity FROM public.vegetal WHERE id=${quote(balance)};`, '3.00');
    check(`SELECT quantity FROM public.vegetal WHERE id=${quote(source)};`, '0.00');
    check(`SELECT count(*) FROM public.session WHERE id=${quote(id)};`, 1);
    check(`SELECT count(*) FROM public.stock_movement WHERE session_id=${quote(id)} AND type='Ajuste';`, 0);
  } else {
    assert.equal(result.code, 0, result.stderr);
    check(`SELECT quantity FROM public.vegetal WHERE id=${quote(balance)};`, '-1.00');
  }
}

async function reproduce() {
  error(registration(session(), [{ vegetal_id: lot(), amount_available: 100 }]), /invalid regular expression/);
  console.log('Reproduzido: regex inválido impede registro válido');
  // Isola os demais defeitos sem antecipar suas correções.
  const previous = readFileSync(path.join(root,
    'supabase/migrations/20261006120000_preserve_historical_session_roles.sql'), 'utf8');
  sql(previous.replaceAll('\\\\', '\\'));
  error(registration(session(), [{ vegetal_id: lot(90), amount_available: 100 }]), /Quantidade da fonte inválida/);
  const instrutiva = register(session({ dirigente: 'Instrutor' }));
  sql(metadata(instrutiva, { type: 'Instrutiva' }));
  const transmission = register(session({ dirigente: 'Instrutor' }));
  sql(metadata(transmission, { observation: '[Transmissão da Assistência - 2º Dirigente: M. Beta]' }));
  console.log('Reproduzidos: snapshot obsoleto bloqueia consumo; tipo/transmissão deixam dirigente inelegível');
  await concurrentReversal(false);
  console.log('Reproduzido: exclusão concorrente deixa saldo negativo');
  // Descarta os dados usados para reproduzir estoque negativo.
  sql('TRUNCATE public.stock_movement, public.session, public.vegetal CASCADE;');
}

async function verify() {
  const migration = path.join(root, 'supabase/migrations/20261107100000_fix_session_validation_and_stock_reversal.sql');
  sql(`BEGIN;\n${readFileSync(migration, 'utf8')}\nCOMMIT;`);
  const stock = lot(90);
  const id = register(session(), stock, 100);
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(stock)};`, '89.00');
  check(`SELECT quantity FROM public.stock_movement WHERE session_id=${quote(id)} AND type='Consumo';`, '1.00');
  check(`SELECT consumption->'sources'->0->>'amount_available' FROM public.session WHERE id=${quote(id)};`, 1);
  register(session(), stock, 100, 'assistant');
  error(registration(session(), [{ vegetal_id: stock, amount_available: 100 }], 'viewer'), /Sem permissão/);
  error(`SET ROLE anon; SELECT public.register_session_with_consumption('{}','[]');`, /permission denied/);
  error(metadata(id, { observation: 'Sem acesso' }, 'assistant'), /Sem permissão/);
  error(metadata(id, { observation: 'Sem acesso' }, 'viewer'), /Sem permissão/);
  error(asRole('assistant', `INSERT INTO public.session(date,type,dirigente) VALUES(now(),'Extra','M. Alfa');`), /permission denied/);
  check(asRole('assistant', `SELECT count(*)>0 FROM public.session;`), 't');
  sql(asRole('assistant', `DELETE FROM public.session WHERE id=${quote(id)};`));
  check(`SELECT count(*) FROM public.session WHERE id=${quote(id)};`, 1);
  error(registration(session({ total_consumed: 91 }), [{ vegetal_id: stock, amount_available: 100 }]), /saldo de vegetal insuficiente/);
  error(registration(session({ is_united: true }), [{ vegetal_id: stock, amount_available: 100 }]), /saldo de vegetal insuficiente/);
  error(registration(session(), [{ vegetal_id: stock, amount_available: 0 }]), /inválidas|inválida/);
  error(registration(session(), [{ vegetal_id: stock, amount_available: 100 }, { vegetal_id: stock, amount_available: 100 }]), /Fontes de consumo inválidas/);
  console.log('Passou: criação editor/assistant, negações viewer/anon e saldo real/ledger');

  const changingType = register(session({ dirigente: 'Instrutor' }));
  error(metadata(changingType, { type: 'Instrutiva' }), /dirigente deve ser um membro elegível/);
  error(metadata(changingType, { observation: '[Transmissão da Assistência - 2º Dirigente: M. Beta]' }), /dirigente deve ser um membro elegível/);
  const validTransmission = register(session({ observation: '[Transmissão da Assistência - 2º Dirigente: M. Beta]' }));
  error(metadata(validTransmission, { type: 'Instrutiva' }), /transmissão exige um tipo permitido/);
  error(metadata(id, { observation: '[Transmissão da Assistência - 2º Dirigente: M. Alfa]' }), /mesma pessoa/);
  error(metadata(id, { observation: '[Transmissão da Assistência - 2º Dirigente: Instrutor]' }), /segundo dirigente deve/);
  error(metadata(id, { observation: '[Transmissão da Assistência - 2º Dirigente: ]' }), /transmissão exige/);
  error(metadata(id, { observation: '[Transmissão da Assistência - 2º Dirigente: M. Beta\nOutro]' }), /transmissão exige/);
  console.log('Passou: transmissão, duplicidade e revalidação ao mudar tipo/contexto');

  const historical = register(session({ observation: '[Transmissão da Assistência - 2º Dirigente: M. Beta]' }));
  const historyStock = `SELECT jsonb_build_object('consumption', consumption,
    'ledger', (SELECT jsonb_agg(to_jsonb(movement) ORDER BY id) FROM public.stock_movement AS movement WHERE session_id=session.id),
    'stock', (SELECT jsonb_agg(jsonb_build_array(id,quantity) ORDER BY id) FROM public.vegetal))
    FROM public.session WHERE id=${quote(historical)};`;
  const beforeMetadata = sql(historyStock);
  sql("DELETE FROM public.members WHERE name IN ('Alfa','Beta','Auxiliar');");
  sql(metadata(historical, { observation: '[Transmissão da Assistência - 2º Dirigente: M. Beta]\nObservação posterior',
    participants: { ...participants, visitantes: 1 }, total_participants: 2 }));
  check("SELECT count(*) FROM public.members WHERE name IN ('Alfa','Beta','Auxiliar');", 0);
  assert.equal(sql(historyStock), beforeMetadata, 'Edição histórica preserva consumo, estoque e ledger');
  error(metadata(historical, { type: 'Primeira Escala', explanador: 'Explanador', leitor: 'Leitor' }), /dirigente deve/);
  error(metadata(historical, { observation: 'Transmissão desativada' }), /dirigente deve/);
  sql("INSERT INTO public.members(name,grau) VALUES ('Alfa','Quadro de Mestre'),('Beta','Quadro de Mestre'),('Auxiliar','Quadro de Mestre');");
  // Segundo dirigente inalterado também precisa de elegibilidade ao mudar tipo.
  sql("DELETE FROM public.members WHERE name='Beta';");
  error(metadata(historical, { type: 'Primeira Escala', explanador: 'Explanador', leitor: 'Leitor' }), /segundo dirigente deve/);
  sql("INSERT INTO public.members(name,grau) VALUES ('Beta','Quadro de Mestre');");
  console.log('Passou: edição histórica preserva funções e não recria membros; mudança de contexto revalida');

  sql(asRole('editor', `DELETE FROM public.session WHERE id=${quote(id)};`));
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(stock)};`, '89.00');
  check(`SELECT count(*) FROM public.stock_movement WHERE vegetal_id=${quote(stock)} AND type='Ajuste' AND quantity=-1 AND session_id IS NULL;`, 1);
  const first = lot(10), second = lot(5);
  const unionId = sql(registration(session({ is_united: true, total_consumed: 6 }), [
    { vegetal_id: first, amount_available: 10 }, { vegetal_id: second, amount_available: 5 },
  ]));
  const balance = sql(`SELECT vegetal_id FROM public.stock_movement WHERE session_id=${quote(unionId)} AND type='Saldo';`);
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(balance)};`, '9.00');
  sql(asRole('editor', `DELETE FROM public.session WHERE id=${quote(unionId)};`));
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(first)};`, '10.00');
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(second)};`, '5.00');
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(balance)};`, '0.00');
  check(`SELECT string_agg(quantity::text,',' ORDER BY quantity) FROM public.stock_movement
    WHERE vegetal_id IN (${quote(first)},${quote(second)},${quote(balance)}) AND type='Ajuste';`, '-10.00,-5.00,9.00');
  await concurrentReversal(true);
  console.log('Passou: estorno simples/união, sinais do ledger e concorrência sem saldo negativo');
}

let started = false;
try {
  execFileSync(path.join(bin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8'], { stdio: 'pipe' });
  execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(temp, 'postgres.log'), '-o', `-k ${temp} -p 55482 -h ''`, 'start'], { stdio: 'pipe' });
  started = true;
  bootstrap();
  await reproduce();
  if (!process.argv.includes('--reproduce-only')) {
    await verify();
    runUnicodeTests({ sql });
  }
} finally {
  if (started) execFileSync(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'pipe' });
  rmSync(temp, { recursive: true, force: true });
}
