/* 무료 풀이 붐빌 때(실측 QA에서 발견): 한 모델만 429면 그 모델만 쉬고 같은 계정의 다른 모델로 답한다(계정 전체를 멈추지 않음),
   잠깐 실패한 판단은 대화방에 오류를 띄우지 않고 조용히 다시 본다 */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  let fail503 = 0; const log = [];
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); log.push(j.model);
    if (j.model === 'busy-model') { rq.writeHead(429, { 'content-type': 'application/json' }); return rq.end('{"error":{"message":"rate limited"}}'); }
    if (fail503 > 0) { fail503--; rq.writeHead(503, { 'content-type': 'application/json' }); return rq.end('{"error":{"message":"overloaded"}}'); }
    const sys = (j.messages[0] || {}).content || '', name = (/AI 참가자 "([^"]+)"/.exec(sys) || [])[1];
    rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: name + ' 안녕(' + j.model + ')' } }] }));
  }); });
  await new Promise(r => mock.listen(4141, '127.0.0.1', r));
  const port = 3354;
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), REQUIRE_LOGIN: '0', SESSION_SECRET: 's', DEFAULT_POLICY: 'free', CHAT_EVENT_GAP_MS: '600000',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4141', models: ['busy-model', 'ok-model', 'ok-2'], cap: 900 }]), FREE_ROOM_CAP: '300' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ev = []; const ws = new WS('ws://127.0.0.1:' + port + '/ws'); ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); const s = o => ws.send(JSON.stringify(o));
    s({ t: 'join', room: 'busy1', name: 'Ann', consent: true }); await sleep(400);
    s({ t: 'addAI', name: '가', persona: '', provider: 'free' }); await sleep(300);
    s({ t: 'addAI', name: '나', persona: '', provider: 'free' }); await sleep(800);
    const n0 = ev.length; log.length = 0;
    s({ t: 'msg', text: '안녕 얘들아' }); await sleep(3000);
    const said = ev.slice(n0).filter(e => e.t === 'msg' && e.msg.kind === 'ai').map(e => e.msg.who + ':' + e.msg.text);
    check('one model returning 429 does not stop the account: both AIs answer via the other model', said.some(x => x.startsWith('가:')) && said.some(x => x.startsWith('나:')) && said.every(x => /ok-/.test(x)), JSON.stringify({ said, log }));
    check('no error line shown for the busy model', !ev.slice(n0).some(e => e.t === 'msg' && e.msg.code === 'AI_ERROR'), '');
    const hz = await (await fetch('http://127.0.0.1:' + port + '/healthz')).json();
    check('backend is not cooled as a whole', hz.free.backends.find(b => b.id === 'mk').cooling === false, JSON.stringify(hz.free));
    // 일시 오류(503): 조용히 다시 보고 결국 답한다
    await sleep(500); fail503 = 2; const n1 = ev.length;
    s({ t: 'msg', text: '@가 지금 뭐해?' }); await sleep(30000);
    const said2 = ev.slice(n1).filter(e => e.t === 'msg' && e.msg.kind === 'ai' && e.msg.who === '가');
    check('a transient provider error is retried quietly and the AI still answers', said2.length >= 1 && !ev.slice(n1).some(e => e.t === 'msg' && e.msg.code === 'AI_ERROR'), JSON.stringify(ev.slice(n1).filter(e => e.t === 'msg').map(e => e.msg.who + ':' + e.msg.text)));
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
