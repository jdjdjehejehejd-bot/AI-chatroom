/* 익명 깔때기·재방문 이벤트: 방 단위로 한 번씩만, 사용자 식별자·내용 없음, 클라이언트 이벤트는 허용 목록만 */
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const start = (port, dir) => spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, ADMIN_TOKEN: 'adm', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }), stdio: 'ignore' });
const cl = (port, room, name) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name, consent: true })); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
const events = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).events;
const sum = (e, k) => Object.values(e).reduce((a, d) => a + (d[k] || 0), 0);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-')); const port = 3391; let sv = start(port, dir);
  try {
    await sleep(900);
    const A = await cl(port, 'kp1', 'Ann');
    A.s({ t: 'mode', id: 'make' }); await sleep(300);
    A.s({ t: 'msg', text: '웹페이지 만들어줘' }); await sleep(2500);
    A.s({ t: 'msg', text: '조금 고쳐줘' }); await sleep(2500);
    A.s({ t: 'share', kind: 'result' }); await sleep(300);
    A.s({ t: 'kpi', n: 'deliv_copy' }); A.s({ t: 'kpi', n: 'deliv_download' }); A.s({ t: 'kpi', n: 'evil_event' }); await sleep(300);
    let e = await events(port);
    check('funnel: each step counted once per room', ['first_human_msg', 'first_ai_reply', 'first_deliverable', 'first_share'].every(k => sum(e, k) === 1), JSON.stringify(e));
    check('client kpi: allow-list only', sum(e, 'deliv_copy') === 1 && sum(e, 'deliv_download') === 1 && sum(e, 'evil_event') === 0, JSON.stringify(e));
    check('events carry no room id / name / text', !/kp1|Ann|웹페이지/.test(JSON.stringify(e)), 'leak');
    A.ws.close(); await sleep(1500);
    // 방 나이를 3일 전으로 돌려 재시작 → 재방문(d2_7), 같은 날 두 번째 입장은 세지 않는다
    sv.kill(); await sleep(600);
    const f = path.join(dir, 'rooms', 'kp1.json'); const d = JSON.parse(fs.readFileSync(f, 'utf8')); d.created = Date.now() - 3 * 86400000; fs.writeFileSync(f, JSON.stringify(d));
    sv = start(port, dir); await sleep(1000);
    const B = await cl(port, 'kp1', 'Bob'); B.ws.close(); await sleep(300);
    const B2 = await cl(port, 'kp1', 'Bob'); B2.ws.close(); await sleep(300);
    e = await events(port);
    check('room return counted once per day (age bucket d2_7)', sum(e, 'room_return.d2_7') === 1 && !sum(e, 'room_return.d1') && !sum(e, 'room_return.d8p'), JSON.stringify(e));
    const E = await cl(port, 'kp2', 'Eve'); E.ws.close(); await sleep(300);
    e = await events(port);
    check('a brand-new room is not a return', sum(e, 'room_return.d2_7') === 1, JSON.stringify(e));
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
