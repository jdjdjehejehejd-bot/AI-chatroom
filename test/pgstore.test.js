/* Postgres 저장소 어댑터(pgstore.js): pg-mem(메모리 속 Postgres)으로 쓰기·읽기·목록·삭제·재시작 뒤 복원·실패 재시도를 확인하고,
   DB에 닿지 못할 때 서버가 메모리 저장으로 내려가 정상 기동하는지(연결 문자열을 로그에 남기지 않는지) 확인한다. */
const { newDb } = require('pg-mem'); const { spawn } = require('child_process'); const path = require('path'); const http = require('http');
const { makeStore, loadAll, sslFor } = require('../pgstore');
const res = []; const check = (n, c, d) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const quiet = { log() {}, error() {} };
(async () => {
  const db = newDb(); const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const s1 = makeStore(pool, await loadAll(pool), quiet);
  s1.write('accounts', { a: { rooms: { r1: 1 } } });
  s1.write('rooms/r1', { id: 'r1', messages: ['안녕'] }); s1.write('rooms/r2', { id: 'r2' }); s1.write('rooms/deep/x', { id: 'x' });
  check('read returns what was written, right away', s1.read('rooms/r1').messages[0] === '안녕');
  check('read returns a fresh copy (callers may mutate it)', (() => { const a = s1.read('rooms/r1'); a.id = 'zz'; return s1.read('rooms/r1').id === 'r1'; })());
  check('list(prefix) lists only direct children', JSON.stringify(s1.list('rooms').sort()) === '["rooms/r1","rooms/r2"]', JSON.stringify(s1.list('rooms')));
  for (let i = 0; i < 50; i++) s1.write('rooms/r2', { id: 'r2', n: i });   // 같은 키 연속 쓰기는 마지막 값만 남는다
  s1.remove('rooms/deep/x');
  await s1.flush();
  check('nothing left pending after flush', s1.pending() === 0, s1.pending());
  const s2 = makeStore(pool, await loadAll(pool), quiet);   // 재시작을 흉내: DB에서 새로 읽는다
  check('after restart: rooms and accounts come back from the DB', s2.read('rooms/r1') && s2.read('rooms/r1').messages[0] === '안녕' && s2.read('accounts').a.rooms.r1 === 1);
  check('after restart: the last of many writes wins', s2.read('rooms/r2').n === 49, JSON.stringify(s2.read('rooms/r2')));
  check('after restart: removed keys stay removed', s2.read('rooms/deep/x') === null);
  s2.remove('rooms/r1'); await s2.flush();
  check('remove reaches the DB', !(await loadAll(pool))['rooms/r1']);
  check('read of a missing key is null', s2.read('nope') === null);
  // 실패 재시도: 처음 두 번은 쿼리가 실패하는 풀
  let fails = 2; const flaky = { query: (q, p) => (/INSERT|DELETE/.test(q) && fails-- > 0) ? Promise.reject(new Error('connection reset')) : pool.query(q, p), end: () => Promise.resolve() };
  const s3 = makeStore(flaky, {}, quiet); s3.write('shares', { k: 1 }); await s3.flush();
  check('a failed write is retried until it lands', (await loadAll(pool)).shares === '{"k":1}', (await loadAll(pool)).shares);
  check('TLS is verified by default, off for localhost', sslFor('postgres://u:p@db.example.com/x', {}).rejectUnauthorized === true && sslFor('postgres://u:p@localhost:5432/x', {}) === false);

  // 서버: DB에 닿지 못하면 메모리 저장으로 기동하고, 연결 문자열(비밀번호)을 로그에 남기지 않는다
  const port = 3391; let out = '';
  const sv = spawn('node', ['server.js'], { cwd: path.resolve(__dirname, '..'), env: Object.assign({}, process.env, { PORT: String(port), REQUIRE_LOGIN: '0', SESSION_SECRET: 's', DATABASE_URL: 'postgres://u:SECRETPW@127.0.0.1:1/db' }), stdio: ['ignore', 'pipe', 'pipe'] });
  sv.stdout.on('data', d => out += d); sv.stderr.on('data', d => out += d);
  try {
    let hz = null;
    for (let i = 0; i < 40 && !hz; i++) { await sleep(250); hz = await new Promise(r => http.get('http://127.0.0.1:' + port + '/healthz', x => { let b = ''; x.on('data', c => b += c); x.on('end', () => { try { r(JSON.parse(b)); } catch (e) { r(null); } }); }).on('error', () => r(null))); }
    check('unreachable DB: server still starts (memory only)', hz && hz.ok && hz.store === 'memory', JSON.stringify(hz));
    check('unreachable DB: the failure is logged', /DB에 연결하지 못해/.test(out), out.slice(0, 300));
    check('the connection string never reaches the log', !/SECRETPW/.test(out), out.slice(0, 300));
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('FAIL crashed :: ' + e.stack); process.exit(1); });
