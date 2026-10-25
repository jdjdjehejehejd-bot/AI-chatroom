/* 토큰·비용 계측: 제공사가 보고한 usage만 기록하고, 없으면 추정하지 않고 "집계 불가"로 센다. 단가가 설정된 모델만 비용을 계산한다. */
const { spawn } = require('child_process'), http = require('http'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const mock = h => new Promise(r => { const s = http.createServer((q, a) => { let b = ''; q.on('data', d => b += d); q.on('end', () => h(q, JSON.parse(b || '{}'), a)); }).listen(0, '127.0.0.1', () => r(s)); });
const j = (a, o) => { a.setHeader('content-type', 'application/json'); a.end(JSON.stringify(o)); };
const cl = (port, room) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name: 'Ann', consent: true })); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
async function scenario(port, env, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tok-'));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, ADMIN_TOKEN: 'adm', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', OPENROUTER_API_KEY: '', GROQ_API_KEY: '' }, env), stdio: 'ignore' });
  try { await sleep(900); return await fn(); } finally { sv.kill(); await sleep(300); }
}
const kpiOf = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).kpi;
const events = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json());
const sum = (e, k) => Object.values(e.events).reduce((a, d) => a + (d[k] || 0), 0);
const freshMeta = async (port, room) => { const B = await cl(port, room); const m = B.ev.filter(e => e.t === 'meta').pop(); B.ws.close(); return m; };
const run = async (port, room) => { const A = await cl(port, room); if (!process.env.TOK_FREE) A.s({ t: 'plan', id: 'plus' }); await sleep(200); A.s({ t: 'mode', id: 'make' }); await sleep(400); A.s({ t: 'msg', text: '웹페이지 만들어줘' }); await sleep(2500); return A; };
(async () => {
  // 1) OpenAI 호환: usage 11/7, 단가 설정
  const oa = await mock((q, b, a) => j(a, { choices: [{ message: { content: '응답' } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }));
  await scenario(3341, { OPENAI_API_KEY: 'k', AI_MODEL: 'm1', OPENAI_BASE_URL: 'http://127.0.0.1:' + oa.address().port + '/v1', MODEL_PRICES: JSON.stringify({ 'openai/m1': { in: 2, out: 4 } }), MODEL_PRICES_VERSION: 'test-v1' }, async () => {
    const A = await run(3341, 'tk1');
    const rc = A.ev.filter(e => e.t === 'msg' && e.msg.code === 'RUN_RECEIPT').pop();
    check('receipt shows reported tokens', rc && /토큰 입력 44·출력 28\(제공사 보고 기준\)/.test(rc.msg.text), rc && rc.msg.text);
    const meta = await freshMeta(3341, 'tk1');
    check('room stats carry token totals', meta && meta.stats.tokIn === 44 && meta.stats.tokOut === 28, JSON.stringify(meta && meta.stats));
    const e = await events(3341);
    check('events: tokens per provider', sum(e, 'tok_in.openai') === 44 && sum(e, 'tok_out.openai') === 28, JSON.stringify(e.events));
    check('events: cost only when priced (4 calls x (11*2+7*4)=200 micro-USD)', sum(e, 'cost_micro.openai') === 200 && !sum(e, 'cost_unpriced.openai'), JSON.stringify(e.events));
    check('events: pricing metadata exposed', e.pricing.configured === 1 && e.pricing.version === 'test-v1', JSON.stringify(e.pricing));
    const kp = await kpiOf(3341);
    check('admin kpi: priced run cost = $0.0002, complete', kp.cost.usd === 0.0002 && kp.cost.status === 'fully_priced' && kp.cost.unpricedCalls === 0, JSON.stringify(kp.cost));
    check('no prompt/model/key in events', !/m1|tk1|웹페이지|"k"/.test(JSON.stringify(e.events)));
    A.ws.close();
  });
  // 2) 단가 미설정 → 토큰은 기록, 비용은 '단가 없음'으로 분리
  await scenario(3342, { OPENAI_API_KEY: 'k', AI_MODEL: 'm1', OPENAI_BASE_URL: 'http://127.0.0.1:' + oa.address().port + '/v1' }, async () => {
    const A = await run(3342, 'tk2'); const e = await events(3342);
    check('unpriced model: tokens kept, cost marked unpriced', sum(e, 'tok_in.openai') === 44 && !sum(e, 'cost_micro.openai') && sum(e, 'cost_unpriced.openai') === 4, JSON.stringify(e.events));
    const kp2 = await kpiOf(3342);
    check('admin kpi: unpriced calls flagged as incomplete cost', kp2.cost.status === 'incomplete' && kp2.cost.unpricedCalls === 4, JSON.stringify(kp2.cost));
    A.ws.close();
  });
  // 3) usage 없음 → 추정하지 않고 집계 불가
  const nu = await mock((q, b, a) => j(a, { choices: [{ message: { content: '응답' } }] }));
  await scenario(3343, { OPENAI_API_KEY: 'k', AI_MODEL: 'm1', OPENAI_BASE_URL: 'http://127.0.0.1:' + nu.address().port + '/v1' }, async () => {
    const A = await run(3343, 'tk3');
    const rc = A.ev.filter(e => e.t === 'msg' && e.msg.code === 'RUN_RECEIPT').pop();
    check('no usage: receipt omits tokens (no guessing)', rc && !/토큰/.test(rc.msg.text), rc && rc.msg.text);
    const meta = await freshMeta(3343, 'tk3'); const e = await events(3343);
    check('no usage: counted as missing', meta.stats.tokMissing === 4 && meta.stats.tokIn === 0 && sum(e, 'tok_missing.openai') === 4 && !sum(e, 'tok_in.openai'), JSON.stringify([meta.stats, e.events]));
    const kp3 = await kpiOf(3343);
    check('admin kpi: missing usage -> incomplete (never fully priced)', kp3.cost.status === 'incomplete' && kp3.cost.tokMissingCalls === 4, JSON.stringify(kp3.cost));
    A.ws.close();
  });
  // 3b) 실패 호출은 usage가 없으므로 비용 완전성을 보수적으로 미확인 처리, 실행은 failed로 센다
  let flip = 0;
  const bad = await mock((q, b, a) => { if (flip++ === 0) return j(a, { choices: [{ message: { content: '응답' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }); a.statusCode = 500; j(a, { error: { message: 'boom' } }); });
  await scenario(3345, { OPENAI_API_KEY: 'k', AI_MODEL: 'm1', MODEL_PRICES: JSON.stringify({ 'openai/m1': { in: 1, out: 2 } }), OPENAI_BASE_URL: 'http://127.0.0.1:' + bad.address().port + '/v1' }, async () => {
    const A = await run(3345, 'tk3b'); const kpf = await kpiOf(3345);
    check('failed call -> cost incomplete (failed calls unverified), run counted as failed', kpf.cost.status === 'incomplete' && kpf.cost.failedCallsUnverified >= 1 && kpf.runs.failed >= 1, JSON.stringify([kpf.cost, kpf.runs]));
    A.ws.close();
  });
  // 3c) 전역 비용 차단기: 서버 키 호출은 하루 합계 상한을 넘으면 제공사로 나가지 않는다
  const gm = await mock((q, b, a) => j(a, { choices: [{ message: { content: '응답' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
  await scenario(3346, { OPENAI_API_KEY: 'k', AI_MODEL: 'm1', MANAGED_DAILY_CALLS: '2', OPENAI_BASE_URL: 'http://127.0.0.1:' + gm.address().port + '/v1' }, async () => {
    const A = await run(3346, 'tk3c'); const kpg = await kpiOf(3346);
    const blocked = A.ev.some(e => e.t === 'msg' && e.msg.code === 'AI_ERROR' && /서버가 대신 내는 AI 호출 한도/.test(e.msg.text));
    check('managed-call cap: only 2 server-key calls go out, then blocked with a clear message', kpg.managed.today === 2 && kpg.managed.dailyCap === 2 && kpg.managed.blockedTotal >= 1 && blocked, JSON.stringify([kpg.managed, blocked]));
    A.ws.close();
  });
  // 4) Anthropic 형식
  const an = await mock((q, b, a) => j(a, { content: [{ type: 'text', text: '응답' }], usage: { input_tokens: 20, output_tokens: 5 } }));
  await scenario(3344, { ANTHROPIC_API_KEY: 'k', AI_MODEL: 'c1', ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + an.address().port }, async () => {
    const A = await run(3344, 'tk4'); const e = await events(3344);
    check('anthropic usage parsed', sum(e, 'tok_in.anthropic') === 80 && sum(e, 'tok_out.anthropic') === 20, JSON.stringify(e.events));
    A.ws.close();
  });
  // 5) 데모 모드는 토큰을 만들어 내지 않는다
  await scenario(3345, {}, async () => {
    const A = await run(3345, 'tk5'); const e = await events(3345);
    const rc = A.ev.filter(e2 => e2.t === 'msg' && e2.msg.code === 'RUN_RECEIPT').pop();
    check('demo mode: no token numbers invented', rc && !/토큰/.test(rc.msg.text) && !Object.values(e.events).some(d => Object.keys(d).some(k => /^tok_/.test(k))), JSON.stringify(e.events));
    A.ws.close();
  });
  oa.close(); nu.close(); an.close();
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
