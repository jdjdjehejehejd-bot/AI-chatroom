/* 사용자 본인 키 확인(keytest): 서버가 정한 제공사 주소로 아주 짧은 요청 한 번만 보내고, 결과를 분류해 돌려준다. 키는 응답·집계에 남지 않는다 */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  const log = [];
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); log.push({ url: req.url, auth: req.headers.authorization, model: j.model, max: j.max_tokens });
    const code = req.headers.authorization === 'Bearer good' ? (j.model === 'nope' ? 404 : 200) : 401;
    rq.writeHead(code, { 'content-type': 'application/json' }); rq.end(JSON.stringify(code === 200 ? { choices: [{ message: { content: 'OK' } }] } : { error: { message: 'x' } }));
  }); });
  await new Promise(r => mock.listen(4111, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3311', GROQ_BASE_URL: 'http://127.0.0.1:4111', ADMIN_TOKEN: 'adm', REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ws = new WS('ws://127.0.0.1:3311/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'join', room: 'kt1', name: 'Ann', consent: true })); await sleep(400);
    const kt = async o => { const n = ev.length; ws.send(JSON.stringify(Object.assign({ t: 'keytest' }, o))); for (let i = 0; i < 30; i++) { await sleep(100); const e = ev.slice(n).find(x => x.t === 'keytest'); if (e) return e; } return null; };
    let r = await kt({ provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'good' });
    check('valid key + model -> ok', r && r.ok === true, JSON.stringify(r));
    check('request goes to configured provider base with tiny max_tokens', log.length === 1 && log[0].url === '/chat/completions' && log[0].auth === 'Bearer good' && log[0].max <= 16, JSON.stringify(log));
    r = await kt({ provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'bad' });
    check('second test within 5s is throttled (no request)', r && r.ok === false && log.length === 1, JSON.stringify(r));
    await sleep(5100);
    r = await kt({ provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'bad' });
    check('wrong key -> 401 message', r && !r.ok && r.code === 401 && /키가 맞지/.test(r.text), JSON.stringify(r));
    await sleep(5100);
    r = await kt({ provider: 'groq', model: 'nope', apiKey: 'good' });
    check('unknown model -> 404 message', r && !r.ok && r.code === 404 && /모델/.test(r.text), JSON.stringify(r));
    r = await kt({ provider: 'demo', model: 'x', apiKey: 'good' });
    check('unsupported provider rejected without request', r && !r.ok && log.length === 3, JSON.stringify(r));
    r = await kt({ provider: 'groq', model: 'a b', apiKey: 'good' });
    check('bad model string rejected', r && !r.ok && log.length === 3, JSON.stringify(r));
    const e = await (await fetch('http://127.0.0.1:3311/admin/events', { headers: { authorization: 'Bearer adm' } })).json();
    check('key never appears in events or replies', !/good|bad/.test(JSON.stringify(e)) && !ev.some(x => x.t === 'keytest' && /good|bad/.test(JSON.stringify(x))), '');
    ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(res.every(Boolean) ? 0 : 1);
})();
