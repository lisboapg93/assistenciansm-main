// Executado pelo harness PostgreSQL descartável em test-session-sql.mjs.
// O teste não recebe URL nem credenciais de bancos externos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL(
  '../supabase/migrations/20261107110000_normalize_member_unicode.sql', import.meta.url,
), 'utf8');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const ids = {
  composed: '71000000-0000-0000-0000-000000000001',
  decomposed: '71000000-0000-0000-0000-000000000002',
  indexed: '71000000-0000-0000-0000-000000000003',
  editor: '71000000-0000-0000-0000-000000000011',
  assistant: '71000000-0000-0000-0000-000000000012',
  viewer: '71000000-0000-0000-0000-000000000013',
};

export function runUnicodeTests({ sql }) {
  const check = (statement, expected) => assert.equal(sql(statement), String(expected));
  const error = (statement, expected) => assert.throws(() => sql(statement), (failure) => {
    assert.match(failure.stderr.toString(), expected);
    return true;
  });
  const asRole = (role, statement) => role === 'anon'
    ? `SET ROLE anon; ${statement}`
    : `SET ROLE authenticated; SET request.jwt.claim.sub=${quote(ids[role])}; ${statement}`;
  const members = () => sql(`SELECT jsonb_agg(to_jsonb(member) ORDER BY id)
    FROM public.members AS member;`);
  const sessions = () => sql(`SELECT jsonb_agg(to_jsonb(session) ORDER BY id)
    FROM public.session AS session;`);
  const functionDefinition = () => sql(`SELECT pg_get_functiondef('public.person_name_key(text)'::regprocedure);`);
  const index = () => sql(`SELECT indexrelid, indisvalid, indisunique
    FROM pg_index WHERE indexrelid='public.members_identity_key_unique_idx'::regclass;`);
  const policies = () => sql(`SELECT jsonb_agg(to_jsonb(policy) ORDER BY tablename, policyname)
    FROM pg_policies AS policy WHERE schemaname='public';`);
  const functionAcl = () => sql(`SELECT coalesce(proacl::text, '') FROM pg_proc
    WHERE oid='public.person_name_key(text)'::regprocedure;`);

  sql(`INSERT INTO auth.users(id,email) VALUES
    (${quote(ids.editor)},'unicode-editor@example.invalid'),
    (${quote(ids.assistant)},'unicode-assistant@example.invalid'),
    (${quote(ids.viewer)},'unicode-viewer@example.invalid');
    UPDATE public.user_roles SET role='editor' WHERE user_id=${quote(ids.editor)};
    UPDATE public.user_roles SET role='assistant' WHERE user_id=${quote(ids.assistant)};
    INSERT INTO public.members(id,name,grau,is_socio_nucleo) VALUES
    (${quote(ids.composed)},'João Unicode','Quadro de Mestre',true),
    (${quote(ids.decomposed)},${quote('M. Joa\u0303o Unicode')},'Corpo Instrutivo',false),
    (${quote(ids.indexed)},${quote('Lu\u0301cia Unicode')},'Corpo do Conselho',true);`);
  check(`SELECT public.person_name_key('João')=public.person_name_key(${quote('Joa\u0303o')});`, 'f');
  check(`SELECT count(*) FROM public.members WHERE id IN (${quote(ids.composed)},${quote(ids.decomposed)});`, 2);
  const oldMembers = members();
  const oldSessions = sessions();
  const oldFunction = functionDefinition();
  const oldIndex = index();
  const oldPolicies = policies();
  const oldAcl = functionAcl();

  // Sem BEGIN externo: o próprio bloco da migration deve desfazer função e
  // índice quando encontrar atributos conflitantes, sem excluir cadastros.
  error(migration, /Normalização Unicode encontrou 1 grupo\(s\) de membros duplicados/);
  assert.equal(members(), oldMembers);
  assert.equal(sessions(), oldSessions);
  assert.equal(functionDefinition(), oldFunction);
  assert.equal(index(), oldIndex);
  assert.equal(policies(), oldPolicies);
  assert.equal(functionAcl(), oldAcl);
  console.log('Passou: colisão Unicode aborta e preserva dados, atributos, histórico, função e índice');

  // A remoção é exclusivamente da fixture conhecida neste banco descartável.
  sql(`DELETE FROM public.members WHERE id=${quote(ids.decomposed)};`);
  const beforeMembers = members();
  const beforeSessions = sessions();
  sql(migration);
  assert.equal(members(), beforeMembers);
  assert.equal(sessions(), beforeSessions);
  assert.equal(policies(), oldPolicies);
  assert.equal(functionAcl(), oldAcl);
  assert.notEqual(index(), oldIndex);
  check(`SELECT indisvalid AND indisunique FROM pg_index
    WHERE indexrelid='public.members_identity_key_unique_idx'::regclass;`, 't');
  for (const [composed, decomposed] of [
    ['João', 'Joa\u0303o'], ['Lúcia', 'Lu\u0301cia'], ['Ḍaniel', 'D\u0323aniel'],
  ]) {
    check(`SELECT public.person_name_key(${quote(composed)})=public.person_name_key(${quote(decomposed)});`, 't');
  }
  check(`SELECT public.person_name_key('Ḍaniel');`, 'daniel');
  check(`SELECT public.person_name_key(NULL) IS NULL AND public.person_name_key('  ') IS NULL;`, 't');
  // Uma linha armazenada apenas em NFD só será encontrada pelo novo valor
  // composto se a entrada física do índice tiver sido recalculada.
  check(`SET enable_seqscan=off; SELECT id FROM public.members
    WHERE public.member_identity_key(name,grau)=public.member_identity_key('C. Lúcia Unicode',NULL);`, ids.indexed);
  assert.match(sql(`SET enable_seqscan=off; EXPLAIN SELECT id FROM public.members
    WHERE public.member_identity_key(name,grau)=public.member_identity_key('C. Lúcia Unicode',NULL);`),
  /Index Scan|Bitmap Index Scan/);
  error(`INSERT INTO public.members(name,grau) VALUES(${quote('Joa\u0303o Unicode')},'Quadro de Mestre');`,
    /Já existe um membro com este nome/);
  // Desativa somente o trigger amigável dentro da transação que falhará,
  // comprovando que a unicidade também é garantida pelo índice reconstruído.
  error(`BEGIN; ALTER TABLE public.members DISABLE TRIGGER prevent_member_display_name_duplicates_before_write;
    INSERT INTO public.members(name,grau) VALUES(${quote('Joa\u0303o Unicode')},'Quadro de Mestre'); COMMIT;`,
  /members_identity_key_unique_idx/);
  console.log('Passou: NFD/composta compartilham chave e índice reconstruído impede duplicatas');

  sql(`INSERT INTO public.members(name,grau) VALUES
    ('João Unicode','Corpo do Conselho'),('João Unicode','Quadro de Sócios');`);
  check(`SELECT count(DISTINCT public.member_identity_key(name,grau)) FROM public.members
    WHERE public.person_name_key(name)='joao unicode';`, 3);
  check(`SELECT public.member_identity_key('Mestre João Unicode',NULL)=
    public.member_identity_key(${quote('M. Joa\u0303o Unicode')},NULL);`, 't');
  check(`SELECT public.member_identity_key('Conselheira João Unicode',NULL)=
    public.member_identity_key(${quote('C. Joa\u0303o Unicode')},NULL);`, 't');

  const stock = sql(`INSERT INTO public.vegetal(name,quantity,initial_quantity,envase_date,master)
    VALUES('Fonte Unicode',10,10,'2026-11-07','M. João Unicode') RETURNING id;`);
  const data = {
    date: '2026-11-07', type: 'Extra', dirigente: 'M. Joa\u0303o Unicode',
    mestre_assistente: 'M. Joa\u0303o Unicode', registered_by_name: 'Operador Unicode',
    explanador: 'C. Joa\u0303o Unicode', leitor: 'Joa\u0303o Unicode',
    participants: { mestres: 1, conselheiros: 1, instrutivo: 0, socios: 1, visitantes: 0, jovens: 0 },
    total_participants: 3, total_consumed: 1, is_united: false,
  };
  const register = (role, extra = {}) => asRole(role,
    `SELECT public.register_session_with_consumption(${json({ ...data, ...extra })},
      ${json([{ vegetal_id: stock, amount_available: 10 }])});`);
  const first = sql(register('editor'));
  sql(register('assistant', { date: '2026-11-08' }));
  check(`SELECT dirigente=(SELECT public.member_display_name(name,grau)
    FROM public.members WHERE id=${quote(ids.composed)})
    FROM public.session WHERE id=${quote(first)};`, 't');
  error(register('editor', { leitor: 'Mestre João Unicode' }), /mesma pessoa/);
  error(register('editor', { dirigente: 'João Unicode', leitor: null }), /dirigente deve ser um membro elegível/);
  error(register('viewer'), /Sem permissão/);
  error(register('anon'), /permission denied/);
  for (const role of ['viewer', 'assistant', 'anon']) {
    error(asRole(role, `INSERT INTO public.members(name) VALUES('Sem permissão Unicode');`),
      /row-level security|permission denied/);
  }
  sql(asRole('editor', `INSERT INTO public.members(name) VALUES('Editor Unicode');`));
  check(`SELECT quantity FROM public.vegetal WHERE id=${quote(stock)};`, '8.00');
  console.log('Passou: M./C./sem título distintos, elegibilidade Unicode e autorização editor/assistant/viewer/anon');
}
