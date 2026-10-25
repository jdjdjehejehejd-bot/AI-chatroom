/* 단일 AI 비교: 같은 요청을 AI 한 명이 혼자 처리한 답을 받아 나란히 비교하고, 투표는 버전당 한 번 익명 집계한다 */
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-')); const port = 3393; const sv = start(port, dir);
  try {
    await sleep(900);
    const A = await cl(port, 'cm1', 'Ann'); const send = async o => { A.s(o); await sleep(700); };
    await send({ t: 'compare' });
    check('compare without a deliverable is ignored', !A.ev.some(e => e.t === 'compare'), '');
    await send({ t: 'mode', id: 'make' }); await send({ t: 'msg', text: '웹페이지 만들어줘' }); await sleep(2500);
    const dv = A.ev.filter(e => e.t === 'deliv' && e.deliv).pop(); const v = dv.deliv.v;
    const used0 = [...A.ev].reverse().find(e => e.t === 'budget' || e.t === 'meta'); const u0 = ([...A.ev].reverse().find(e => e.t === 'budget') || { budget: used0.budget }).budget.used;
    await send({ t: 'compare' }); await sleep(800);
    const c = A.ev.filter(e => e.t === 'compare').pop();
    check('compare returns a single-AI answer for the current version', c && c.compare.v === v && /데모/.test(c.compare.text), JSON.stringify(c));
    const u1 = [...A.ev].reverse().find(e => e.t === 'budget').budget.used;
    check('compare costs exactly 1 AI call from the room budget', u1 === u0 + 1, [u0, u1]);
    await send({ t: 'compare' }); await sleep(500);
    check('second compare for the same version is ignored (no extra call)', [...A.ev].reverse().find(e => e.t === 'budget').budget.used === u1, '');
    await send({ t: 'kpi', n: 'compare_vote', v, r: 'evil' }); await send({ t: 'kpi', n: 'compare_vote', v: 99, r: 'multi' });
    await send({ t: 'kpi', n: 'compare_vote', v, r: 'multi' }); await send({ t: 'kpi', n: 'compare_vote', v, r: 'single' });
    const e = await events(port); const k = await kpi(port);
    check('votes: invalid ignored, one per version, flow-tagged', sum(e, 'compare_vote.multi') === 1 && sum(e, 'compare_vote.single') === 0 && sum(e, 'compare_vote.multi.make') === 1 && sum(e, 'compare_run') === 1, JSON.stringify(e));
    check('admin kpi: compare summary', k.compare.runs === 1 && k.compare.voted === 1 && k.compare.multi === 1 && k.compare.multiBetterRate === 1, JSON.stringify(k.compare));
    check('events carry no request text', !/웹페이지|Ann|cm1/.test(JSON.stringify(e)), 'leak');
    A.ws.close();
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
