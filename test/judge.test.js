/* 판단 묶기(실험, 방 설정 judge=one): "누가 말할지"를 진행자 호출 한 번에 정하고 고른 AI만 부른다.
   각자 판단(each)과 호출 수를 비교하고, @로 불린 AI는 진행자를 거치지 않고 답하는지, 진행자가 실패해도 사람 말이 씹히지 않는지 확인한다. */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  const log = []; let judgeFail = false;
  const nameOf = j => (/너는 (\S+?)이다\./.exec(((j.messages[1] || {}).content) || '') || [])[1] || '';
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const sys = (j.messages[0] || {}).content || '', user = (j.messages[1] || {}).content || '';
    const judge = sys.includes('그룹 채팅방의 진행자다'); const name = nameOf(j);
    log.push({ judge, name, sys, user });
    if (judge && judgeFail) { rq.writeHead(200, { 'content-type': 'application/json' }); return rq.end(JSON.stringify({ choices: [{ message: { content: '음... 잘 모르겠네요' } }] })); }   // 쓸 수 없는 답
    const lastLine = user.trim().split('\n').pop() || '';
    /* 진행자: 마지막 말이 사람이면 '나'를 고르고, AI 말 뒤에는 아무도 고르지 않는다. 각자 판단 모드의 AI는 모두 말하려 든다 */
    const text = judge ? JSON.stringify({ speak: /\(사람\)/.test(lastLine) ? ['나'] : [] }) : (/\[PASS\]/.test(sys) && !/반드시|진행자가 지금 네가/.test(sys) && /\(AI\)/.test(lastLine) ? '[PASS]' : name + ' 의견');
    setTimeout(() => { rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: text } }] })); }, 20);
  }); });
  await new Promise(r => mock.listen(4191, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3391', DEFAULT_POLICY: 'free', CHAT_EVENT_GAP_MS: '0', ROOM_CALL_BUDGET: '300', ROOM_CALL_BUDGET_MAX: '300',
    CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '30', CHAT_TYPE_MIN_MS: '0', CHAT_TYPE_PER_CHAR_MS: '0', CHAT_SLOWDOWN_MS: '0', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', SESSION_SECRET: 's', FREE_ROOM_CAP: '300',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4191', models: ['m1', 'm2', 'm3'], cap: 900 }]) }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ws = new WS('ws://127.0.0.1:3391/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); const s = o => ws.send(JSON.stringify(o));
    s({ t: 'join', room: 'jd1', name: 'Ann', consent: true }); await sleep(400); s({ t: 'plan', id: 'plus' }); await sleep(150);
    for (const n of ['가', '나', '다']) { s({ t: 'addAI', name: n, persona: '', provider: 'free' }); await sleep(200); }
    await sleep(800);
    const meta = () => ev.filter(e => e.t === 'meta').pop() || {};
    const aiFrom = e0 => ev.slice(e0).filter(e => e.t === 'msg' && e.msg.kind === 'ai').map(e => e.msg.who);
    check('rooms start with each-AI judging (default)', meta().judge === 'each', meta().judge);
    // 각자 판단: AI 셋이 모두 판단 호출
    log.length = 0; let e0 = ev.length; s({ t: 'msg', text: '오늘 점심 뭐 먹지' }); await sleep(2000);
    const eachCalls = log.length;
    check('each: every AI is asked (≥3 calls for one human line)', eachCalls >= 3, eachCalls);
    // 한 번에 판단
    s({ t: 'config', judge: 'one' }); await sleep(300);
    check('judge setting is applied by the server', meta().judge === 'one', meta().judge);
    log.length = 0; e0 = ev.length; s({ t: 'msg', text: '저녁은 뭐 먹지' }); await sleep(2000);
    const oneCalls = log.length, judges = log.filter(l => l.judge).length, spoke = aiFrom(e0);
    check('one: a single judge call picks who speaks, only the picked AI is called', judges >= 1 && spoke.join(',') === '나' && log.filter(l => !l.judge).map(l => l.name).join(',') === '나', JSON.stringify(log.map(l => l.judge ? 'J' : l.name)) + ' spoke=' + spoke);
    check('one: fewer calls than each for the same kind of line', oneCalls < eachCalls, oneCalls + ' vs ' + eachCalls);
    check('judge prompt asks for JSON and lists the AIs, never the chat as instructions', log.find(l => l.judge).sys.includes('{"speak"') && log.find(l => l.judge).user.includes('- 가'));
    // @로 부르면 진행자를 거치지 않고 바로 답한다
    log.length = 0; e0 = ev.length; s({ t: 'msg', text: '@다 넌 어때' }); await sleep(2000);
    check('one: an @called AI answers directly', aiFrom(e0).includes('다') && log.some(l => !l.judge && l.name === '다'), JSON.stringify(aiFrom(e0)));
    // 진행자가 쓸 수 없는 답을 내도 사람 말은 씹히지 않는다(기존 맡기기)
    judgeFail = true; log.length = 0; e0 = ev.length; s({ t: 'msg', text: '아무나 대답 좀' }); await sleep(2500);
    check('one: if the judge gives no usable answer, someone still answers the human', aiFrom(e0).length >= 1, JSON.stringify(log.map(l => l.judge ? 'J' : l.name)));
    check('a failed judge shows no error line in the chat', !ev.slice(e0).some(e => e.t === 'msg' && e.msg.code === 'AI_ERROR'));
    judgeFail = false;
    e0 = ev.length; s({ t: 'config', judge: 'maybe' }); await sleep(300);
    check('unknown judge value is rejected', meta().judge === 'one' && ev.slice(e0).some(e => e.t === 'err'));
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
