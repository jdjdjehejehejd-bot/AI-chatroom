/* 실제 채팅방 같은 자율 발언(기본 free): 아무도 부르지 않으면 AI가 끼어들지 스스로 정하고([PASS] 가능),
   모두 넘기면 한 명은 반드시 답하며, 부른 AI는 넘길 수 없고, 연속 발언 한도에서 멈춘다 */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  // 가짜 제공사: 프롬프트에 "[PASS]" 안내가 있으면(=부르지 않은 AI) mode에 따라 넘기거나 말한다
  let mode = 'allpass'; const log = [];
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const sys = (j.messages[0] || {}).content || ''; const optional = /\[PASS\]/.test(sys);
    log.push({ optional });
    const text = optional && (mode === 'allpass' || (mode === 'first-speaks' && log.filter(l => l.optional).length > 1)) ? '[PASS]' : '네, 제 생각은 이렇습니다.';
    rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
  }); });
  await new Promise(r => mock.listen(4121, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3321', DEFAULT_POLICY: 'free', FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4121', models: ['m'], cap: 500 }]), FREE_ROOM_CAP: '100', REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ws = new WS('ws://127.0.0.1:3321/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', room: 'auto1', name: 'Ann', consent: true })); await sleep(400);
    const st = ev.find(e => e.t === 'state' || e.t === 'meta'); const pol = (ev.filter(e => e.t === 'meta').pop() || {}).policy;
    check('new rooms default to free (autonomous) policy', pol === 'free', pol);
    for (const n of ['가', '나', '다']) { ws.send(JSON.stringify({ t: 'addAI', name: n, persona: '', provider: 'free' })); await sleep(250); }
    const ais = () => ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').length;
    let a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: '다들 뭐해?' })); await sleep(1500);
    check('everyone passes -> exactly one AI is nudged to answer', ais() - a0 === 1 && log.length === 4 && log.slice(0, 3).every(l => l.optional) && !log[3].optional, JSON.stringify({ replies: ais() - a0, log }));
    a0 = ais(); log.length = 0; mode = 'first-speaks';
    ws.send(JSON.stringify({ t: 'msg', text: '오늘 날씨 어때?' })); await sleep(1500);
    check('one AI chooses to speak, others pass -> one reply, no forced extra', ais() - a0 === 1 && log.every(l => l.optional), JSON.stringify({ replies: ais() - a0, log }));
    a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: '@나 너한테 묻는 거야' })); await sleep(1500);
    check('mentioned AI cannot pass', ais() - a0 >= 1 && log[0] && log[0].optional === false, JSON.stringify(log));
    a0 = ais(); log.length = 0; mode = 'chatty';
    ws.send(JSON.stringify({ t: 'msg', text: '자유롭게 떠들어 봐' })); await sleep(2500);
    check('chatty AIs stop at the streak limit (4)', ais() - a0 === 4 && ev.some(e => e.t === 'msg' && e.msg.code === 'STREAK_LIMIT'), ais() - a0);
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
