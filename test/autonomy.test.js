/* 진짜 단체방 같은 자유 채팅(기본 free): 턴·순서·답할 의무가 없다.
   새 메시지마다 AI들이 각자(동시에) 볼지·말할지 정하고, 먼저 끝난 말이 먼저 올라오며, 모두 넘기면 아무도 말하지 않는다.
   @로 불러도 넘길 수 있다(프롬프트로 알려만 줌). 사람 말 뒤 AI 말은 연속 발언 한도까지 */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  let mode = 'allpass'; const log = [];
  const nameOf = j => (/이제 (\S+?)이\(가\) 말할 차례다/.exec(((j.messages[1] || {}).content) || '') || [])[1] || '';
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const sys = (j.messages[0] || {}).content || ''; const name = nameOf(j);
    log.push({ name, called: sys.includes('너를 @로 불렀다'), optional: /\[PASS\]/.test(sys), wind: /AI들끼리 \d+번 말했다/.test(sys) });
    let text = '[PASS]', delay = 30;
    if (mode === 'chatty') text = name + ' 의견';
    if (mode === 'one' && name === '나' && log.filter(l => l.name === '나').length === 1) text = '나는 이렇게 생각해';
    if (mode === 'race') { text = name + ' 의견'; delay = name === '가' ? 300 : name === '다' ? 100 : 200; }
    setTimeout(() => { rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: text } }] })); }, delay);
  }); });
  await new Promise(r => mock.listen(4121, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3321', DEFAULT_POLICY: 'free', CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '60', CHAT_SAFETY_MAX: '7', CHAT_SLOWDOWN_MS: '20', CHAT_TYPE_MIN_MS: '500', CHAT_TYPE_PER_CHAR_MS: '0', FREE_ROOM_CAP: '300', FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4121', models: ['m'], cap: 900 }]), FREE_ROOM_CAP: '300', REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ws = new WS('ws://127.0.0.1:3321/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', room: 'auto1', name: 'Ann', consent: true })); await sleep(400);
    ws.send(JSON.stringify({ t: 'plan', id: 'plus' }));
    const pol = (ev.filter(e => e.t === 'meta').pop() || {}).policy;
    const budgetUsed = () => (ev.filter(e => e.t === 'budget').pop() || { budget: { used: 0 } }).budget.used;
    check('new rooms default to free (autonomous) policy', pol === 'free', pol);
    for (const n of ['가', '나', '다']) { ws.send(JSON.stringify({ t: 'addAI', name: n, persona: '', provider: 'free' })); await sleep(250); }
    const ais = () => ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').length;
    let a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: '다들 뭐해?' })); await sleep(1500);
    check('AIs that pass never show a typing bubble', !ev.some(e => e.t === 'typing' && e.on), '');
    check('nobody has to answer: everyone looked once and all passed -> silence, no error', ais() - a0 === 0 && log.length === 3 && log.every(l => l.optional) && !ev.some(e => e.t === 'msg' && e.msg.code === 'AI_ERROR'), JSON.stringify({ n: ais() - a0, log }));
    check('passing does not use up the room budget (only real lines count)', budgetUsed() === 0, budgetUsed());
    a0 = ais(); log.length = 0; mode = 'one';
    ws.send(JSON.stringify({ t: 'msg', text: '오늘 날씨 어때?' })); await sleep(1500);
    check('one AI speaks; the others get another look at the new message (no turns)', ais() - a0 === 1 && log.length >= 4, JSON.stringify(log));
    a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: '@나 너한테 묻는 거야' })); await sleep(1500);
    check('@mention is a hint, not an order: mentioned AI is told, and may still pass', ais() - a0 === 0 && log.find(l => l.name === '나').called && !log.find(l => l.name === '가').called, JSON.stringify(log));
    a0 = ais(); log.length = 0; mode = 'chatty';
    ws.send(JSON.stringify({ t: 'msg', text: '자유롭게 떠들어 봐' })); await sleep(4000);
    check('no fixed 4-line cap: AIs keep going while they have something to say, stopped only by the safety line (7 here)', ais() - a0 === 7 && ev.some(e => e.t === 'msg' && e.msg.code === 'STREAK_LIMIT'), ais() - a0);
    check('prompt tells AIs how long they have been chatting so they can wind down', log.some(l => l.wind), '');
    const n0 = ev.length; mode = 'race';
    ws.send(JSON.stringify({ t: 'msg', text: '각자 한마디씩!' })); await sleep(3000);
    const seq = ev.slice(n0).filter(e => (e.t === 'typing' && e.on) || (e.t === 'msg' && e.msg.kind === 'ai')).map(e => e.t === 'typing' ? 'T:' + e.who : 'M:' + e.msg.who);
    const firstMsg = seq.findIndex(x => x.startsWith('M:'));
    check('the three speakers type at the same time before any reply', ['가', '나', '다'].every(n => seq.slice(0, firstMsg).includes('T:' + n)), JSON.stringify(seq));
    check('fastest posts first, no fixed order (다, 나, 가)', seq.filter(x => x.startsWith('M:')).slice(0, 3).join(',') === 'M:다,M:나,M:가', JSON.stringify(seq));
    await sleep(500);
    check('typing indicators cleared when the room goes quiet', ev.slice(n0).some(e => e.t === 'typing' && e.who === null), '');
    ws.close();
    // 방 무료 한도에 닿으면 AI마다 오류를 띄우지 않고 한 번만 알린다
    const sv2 = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3322', DEFAULT_POLICY: 'free', CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '40', CHAT_TYPE_MIN_MS: '0', CHAT_TYPE_PER_CHAR_MS: '0', FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4121', models: ['m'], cap: 900 }]), FREE_ROOM_CAP: '2', REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }), stdio: 'ignore' });
    await sleep(900);
    const w2 = new WS('ws://127.0.0.1:3322/ws'); const e2 = []; w2.on('message', d => e2.push(JSON.parse(d)));
    await new Promise(r => w2.on('open', r)); w2.send(JSON.stringify({ t: 'join', room: 'cap1', name: 'Ann', consent: true })); await sleep(300);
    w2.send(JSON.stringify({ t: 'plan', id: 'plus' }));
    for (const n of ['가', '나', '다']) { w2.send(JSON.stringify({ t: 'addAI', name: n, persona: '', provider: 'free' })); await sleep(200); }
    mode = 'chatty'; w2.send(JSON.stringify({ t: 'msg', text: '떠들어' })); await sleep(2500);
    const capN = e2.filter(e => e.t === 'msg' && e.msg.code === 'FREE_ROOM_CAP').length, errN = e2.filter(e => e.t === 'msg' && e.msg.code === 'AI_ERROR').length;
    check('room free cap: one friendly notice, no per-AI error spam', capN === 1 && errN === 0 && e2.filter(e => e.t === 'msg' && e.msg.kind === 'ai').length <= 3, JSON.stringify({ capN, errN }));
    w2.close(); sv2.kill();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
