/* 자유 채팅 경쟁 상태 스트레스 테스트: 응답 시간을 무작위로 바꿔 가며 여러 번 돌리고, 모든 AI 말에 대해 불변식을 검사한다.
   (타이밍 하나만 맞춘 테스트가 로컬에선 통과하고 CI에서 실패하던 문제를 잡기 위함. 기준을 완화하지 않는다)
   불변식: ① 어떤 AI도 다른 참가자의 새 말 없이 자기 말 뒤에 또 말하지 않는다
          ② 올라간 AI 말은 올라가는 시점의 최신 남의 말을 보고 만든 것이다(낡은 맥락으로 답하지 않음)
          ③ 메시지 번호는 엄격히 증가하고 중복이 없다  ④ 매 라운드 끝에 방이 조용해진다(입력 중 표시 해제, 무한 반복 없음) */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
let seed = Number(process.env.CHATRACE_SEED || 12345); const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
(async () => {
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const u = (j.messages[1] || {}).content || '';
    const me = (/너는 (\S+?)이다\./.exec(u) || [])[1] || '?';
    // 맥락의 마지막 '남의 말'(내 말 표시 (나)가 아닌 줄)을 답에 적어 둔다
    const lines = u.split('\n').filter(l => /^\S+ \((사람|AI|나)\): /.test(l));
    const lastOther = [...lines].reverse().find(l => !/ \(나\): /.test(l)) || '';
    const text = me + '>>' + lastOther.replace(/^\S+ \((사람|AI)\): /, '').slice(0, 60);
    setTimeout(() => { rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: text } }] })); }, Math.floor(rnd() * 400));
  }); });
  await new Promise(r => mock.listen(4131, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3341', DEFAULT_POLICY: 'free', CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '150', CHAT_TYPE_MIN_MS: '0', CHAT_TYPE_PER_CHAR_MS: '2', CHAT_SLOWDOWN_MS: '0', CHAT_SAFETY_MAX: '6', DEV_UNLIMITED: '1',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4131', models: ['m'], cap: 100000 }]), REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ws = new WS('ws://127.0.0.1:3341/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', room: 'race1', name: 'Ann', consent: true })); await sleep(400);
    for (const n of ['가', '나', '다']) { ws.send(JSON.stringify({ t: 'addAI', name: n, persona: '', provider: 'free' })); await sleep(200); }
    let quietFail = 0;
    for (let round = 0; round < 8; round++) {
      const n0 = ev.length;
      ws.send(JSON.stringify({ t: 'msg', text: '라운드' + round + ' 시작' }));
      let quiet = false;
      for (let w = 0; w < 60 && !quiet; w++) { await sleep(150); quiet = ev.slice(n0).some(e => e.t === 'typing' && e.who === null); }
      if (!quiet) quietFail++;
      await sleep(300);
    }
    const msgs = ev.filter(e => e.t === 'msg' && e.msg.kind !== 'system').map(e => e.msg);
    const ai = msgs.filter(m => m.kind === 'ai');
    let doubles = [], stale = [];
    msgs.forEach((m, i) => {
      if (m.kind !== 'ai') return;
      const prev = msgs[i - 1];
      if (prev && prev.kind === 'ai' && prev.who === m.who) doubles.push(m.who + '#' + m.id);
      const lastOther = [...msgs.slice(0, i)].reverse().find(x => x.who !== m.who);
      const saw = m.text.slice(m.text.indexOf('>>') + 2);
      if (lastOther && saw !== lastOther.text.slice(0, 60)) stale.push(m.who + ' saw "' + saw + '" but latest was "' + lastOther.text.slice(0, 30) + '"');
    });
    const ids = msgs.map(m => m.id);
    check('enough traffic to be meaningful', ai.length >= 16, ai.length);
    check('no AI posts right after its own line (no double-texting from stale wake-ups)', doubles.length === 0, doubles.slice(0, 5).join(', '));
    check('every AI line was written against the latest line from someone else (no stale replies)', stale.length === 0, stale.slice(0, 3).join(' | '));
    check('message ids strictly increasing, no duplicates', ids.every((x, i) => i === 0 || x > ids[i - 1]), '');
    check('every round ends quiet (typing cleared, no endless loop)', quietFail === 0, quietFail);
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
