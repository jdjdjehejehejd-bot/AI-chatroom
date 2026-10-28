/* 라이트 유저 첫 경험: AI가 한 명뿐이면 @ 없이도 답하고, 둘 이상이면 기존처럼 멘션이 있어야 답한다 */
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const start = (port, dir) => spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, ADMIN_TOKEN: 'adm', REQUIRE_LOGIN: '0', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }), stdio: 'ignore' });
const cl = (port, room, name) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name, consent: true })); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
const cnt = A => A.ev.filter(e => e.t === 'msg' && e.msg && e.msg.kind === 'ai').length;
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-')); const port = 3394; const sv = start(port, dir);
  try {
    await sleep(900);
    const A = await cl(port, 'qs1', 'Ann'); const send = async o => { A.s(o); await sleep(800); };
    await send({ t: 'addAI', name: 'AI', persona: '', provider: 'demo' });
    const n0 = cnt(A);
    await send({ t: 'msg', text: '안녕, 오늘 뭐 먹지?' }); await sleep(1500);
    const n1 = cnt(A);
    check('one AI answers without @mention', n1 > n0, [n0, n1]);
    await send({ t: 'addAI', name: 'Bob', persona: '', provider: 'demo' });
    const n2 = cnt(A);
    await send({ t: 'msg', text: '둘 다 있을 때 멘션 없는 말' }); await sleep(1200);
    check('two AIs: no mention means no reply', cnt(A) === n2, '');
    // AI끼리 대화 구경
    const B = await cl(port, 'qs2', 'Bea'); const sb = async o => { B.s(o); await sleep(800); };
    await sb({ t: 'spectate', text: '짜장면 vs 짬뽕' });
    check('spectate needs 2+ AIs', B.ev.some(e => e.t === 'err' && /2명/.test(e.text)), JSON.stringify(B.ev.filter(e => e.t === 'err')));
    await sb({ t: 'addAI', name: 'A1', persona: '', provider: 'demo' }); await sb({ t: 'addAI', name: 'A2', persona: '', provider: 'demo' });
    const m0 = cnt(B);
    await sb({ t: 'spectate', text: '짜장면 vs 짬뽕', turns: 4 }); await sleep(2500);
    const m1 = cnt(B) - m0;
    check('spectate: AIs talk 2..4 turns', m1 >= 2 && m1 <= 4, m1);
    const st = [...B.ev].reverse().find(e => e.t === 'meta' || e.t === 'state');
    check('spectate restores policy', st && (st.policy || (st.room && st.room.policy)) === 'mention', JSON.stringify(st && st.policy));
    await sb({ t: 'spectate', text: 'x', turns: 999 }); await sleep(3000);
    check('spectate turns are capped (<=8 more)', cnt(B) - m0 - m1 <= 8, cnt(B) - m0 - m1);
    B.ws.close();
    A.ws.close();
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
