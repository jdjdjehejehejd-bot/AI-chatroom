/* 개발 모드(DEV_UNLIMITED=1): 모든 방이 플러스, 인원·예산·일일 크레딧·방 무료 한도가 풀린다. 끄면 원래 무료 한도 */
const { spawn } = require('child_process'), path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const run = async (port, env) => {
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }, env), stdio: 'ignore' });
  await sleep(900);
  const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
  await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', room: 'dev1', name: 'Ann', consent: true })); await sleep(400);
  for (let i = 1; i <= 7; i++) { ws.send(JSON.stringify({ t: 'addAI', name: 'A' + i, persona: '', provider: 'demo' })); await sleep(120); }
  await sleep(400);
  const meta = ev.filter(e => e.t === 'meta').pop(); const h = await (await fetch('http://127.0.0.1:' + port + '/healthz')).json();
  ws.close(); sv.kill(); return { meta, h, errs: ev.filter(e => e.t === 'err').map(e => e.text) };
};
(async () => {
  const on = await run(3331, { DEV_UNLIMITED: '1' });
  check('dev mode: room is plus (unlimited budget)', on.meta.plan.id === 'plus' && on.meta.budget.limit >= 1000000, JSON.stringify({ plan: on.meta.plan.id, b: on.meta.budget }));
  check('dev mode: more than 5 AIs allowed', on.meta.ais.length === 7, on.meta.ais.length + ' ' + on.errs);
  check('dev mode: room free cap lifted, healthz says dev', on.meta.free.roomCap >= 1000000 && on.h.dev === true && on.h.managedDailyCap === 300, JSON.stringify(on.meta.free));
  const off = await run(3332, { DEV_UNLIMITED: '0' });
  check('dev mode off: normal free limits (5 AIs, budget 30)', off.meta.plan.id === 'free' && off.meta.ais.length === 5 && off.meta.budget.limit === 30 && off.h.dev === false, JSON.stringify({ p: off.meta.plan.id, n: off.meta.ais.length, b: off.meta.budget }));
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
