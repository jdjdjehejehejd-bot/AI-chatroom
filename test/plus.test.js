/* 플러스는 임시로 AI 수·호출 예산·일일 크레딧이 모두 제한 없음(결제 전 정책). 무료는 AI 5명 */
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const start = (port, dir) => spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, ADMIN_TOKEN: 'adm', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }), stdio: 'ignore' });
const cl = (port, room, name) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name, consent: true })); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
const events = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).events;
const kpi = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).kpi;
const sum = (e, k) => Object.values(e).reduce((a, d) => a + (d[k] || 0), 0);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unl-')); const port = 3392; const sv = start(port, dir);
  try {
    await sleep(900);
    const F = await cl(port, 'fr1', 'Ann');
    for (let i = 0; i < 6; i++) { F.s({ t: 'addAI', name: 'F' + i, persona: 'p', provider: 'demo' }); await sleep(700); }
    const mf = [...F.ev].reverse().find(e => e.t === 'meta');
    check('free: 5 AIs max (6th refused)', mf.ais.length === 5 && F.ev.some(e => e.t === 'err' && /최대 5명/.test(e.text)), mf.ais.length);
    const P = await cl(port, 'pl1', 'Bob'); P.s({ t: 'plan', id: 'plus' }); await sleep(300);
    for (let i = 0; i < 9; i++) { P.s({ t: 'addAI', name: 'P' + i, persona: 'p', provider: 'demo' }); await sleep(700); }
    P.s({ t: 'config', budgetLimit: 5000 }); await sleep(300);
    const mp = [...P.ev].reverse().find(e => e.t === 'meta');
    check('plus: more than 6 AIs allowed', mp.ais.length === 9, mp.ais.length);
    check('plus: budget limit and plan caps are unlimited', mp.budget.limit === 5000 && mp.budgetMax >= 1000000 && mp.plan.ais >= 1000000, JSON.stringify([mp.budget, mp.budgetMax, mp.plan]));
    check('plus: no error during setup', !P.ev.some(e => e.t === 'err'), JSON.stringify(P.ev.filter(e => e.t === 'err')));
    F.ws.close(); P.ws.close();
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
