'use strict';
/* Postgres 저장소 어댑터. store.js와 같은 인터페이스(read/write/remove/list, 모두 동기)를 지킨다.
   - 시작할 때 표 전체를 한 번 읽어 메모리에 올린다(서버 코드가 동기 읽기를 가정하므로).
     이 읽기는 별도 자식 프로세스(node pgstore.js --dump)로 동기 실행한다.
   - 쓰기·삭제는 메모리를 바로 바꾸고, DB 반영은 뒤에서 차례로 한다(같은 키는 마지막 값만).
   - 끝낼 때 close()로 남은 쓰기를 모두 보낸 뒤 연결을 닫는다.
   - DB에 닿지 못하면 저장 없이(메모리만) 시작하고 DB의 기존 데이터는 건드리지 않는다.
   연결 문자열(DATABASE_URL)은 로그에 남기지 않는다. */
const TABLE = 'mm_kv';
const DDL = 'CREATE TABLE IF NOT EXISTS ' + TABLE + ' (k text PRIMARY KEY, v text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())';

function sslFor(url, env = process.env) {
  const mode = String(env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'off' || /sslmode=disable/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url)) return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}
function makePool(url) {
  const { Pool } = require('pg');
  return new Pool({ connectionString: url, ssl: sslFor(url), max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000 });
}
async function loadAll(pool) {
  let r;
  try { r = await pool.query('SELECT k, v FROM ' + TABLE); }
  catch (e) { if (e.code !== '42P01' && !/does not exist/.test(e.message)) throw e; await pool.query(DDL); return {}; }   // 처음이면 표를 만든다
  const out = {}; for (const row of r.rows) out[row.k] = row.v; return out;
}

/* rows: {키: JSON 문자열}. pool은 pg Pool 호환 객체(테스트는 pg-mem). */
function makeStore(pool, rows, log = console) {
  const cache = new Map(Object.entries(rows || {}));
  const pending = new Map();   // 키 → 문자열(쓰기) 또는 null(삭제)
  let running = null, failures = 0;
  async function drain() {
    while (pending.size) {
      const [k, v] = pending.entries().next().value; pending.delete(k);
      try {
        if (v === null) await pool.query('DELETE FROM ' + TABLE + ' WHERE k = $1', [k]);
        else await pool.query('INSERT INTO ' + TABLE + ' (k, v, updated_at) VALUES ($1, $2, now()) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()', [k, v]);
        failures = 0;
      } catch (e) {
        if (!pending.has(k)) pending.set(k, v);   // 더 새 값이 없으면 다시 시도
        failures++; log.error('DB 저장 실패(' + k + '):', e.message);
        await new Promise(r => setTimeout(r, Math.min(30000, 250 * 2 ** Math.min(failures, 7))));
        if (failures > 20) { log.error('DB 저장을 계속 실패해 잠시 멈춥니다.'); return; }
      }
    }
  }
  function kick() { if (!running) running = drain().finally(() => { running = null; if (pending.size && failures <= 20) kick(); }); return running; }
  return {
    enabled: true, kind: 'postgres',
    read(name) { const v = cache.get(name); if (v === undefined) return null; try { return JSON.parse(v); } catch (e) { return null; } },
    write(name, obj) { const v = JSON.stringify(obj); if (cache.get(name) === v) return; cache.set(name, v); pending.set(name, v); kick(); },
    remove(name) { if (!cache.has(name)) return; cache.delete(name); pending.set(name, null); kick(); },
    list(prefix) { const p = prefix + '/'; return [...cache.keys()].filter(k => k.startsWith(p) && !k.slice(p.length).includes('/')); },
    pending() { return pending.size + (running ? 1 : 0); },
    async flush() { failures = 0; while (pending.size || running) await kick(); },
    async close() { try { await this.flush(); } finally { await pool.end().catch(() => {}); } }
  };
}

/* 서버용: 동기로 미리 읽고 저장소를 만든다. 실패하면 null(호출한 쪽이 메모리 저장으로 내려간다). */
function createPgStore(url, log = console) {
  const { execFileSync } = require('child_process');
  let rows;
  try {
    const out = execFileSync(process.execPath, [__filename, '--dump'], { env: Object.assign({}, process.env, { MM_PG_URL: url }), maxBuffer: 512 * 1024 * 1024, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
    rows = JSON.parse(out.toString('utf8'));
  } catch (e) {
    const msg = String((e.stderr && e.stderr.toString()) || e.message || '').split('\n').filter(Boolean).pop() || 'unknown';
    log.error('DB에 연결하지 못해 저장 없이(메모리만) 시작합니다:', msg.replace(/postgres(ql)?:\/\/\S+/g, '[DATABASE_URL]'));
    return null;
  }
  log.log('DB 저장소 사용: 항목 ' + Object.keys(rows).length + '개를 불러왔습니다.');
  return makeStore(makePool(url), rows, log);
}

if (require.main === module && process.argv[2] === '--dump') {
  const pool = makePool(process.env.MM_PG_URL || '');
  loadAll(pool).then(rows => { process.stdout.write(JSON.stringify(rows)); return pool.end(); })
    .catch(e => { process.stderr.write(String(e.message || e).replace(/postgres(ql)?:\/\/\S+/g, '[DATABASE_URL]') + '\n'); process.exit(1); });
}
module.exports = { createPgStore, makeStore, loadAll, sslFor, TABLE, DDL };
