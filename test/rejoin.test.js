/* 재접속·방 보존: 같은 사람(같은 열쇠)이 다시 들어오면 예전 연결을 정리하고 이어받음(사람 수 중복·이름 숫자·입장 알림 반복 없음),
   빈 방은 바로 지우지 않고 남겨 둠, 서버에 없는 방은 기기 기록(restore)으로 되살리되 값은 검증함 */
const { spawn } = require('child_process'), path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const port = 3353, U = 'ws://127.0.0.1:' + port + '/ws';
const cl = (room, name, key, extra) => new Promise(r => { const ws = new WS(U); const ev = []; let code = null; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('close', c => { code = c; }); ws.on('open', () => { ws.send(JSON.stringify(Object.assign({ t: 'join', room, name, key, consent: true }, extra || {}))); setTimeout(() => r({ ws, ev, code: () => code, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
(async () => {
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), REQUIRE_LOGIN: '0', DEMO_DELAY_MS: '20', SESSION_SECRET: 's' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const A1 = await cl('rj1', 'Hello', 'keyhello001');
    A1.s({ t: 'addAI', name: '가', persona: '', provider: 'demo' }); await sleep(300);
    const A2 = await cl('rj1', 'Hello', 'keyhello001');   // 같은 사람이 다시 접속(튕김·새로고침)
    await sleep(300);
    const st = A2.ev.find(e => e.t === 'state'); const mt = A2.ev.filter(e => e.t === 'meta').pop();
    check('rejoin keeps the same name (no "Hello2")', st && st.you === 'Hello', st && st.you);
    check('the person is counted once', mt && mt.humans.filter(h => h.startsWith('Hello')).length === 1, JSON.stringify(mt && mt.humans));
    check('old connection is closed as replaced (4000)', A1.code() === 4000, A1.code());
    check('no second join notice for the same person', A2.ev.filter(e => e.t === 'msg' && e.msg.code === 'MEMBER_JOIN').length === 0, '');
    const B = await cl('rj1', 'Hello', 'keyother0002');   // 같은 이름의 다른 사람은 숫자가 붙는다
    check('a different person with the same name still gets a suffix', B.ev.find(e => e.t === 'state').you === 'Hello2', B.ev.find(e => e.t === 'state').you);
    B.ws.close(); A2.ws.close(); await sleep(500);
    // 모두 나갔다가 다시 들어와도 방(AI·대화)이 그대로
    const A3 = await cl('rj1', 'Hello', 'keyhello001');
    const st3 = A3.ev.find(e => e.t === 'state');
    check('empty room is kept: AIs and messages survive leaving and coming back', st3 && st3.ais.some(a => a.name === '가') && st3.messages.length > 0, JSON.stringify(st3 && st3.ais));
    A3.ws.close();
    // 서버에 없는 방: 기기 기록으로 되살림
    const restore = { v: 1, policy: 'free', ais: [{ name: '가', persona: '친구', provider: 'free', apiKey: 'sk-should-be-ignored' }, { name: 'bad name', persona: '' }, { name: '나', persona: 'x', provider: 'openai' }],
      doc: '공유 메모', deliv: { lang: 'markdown', text: '# 결과', by: '가' },
      messages: [{ kind: 'human', who: 'Hello', text: '안녕', ts: 1 }, { kind: 'ai', who: '가', text: '반가워', ts: 2 }, { kind: 'system', who: 'x', text: 'nope' }] };
    const R = await cl('rst1', 'Hello', 'keyhello001', { restore });
    const sr = R.ev.find(e => e.t === 'state');
    check('unknown room is restored from the device record', sr && sr.ais.map(a => a.name).join(',') === '가,나' && sr.messages.some(m => m.text === '반가워') && sr.doc === '공유 메모' && sr.deliv && sr.deliv.text === '# 결과', JSON.stringify(sr && { ais: sr.ais.map(a => a.name), n: sr.messages.length }));
    check('restore validates input: bad names and system lines dropped, keys and paid providers not trusted', !sr.ais.some(a => a.ownKey) && sr.ais.find(a => a.name === '나').provider === 'default' && !sr.messages.some(m => m.text === 'nope'), JSON.stringify(sr.ais));
    check('restored room says so', R.ev.some(e => e.t === 'msg' && e.msg.code === 'ROOM_RESTORED'), '');
    R.ws.close(); await sleep(300);
    const R2 = await cl('rst1', 'Hello', 'keyhello001', { restore: { v: 1, ais: [{ name: '다른', persona: '' }], messages: [] } });
    check('restore is ignored when the room still exists', R2.ev.find(e => e.t === 'state').ais.map(a => a.name).join(',') === '가,나', '');
    R2.ws.close();
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
