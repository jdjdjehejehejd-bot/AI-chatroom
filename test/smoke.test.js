/* scripts/smoke-providers.js 자체 검증: 가짜 OpenAI 호환 서버로 스크립트의 성공/실패 판정이 맞는지 확인한다. (실제 제공사 호출 아님) */
const { spawnSync } = require('child_process'), http = require('http'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const res = []; const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
function mock(handler) { return new Promise(r => { const s = http.createServer((q, a) => { let b = ''; q.on('data', d => b += d); q.on('end', () => handler(q, b, a)); }).listen(0, '127.0.0.1', () => r(s)); }); }
const run = (env, args) => new Promise(r => { const c = require('child_process').spawn('node', ['scripts/smoke-providers.js'].concat(args || []), { cwd: ROOT, env: Object.assign({}, process.env, env) }); let o = ''; c.stdout.on('data', d => o += d); c.stderr.on('data', d => o += d); c.on('exit', code => r({ code, out: o })); });
(async () => {
  const good = await mock((q, b, a) => {
    const auth = q.headers.authorization || '', body = JSON.parse(b || '{}');
    a.setHeader('content-type', 'application/json');
    if (auth !== 'Bearer good') { a.statusCode = 401; return a.end(JSON.stringify({ error: { message: 'invalid api key' } })); }
    if (body.model === 'no-such-model-smoke') { a.statusCode = 404; return a.end(JSON.stringify({ error: { message: 'model not found' } })); }
    a.end(JSON.stringify({ choices: [{ message: { content: '안녕하세요!' } }], usage: { prompt_tokens: 5, completion_tokens: 3 } }));
  });
  const base = 'http://127.0.0.1:' + good.address().port + '/v1';
  let r = await run({ OPENAI_API_KEY: 'good', OPENAI_BASE_URL: base, SMOKE_MODEL_OPENAI: 'gpt-x' }, ['openai']);
  check('well-behaved provider passes all checks', r.code === 0 && (r.out.match(/^PASS /gm) || []).length === 5 && !/^FAIL/m.test(r.out) && !/good/.test(r.out.replace(/PASS|Good/g, '')), r.code + '\n' + r.out);
  check('key never printed', !/Bearer|sk-invalid-smoke-key|=good/.test(r.out));
  // 모델 이름 없음
  r = await run({ OPENAI_API_KEY: 'good', OPENAI_BASE_URL: base }, ['openai']);
  check('missing SMOKE_MODEL fails clearly', r.code === 1 && /SMOKE_MODEL_OPENAI/.test(r.out), r.out);
  // 키 없음
  r = await run({ OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', OPENROUTER_API_KEY: '', GROQ_API_KEY: '', GOOGLE_API_KEY: '', MISTRAL_API_KEY: '', NVIDIA_API_KEY: '' });
  check('no keys exits 2 with usage', r.code === 2 && /키가 설정된/.test(r.out), r.code + r.out);
  // 오류를 숨기는 제공사(잘못된 키에도 200) → 스크립트가 실패로 판정해야 한다
  const liar = await mock((q, b, a) => { a.setHeader('content-type', 'application/json'); a.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })); });
  r = await run({ OPENAI_API_KEY: 'good', OPENAI_BASE_URL: 'http://127.0.0.1:' + liar.address().port + '/v1', SMOKE_MODEL_OPENAI: 'gpt-x' }, ['openai']);
  check('provider that accepts bad keys is flagged', r.code === 1 && /^FAIL openai 잘못된 키/m.test(r.out), r.out);
  good.close(); liar.close();
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
