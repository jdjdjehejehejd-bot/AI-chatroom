#!/usr/bin/env node
/* 실제 AI 제공사 스모크 테스트. 자동 테스트(npm test)는 가짜 서버만 쓰므로, 배포 전에 이 스크립트로 진짜 호출을 한 번 확인한다.
   키를 넣은 제공사만 검사한다. 모델 이름은 제공사가 자주 바꾸므로 직접 지정해야 한다.

   예) ANTHROPIC_API_KEY=... SMOKE_MODEL_ANTHROPIC=<모델> OPENAI_API_KEY=... SMOKE_MODEL_OPENAI=<모델> node scripts/smoke-providers.js
       node scripts/smoke-providers.js groq        (일부 제공사만)

   제공사별 환경변수: <ANTHROPIC|OPENAI|OPENROUTER|GROQ|GOOGLE|MISTRAL|NVIDIA>_API_KEY, SMOKE_MODEL_<같은 이름>
   검사 항목(제공사마다): ① 정상 호출 ② 잘못된 키 ③ 없는 모델 — 성공/오류 모두에서 서버가 죽지 않고 사람이 읽을 메시지를 내는지,
   방 예산이 호출 수만큼만 차감되는지. 호출은 제공사당 3회(작은 요청)이며 비용이 발생할 수 있다. 키는 출력하지 않는다. */
const { spawn } = require('child_process'), path = require('path');
const WS = require('ws');
const ROOT = path.resolve(__dirname, '..');
const ALL = ['anthropic', 'openai', 'openrouter', 'groq', 'google', 'mistral', 'nvidia'];
const want = process.argv.slice(2).filter(a => ALL.includes(a));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const line = (ok, name, info) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); };

async function withServer(env, fn) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), REQUIRE_LOGIN: '0' }, env), stdio: 'ignore' });
  try {
    for (let i = 0; i < 30; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/healthz')).ok) break; } catch (e) {} await sleep(200); }
    return await fn(port);
  } finally { sv.kill(); }
}
function client(port, room) {
  return new Promise(res => {
    const ws = new WS('ws://127.0.0.1:' + port + '/ws'), ev = [];
    ws.on('message', d => ev.push(JSON.parse(d)));
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name: 'Smoke', consent: true })); setTimeout(() => res({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 500); });
  });
}
async function ask(c, name, provider, model, key, timeout) {
  const t0 = Date.now(), before = c.ev.length;
  c.s({ t: 'addAI', name, persona: '한 문장으로 짧게 답한다.', provider, model, apiKey: key });
  await sleep(500);
  c.s({ t: 'msg', text: '@' + name + ' 안녕, 한 문장으로 인사해줘.' });
  while (Date.now() - t0 < timeout) {
    const seen = c.ev.slice(before);
    if (seen.some(e => e.t === 'msg' && e.msg.who === name && e.msg.kind !== 'system') || seen.some(e => e.t === 'msg' && /응답 오류/.test(e.msg.text || '') && (e.msg.text || '').includes(name))) break;
    await sleep(300);
  }
  const seen = c.ev.slice(before);
  const ok = seen.find(e => e.t === 'msg' && e.msg.who === name && e.msg.kind !== 'system');
  const err = seen.find(e => e.t === 'msg' && /응답 오류/.test(e.msg.text || '') && (e.msg.text || '').includes(name));
  return { ok: ok && ok.msg, err: err && err.msg.text, ms: Date.now() - t0 };
}

(async () => {
  const targets = ALL.filter(p => (!want.length || want.includes(p)) && process.env[p.toUpperCase() + '_API_KEY']);
  if (!targets.length) { console.log('키가 설정된 제공사가 없습니다. 예: OPENAI_API_KEY=... SMOKE_MODEL_OPENAI=<모델> node scripts/smoke-providers.js'); process.exit(2); }
  for (const p of targets) {
    const key = process.env[p.toUpperCase() + '_API_KEY'], model = process.env['SMOKE_MODEL_' + p.toUpperCase()];
    if (!model) { line(false, p, 'SMOKE_MODEL_' + p.toUpperCase() + '에 모델 이름을 지정하세요.'); continue; }
    await withServer({}, async port => {
      const c = await client(port, 'smoke' + p.slice(0, 4));
      const good = await ask(c, 'Good', p, model, key, 90000);
      line(!!good.ok && !good.err, p + ' 정상 호출', good.ok ? good.ms + 'ms, ' + String(good.ok.text).slice(0, 40).replace(/\s+/g, ' ') : (good.err || '응답 없음'));
      const bad = await ask(c, 'BadKey', p, model, 'sk-invalid-smoke-key', 60000);
      line(!bad.ok && !!bad.err, p + ' 잘못된 키 → 오류 메시지', bad.err ? bad.err.slice(0, 80) : '오류 메시지가 없음');
      const nom = await ask(c, 'NoModel', p, 'no-such-model-smoke', key, 60000);
      line(!nom.ok && !!nom.err, p + ' 없는 모델 → 오류 메시지', nom.err ? nom.err.slice(0, 80) : '오류 메시지가 없음');
      const st = c.ev.filter(e => e.t === 'budget').pop();
      line(!!st && st.budget.used === 3, p + ' 예산 차감 3회', st ? 'used=' + st.budget.used : '예산 이벤트 없음');
      let alive = false; try { alive = (await fetch('http://127.0.0.1:' + port + '/healthz')).ok; } catch (e) {}
      line(alive, p + ' 서버 생존');
      c.ws.close();
    });
  }
  console.log(failed ? failed + '개 실패' : '모두 통과'); process.exit(failed ? 1 : 0);
})();
