/* Run(요청 하나가 일으킨 AI 작업 한 묶음): 시작·끝 상태, 호출 수, 멈추기(서버가 실제로 멈추는지), 기록 보관, 재시작 뒤 유지,
   무료 풀 하루 사용량이 재시작 뒤에도 이어지는지 확인한다. */
const { spawn } = require('child_process'), path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  let delay = 20, calls = 0;
  const nameOf = j => (/너는 (\S+?)이다\./.exec(((j.messages[1] || {}).content) || '') || [])[1] || '';
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const name = nameOf(j); calls++;
    setTimeout(() => { rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: name + ' 의견' } }], usage: { prompt_tokens: 7, completion_tokens: 3 } })); }, delay);
  }); });
  await new Promise(r => mock.listen(4181, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-runs-'));
  const env = Object.assign({}, process.env, { PORT: '3381', DATA_DIR: dir, DEFAULT_POLICY: 'free', DEFAULT_ACTIVITY: 'quiet', CHAT_EVENT_GAP_MS: '0', ROOM_CALL_BUDGET: '200', ROOM_CALL_BUDGET_MAX: '200',
    CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '30', CHAT_TYPE_MIN_MS: '0', CHAT_TYPE_PER_CHAR_MS: '0', CHAT_SLOWDOWN_MS: '0', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', SESSION_SECRET: 's', FREE_ROOM_CAP: '300',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4181', models: ['m1', 'm2'], cap: 900 }]) });
  let sv = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  try {
    await sleep(900);
    let ws = new WS('ws://127.0.0.1:3381/ws'); let ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); let s = o => ws.send(JSON.stringify(o));
    s({ t: 'join', room: 'runs1', name: 'Ann', consent: true }); await sleep(400); s({ t: 'plan', id: 'plus' }); await sleep(150);
    for (const n of ['가', '나']) { s({ t: 'addAI', name: n, persona: '', provider: 'free' }); await sleep(200); }
    const runEv = from => ev.slice(from).filter(e => e.t === 'run').map(e => e.run);
    let e0 = ev.length; s({ t: 'msg', text: '안녕 다들' }); await sleep(1500);
    let rs = runEv(e0), done = rs.filter(r => r.status !== 'running').pop();
    check('a human line starts a run (running → done)', rs[0] && rs[0].status === 'running' && rs[0].kind === 'chat' && done && done.status === 'done' && done.id === rs[0].id, JSON.stringify(rs.map(r => r.status)));
    check('the run records its calls, tokens and duration', done && done.calls >= 2 && done.tokIn >= 14 && done.tokOut >= 6 && done.ms >= 0, JSON.stringify(done));
    check('no user identity or text in the run record', done && !JSON.stringify(done).includes('Ann') && !JSON.stringify(done).includes('안녕'), JSON.stringify(done));
    // 멈추기: 느린 모델로 작업 중에 멈추면, 이후 AI 말이 올라오지 않는다
    delay = 1500; e0 = ev.length; s({ t: 'msg', text: '@가 @나 길게 얘기해 줘' }); await sleep(300);
    s({ t: 'cancelRun' }); await sleep(2500);
    rs = runEv(e0); const last = rs.pop();
    check('cancel stops the run on the server (status cancelled)', last && last.status === 'cancelled', JSON.stringify(last));
    check('nothing from the AIs is posted after stopping', !ev.slice(e0).some(e => e.t === 'msg' && e.msg.kind === 'ai'), ev.slice(e0).filter(e => e.t === 'msg').map(e => e.msg.who + ':' + e.msg.text).join(' | '));
    check('stopping is announced', ev.slice(e0).some(e => e.t === 'msg' && e.msg.code === 'RUN_CANCELLED'));
    e0 = ev.length; s({ t: 'cancelRun' }); await sleep(300);
    check('stopping when nothing runs is refused by the server', ev.slice(e0).some(e => e.t === 'err'));
    delay = 20; e0 = ev.length; s({ t: 'msg', text: '다시 얘기하자' }); await sleep(1500);
    check('after stopping, the next human line runs normally', runEv(e0).some(r => r.status === 'done') && ev.slice(e0).some(e => e.t === 'msg' && e.msg.kind === 'ai'));
    ws.close(); await sleep(3500);   // 저장 주기(3초)를 기다린 뒤 재시작
    sv.kill('SIGTERM'); await new Promise(r => sv.on('exit', r));
    const usedBefore = JSON.parse(fs.readFileSync(path.join(dir, 'free.json'), 'utf8')).used.mk || 0;
    check('free-pool daily usage is saved', usedBefore >= 4, usedBefore);
    sv = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: 'ignore' }); await sleep(1000);
    ws = new WS('ws://127.0.0.1:3381/ws'); ev = []; ws.on('message', d => ev.push(JSON.parse(d))); await new Promise(r => ws.on('open', r)); s = o => ws.send(JSON.stringify(o));
    s({ t: 'join', room: 'runs1', name: 'Ann', consent: true }); await sleep(600);
    const st = ev.find(e => e.t === 'state');
    check('run history survives a restart', st && st.runs && st.runs.length >= 3 && st.runs.some(r => r.status === 'cancelled'), st && JSON.stringify((st.runs || []).map(r => r.status)));
    // 저장소가 있으면 기기 기록(restore)으로 방을 되살리지 않는다(조작될 수 있으므로 서버 기록만 믿는다)
    const w3 = new WS('ws://127.0.0.1:3381/ws'); const e3 = []; w3.on('message', d => e3.push(JSON.parse(d))); await new Promise(r => w3.on('open', r));
    w3.send(JSON.stringify({ t: 'join', room: 'fake1', name: 'Bob', consent: true, restore: { v: 1, policy: 'free', ais: [{ name: '가짜', persona: '' }], messages: [{ kind: 'human', who: 'Bob', text: '조작된 기록' }], doc: '조작' } })); await sleep(600);
    const s3 = e3.find(e => e.t === 'state');
    check('with a server store, device records are not used to rebuild rooms', s3 && !s3.ais.length && !s3.messages.some(m => m.text === '조작된 기록') && s3.doc !== '조작', s3 && JSON.stringify({ ais: s3.ais.map(a => a.name), doc: s3.doc }));
    w3.close();
    const hz = await new Promise(r => http.get('http://127.0.0.1:3381/healthz', x => { let b = ''; x.on('data', c => b += c); x.on('end', () => r(JSON.parse(b))); }));
    const mk = hz.free.backends.find(b => b.id === 'mk');
    check('after restart the free-pool daily count continues (not reset)', mk && mk.left <= 900 - usedBefore,   /* 재입장 알림에 AI가 반응하면 더 쓸 수 있다 */ JSON.stringify(mk) + ' usedBefore=' + usedBefore);
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
