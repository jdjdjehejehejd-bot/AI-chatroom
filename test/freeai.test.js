/* 자유 AI: 역할을 비우면 자유 AI. 빈 방은 그대로 비어 있다. 빈 역할 프롬프트·에셋 왕복·긴 코드 블록만 산출물 */
const { spawn } = require('child_process'), http = require('http'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const cl = (port, room, name, extra) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify(Object.assign({ t: 'join', room, name, consent: true }, extra || {}))); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
const lm = A => A.ev.filter(e => e.t === 'meta').pop();
(async () => {
  let seen = '', reply = '안녕하세요';
  const mock = http.createServer((q, a) => { let b = ''; q.on('data', d => b += d); q.on('end', () => { try { seen += JSON.parse(b).messages[0].content + '\n=====\n'; } catch (e) {} a.setHeader('content-type', 'application/json'); a.end(JSON.stringify({ choices: [{ message: { content: reply } }], usage: { prompt_tokens: 3, completion_tokens: 3 } })); }); });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'free-')); const port = 3381;
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: 'k', AI_MODEL: 'm', OPENAI_BASE_URL: 'http://127.0.0.1:' + mock.address().port + '/v1' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const A = await cl(port, 'fr1', 'Ann');
    check('empty room stays empty (no auto-seeded AIs)', lm(A).ais.length === 0 && lm(A).policy !== undefined, JSON.stringify(lm(A).ais));
    // 역할 없는 AI도 직접 초대 가능
    A.s({ t: 'plan', id: 'plus' }); await sleep(200);
    A.s({ t: 'addAI', name: 'Zed', persona: '', provider: 'openai', model: 'm' }); await sleep(300);
    check('addAI accepts an empty role', lm(A).ais.some(a => a.name === 'Zed' && a.persona === ''), JSON.stringify(lm(A).ais.map(a => [a.name, a.persona])));
    // 프롬프트: 빈 역할이면 자유 AI 안내, 역할이 있으면 기존 문구
    A.s({ t: 'config', policy: 'mention' }); await sleep(150);
    A.s({ t: 'msg', text: '@Zed 안녕' }); await sleep(1500);
    check('prompt for a role-less AI says free AI', /정해진 역할이나 성격이 없다\(자유 AI\)/.test(seen) && !/역할\/성격: \s*\n/.test(seen), seen.slice(0, 300));
    A.s({ t: 'addAI', name: 'Rex', persona: '꼼꼼한 검토자', provider: 'openai', model: 'm' }); await sleep(300);
    seen = ''; A.s({ t: 'msg', text: '@Rex 안녕' }); await sleep(1500);
    check('role-bearing AI keeps the old line', /역할\/성격: 꼼꼼한 검토자/.test(seen), seen.slice(0, 300));
    // 에셋 왕복: 빈 역할이 내보내기·불러오기에서 유지
    const D = await cl(port, 'fr4', 'Dan');
    D.s({ t: 'asset', asset: { format: 'aichat-asset/1', name: '자유팀', policy: 'free', maxStreak: 3, rules: '', ais: [{ name: '가', persona: '' }, { name: '나', persona: '' }], doc: '' } }); await sleep(300);
    check('asset with empty roles is accepted (free AIs)', lm(D).ais.length === 2 && lm(D).ais.every(a => a.persona === ''), JSON.stringify(lm(D).ais) + JSON.stringify(D.ev.filter(e => e.t === 'err')));
    D.ws.close();
    // 산출물: 짧은 예시 코드는 무시, 긴 코드 블록은 산출물로
    reply = '예시예요\n```js\nconsole.log(1)\n```';
    A.s({ t: 'msg', text: '@Zed 예시 보여줘' }); await sleep(1500);
    const noDeliv = A.ev.filter(e => e.t === 'deliv').length;
    check('short snippet in a free room is not a deliverable', noDeliv === 0, noDeliv);
    reply = '만들었어요\n```html\n<!doctype html><html><body>' + '<p>안녕하세요 내용입니다</p>'.repeat(20) + '</body></html>\n```';
    A.s({ t: 'msg', text: '@Zed 웹페이지 만들어줘' }); await sleep(1500);
    const dv = A.ev.filter(e => e.t === 'deliv').pop();
    check('long block in a free room becomes a deliverable', dv && dv.deliv.by === 'Zed' && dv.deliv.lang === 'html' && dv.deliv.text.length >= 300, JSON.stringify(dv && { by: dv.deliv.by, len: dv.deliv.text.length }));
    check('prompt asks for finished code blocks on task requests', /결과물은 완성된 코드블록 하나로 낸다/.test(seen), 'missing');
    A.ws.close();
  } finally { sv.kill(); mock.close(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
