/* AI 활동량(조용·보통·수다): 서버가 강제하는지 모의 모델로 확인한다.
   모의 모델은 언제나 말하는(넘기지 않는) 수다쟁이라, 서버 제한이 없으면 안전선까지 계속 떠든다. */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  const calls = []; const prompts = [];
  const nameOf = j => (/너는 (\S+?)이다\./.exec(((j.messages[1] || {}).content) || '') || [])[1] || '';
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const name = nameOf(j); calls.push(name); prompts.push((j.messages[0] || {}).content || '');
    setTimeout(() => { rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: name + ' 의견 ' + calls.length } }] })); }, 20);
  }); });
  await new Promise(r => mock.listen(4171, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3371', DEFAULT_POLICY: 'free', CHAT_EVENT_GAP_MS: '0', ROOM_CALL_BUDGET: '300', ROOM_CALL_BUDGET_MAX: '300',
    CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '30', CHAT_TYPE_MIN_MS: '0', CHAT_TYPE_PER_CHAR_MS: '0', CHAT_SLOWDOWN_MS: '0', CHAT_SAFETY_MAX: '20', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', SESSION_SECRET: 's', FREE_ROOM_CAP: '300',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4171', models: ['m1', 'm2', 'm3'], cap: 900 }]) }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ws = new WS('ws://127.0.0.1:3371/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); const s = o => ws.send(JSON.stringify(o));
    s({ t: 'join', room: 'act1', name: 'Ann', consent: true }); await sleep(400); s({ t: 'plan', id: 'plus' }); await sleep(150);
    for (const n of ['가', '나', '다']) { s({ t: 'addAI', name: n, persona: '', provider: 'free' }); await sleep(200); }
    const meta = () => ev.filter(e => e.t === 'meta').pop() || {};
    const aiMsgs = from => ev.slice(from).filter(e => e.t === 'msg' && e.msg.kind === 'ai').length;
    check('new rooms start at "normal" activity', meta().activity === 'normal', meta().activity);
    // 보통: 사람 말 하나에 AI 말 10번에서 멈춘다(안전선 20보다 먼저)
    let e0 = ev.length; s({ t: 'msg', text: '얘기해 봐' }); await sleep(3500);
    check('normal: AIs stop at 10 lines per human line', aiMsgs(e0) === 10, aiMsgs(e0));
    // 조용: AI끼리 이어 떠들지 않는다(사람 말에 대한 반응만, 판단 호출도 그만큼만)
    s({ t: 'config', activity: 'quiet' }); await sleep(300);
    check('activity change is announced and reflected in room info', meta().activity === 'quiet' && ev.some(e => e.t === 'msg' && e.msg.code === 'ACTIVITY'), meta().activity);
    calls.length = 0; prompts.length = 0; e0 = ev.length; s({ t: 'msg', text: '다들 오늘 어땠어' }); await sleep(2500);
    check('quiet: only reactions to the human line, no AI-to-AI follow-ups', aiMsgs(e0) <= 3 && aiMsgs(e0) >= 1, aiMsgs(e0));
    check('quiet: no extra judge calls after AI lines (calls ≤ AIs)', calls.length <= 3, calls.length);
    check('quiet: no "talked a lot, taking a break" notice after a few lines', !ev.slice(e0).some(e => e.t === 'msg' && e.msg.code === 'STREAK_LIMIT'));
    // 조용이어도 @로 부르면 답한다(AI가 다른 AI를 불러도)
    e0 = ev.length; s({ t: 'msg', text: '@가 한마디' }); await sleep(2000);
    check('quiet: a called AI still answers', ev.slice(e0).some(e => e.t === 'msg' && e.msg.kind === 'ai' && e.msg.who === '가'));
    // 수다: 10번을 넘어 안전선(20)까지
    s({ t: 'config', activity: 'chatty' }); await sleep(300);
    e0 = ev.length; s({ t: 'msg', text: '마음껏 떠들어' }); await sleep(5000);
    check('chatty: goes past 10, up to the safety line (20)', aiMsgs(e0) > 10 && aiMsgs(e0) <= 20, aiMsgs(e0));
    check('chatty: the prompt tells AIs to join in freely', prompts.some(p => p.includes('"수다" 설정')));
    // 잘못된 값은 거절(화면이 아니라 서버가 막는다)
    e0 = ev.length; s({ t: 'config', activity: 'party' }); await sleep(300);
    check('unknown activity value is rejected by the server', meta().activity === 'chatty' && ev.slice(e0).some(e => e.t === 'err'), meta().activity);
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
