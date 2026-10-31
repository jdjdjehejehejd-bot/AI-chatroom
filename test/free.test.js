'use strict';
const ROOT=require('path').resolve(__dirname,'..');
const http = require('http'), { spawn } = require('child_process');
const WS = require('ws');
const results = [];
const check = (n, c, d) => { results.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function mock(port, mode) {
  const log = [];
  const s = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const j = JSON.parse(b || '{}');
      log.push({ url: req.url, auth: req.headers.authorization, model: j.model });
      res.setHeader('content-type', 'application/json');
      if (mode === '429') { res.writeHead(429); return res.end(JSON.stringify({ error: { message: 'rate limited' } })); }
      res.writeHead(200); res.end(JSON.stringify({ choices: [{ message: { content: 'FREE-OK(' + j.model + ')' } }] }));
    });
  });
  return new Promise(r => s.listen(port, '127.0.0.1', () => r({ s, log })));
}
function startServer(port, env) {
  const p = spawn('node', [ROOT+'/server.js'], { env: Object.assign({}, process.env, { PORT: port, DEMO_DELAY_MS: 10 }, env), stdio: 'ignore' });
  return p;
}
function client(port, name, room) {
  return new Promise(res => {
    const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = [];
    ws.on('message', d => ev.push(JSON.parse(d)));
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name })); setTimeout(() => res({ ws, ev }), 300); });
  });
}
const aiMsgs = c => c.ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').map(e => e.msg.text);
const errs = c => c.ev.filter(e => e.t === 'err').map(e => e.text);
const sysMsgs = c => c.ev.filter(e => e.t === 'msg' && e.msg.kind === 'system').map(e => e.msg.text);
(async () => {
  const A = await mock(4101, '429'), G = await mock(4102, 'ok');
  // 1) 키 없음
  let sv = startServer(3101, {}); await sleep(600);
  let c = await client(3101, 'x', 'room1');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free' })); await sleep(300);
  check('free rejected when not configured', errs(c).some(e => e.includes('무료 모델이 설정되어 있지 않')), errs(c));
  const meta0 = c.ev.filter(e => e.t === 'meta').pop();
  check('meta.free.available false', meta0 && meta0.free && meta0.free.available === false, JSON.stringify(meta0 && meta0.free));
  sv.kill(); await sleep(200);

  // 2) OpenRouter 429 -> Groq 로 넘어감, 방 한도 3회
  sv = startServer(3102, { OPENROUTER_API_KEY: 'orkey', OPENROUTER_BASE_URL: 'http://127.0.0.1:4101', GROQ_API_KEY: 'gqkey', GROQ_BASE_URL: 'http://127.0.0.1:4102', FREE_ROOM_CAP: '3' });
  await sleep(600);
  c = await client(3102, 'Ben', 'room2');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free', apiKey: 'zzz' })); await sleep(300);
  check('free + personal key rejected', errs(c).some(e => e.includes('API 키')), errs(c));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free', model: 'evil-model' })); await sleep(300);
  const meta1 = c.ev.filter(e => e.t === 'meta').pop();
  check('free AI added; meta.free.available', meta1.ais.length === 1 && meta1.free.available === true && meta1.free.left > 0, JSON.stringify(meta1.free));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 안녕' })); await sleep(700);
  check('failover: reply came from groq first configured model', aiMsgs(c).some(t => t.includes('FREE-OK(openai/gpt-oss-120b)')), aiMsgs(c).concat(sysMsgs(c)));
  check('openrouter tried first with :free model + its key', A.log.length === 1 && A.log[0].model.endsWith(':free') && A.log[0].auth === 'Bearer orkey', JSON.stringify(A.log));
  check('groq used server key and first configured model', G.log[0] && G.log[0].auth === 'Bearer gqkey' && G.log[0].url === '/chat/completions' && G.log[0].model === 'openai/gpt-oss-120b', JSON.stringify(G.log));
  check('user model ignored', !G.log.concat(A.log).some(l => l.model === 'evil-model'));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 또' })); await sleep(700);
  check('openrouter in cooldown (not retried)', A.log.length === 1, A.log.length);
  check('2 replies so far', aiMsgs(c).length === 2, aiMsgs(c));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 셋' })); await sleep(700);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 넷' })); await sleep(700);
  check('room cap blocks 4th call', aiMsgs(c).length === 3 && sysMsgs(c).some(t => t.includes('무료 모델 사용 한도(3회)')), aiMsgs(c).length + ' ' + sysMsgs(c).slice(-2));
  const meta2 = c.ev.filter(e => e.t === 'meta').pop();
  sv.kill(); await sleep(200);

  // 3) 기본(default) 제공사가 무료 풀로 연결 + 일일 상한
  G.log.length = 0; A.log.length = 0;
  sv = startServer(3103, { GROQ_API_KEY: 'gqkey', GROQ_BASE_URL: 'http://127.0.0.1:4102', FREE_CAP_GROQ: '2' });
  await sleep(600);
  c = await client(3103, 'Ben', 'room3');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '기본', persona: 'p', provider: 'default' })); await sleep(300);
  for (const t of ['@기본 1', '@기본 2', '@기본 3']) { c.ws.send(JSON.stringify({ t: 'msg', text: t })); await sleep(700); }
  check('default -> free pool (2 calls reached groq)', G.log.length === 2, G.log.length);
  check('daily cap stops 3rd call with message', sysMsgs(c).some(t => t.includes('소진')), sysMsgs(c));
  sv.kill();

  // 4) 추가 백엔드(키 없음) + NVIDIA 본인 키 전용
  G.log.length = 0; A.log.length = 0;
  const N = await mock(4103, 'ok');
  sv = startServer(3104, { FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'ovh', base: 'http://127.0.0.1:4103', models: ['gpt-oss-120b'], cap: 5 }, { id: 'bad', base: 'file:///etc/passwd', models: ['x'] }]),
    NVIDIA_BASE_URL: 'http://127.0.0.1:4103', NVIDIA_NIM_API_KEY: 'server-nv-key' });
  await sleep(600);
  c = await client(3104, 'Ben', 'room4');
  const m4 = c.ev.filter(e => e.t === 'meta').pop();
  c.ws.send(JSON.stringify({ t: 'addAI', name: '키없는무료', persona: 'p', provider: 'free' })); await sleep(300);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@키없는무료 안녕' })); await sleep(700);
  check('keyless extra backend works, no auth header', N.log.length === 1 && N.log[0].auth === undefined && N.log[0].model === 'gpt-oss-120b', JSON.stringify(N.log));
  check('non-http extra backend ignored (cap sum = 5)', c.ev.filter(e => e.t === 'meta').pop().free.left <= 5, JSON.stringify(c.ev.filter(e => e.t === 'meta').pop().free));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '엔비디아', persona: 'p', provider: 'nvidia', model: 'openai/gpt-oss-20b' })); await sleep(300);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@엔비디아 안녕' })); await sleep(700);
  check('nvidia without own key: refused, server key NOT used', N.log.length === 1 && sysMsgs(c).some(t => t.includes('본인 API 키')), sysMsgs(c).slice(-2));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '내키', persona: 'p', provider: 'nvidia', model: 'openai/gpt-oss-20b', apiKey: 'user-nv-key' })); await sleep(300);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@내키 안녕' })); await sleep(700);
  check('nvidia with own key uses it', N.log.length === 2 && N.log[1].auth === 'Bearer user-nv-key' && N.log[1].model === 'openai/gpt-oss-20b', JSON.stringify(N.log));

  // 5) Mistral server-key free mode is gated, while direct Mistral stays BYOK.
  const M = await mock(4104, 'ok');
  sv = startServer(3105, { MISTRAL_API_KEY: 'server-mistral-key', MISTRAL_BASE_URL: 'http://127.0.0.1:4104',
    MISTRAL_FREE_TRAINING_OPT_OUT_CONFIRMED: 'true', FREE_MISTRAL_MODELS: 'mistral-test',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mistral', base: 'http://127.0.0.1:4104', models: ['bypass-model'], key: 'bypass-key' }]) });
  await sleep(600);
  c = await client(3105, 'Mia', 'room5');
  const mGate0 = c.ev.filter(e => e.t === 'meta').pop();
  check('Mistral requires exact opt-out flag; extra backend cannot bypass it', mGate0 && !mGate0.free.available && M.log.length === 0, JSON.stringify(mGate0 && mGate0.free));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '서버키금지', persona: 'p', provider: 'mistral', model: 'mistral-test' })); await sleep(250);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@서버키금지 서버키 미사용 확인' })); await sleep(700);
  check('direct Mistral ignores server key without personal key', sysMsgs(c).some(e => e.includes('본인 API 키')) && M.log.length === 0, sysMsgs(c).slice(-2));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '내키', persona: 'p', provider: 'mistral', model: 'mistral-test', apiKey: 'member-mistral-key' })); await sleep(250);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@내키 개인키 요청' })); await sleep(700);
  check('direct Mistral uses member key, not server key', M.log.length === 1 && M.log[0].auth === 'Bearer member-mistral-key', JSON.stringify(M.log));
  c.ws.close(); sv.kill(); await sleep(200);

  // Explicit model allowlist is required even when key and opt-out confirmation exist.
  sv = startServer(3106, { MISTRAL_API_KEY: 'server-mistral-key', MISTRAL_BASE_URL: 'http://127.0.0.1:4104',
    MISTRAL_FREE_TRAINING_OPT_OUT_CONFIRMED: '1', FREE_MISTRAL_MODELS: '' });
  await sleep(600);
  c = await client(3106, 'Mia', 'room6');
  const mGate1 = c.ev.filter(e => e.t === 'meta').pop();
  check('Mistral remains off without an explicit included-model list', mGate1 && !mGate1.free.available, JSON.stringify(mGate1 && mGate1.free));
  c.ws.close(); sv.kill(); await sleep(200);

  // All gates open: server key is used only for the configured model and cap.
  M.log.length = 0;
  sv = startServer(3107, { MISTRAL_API_KEY: 'server-mistral-key', MISTRAL_BASE_URL: 'http://127.0.0.1:4104',
    MISTRAL_FREE_TRAINING_OPT_OUT_CONFIRMED: '1', FREE_MISTRAL_MODELS: 'mistral-test', FREE_CAP_MISTRAL: '1', FREE_ROOM_CAP: '2' });
  await sleep(600);
  c = await client(3107, 'Mia', 'room7');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free' })); await sleep(250);
  const mGate2 = c.ev.filter(e => e.t === 'meta').pop();
  check('Mistral pool available when key, opt-out, and model list are set', mGate2 && mGate2.free.available && mGate2.free.left === 1, JSON.stringify(mGate2 && mGate2.free));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 첫 호출' })); await sleep(700);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 상한 확인' })); await sleep(700);
  check('Mistral sends configured model with server key and obeys daily cap', M.log.length === 1 && M.log[0].auth === 'Bearer server-mistral-key' && M.log[0].model === 'mistral-test' && sysMsgs(c).some(t => t.includes('소진')), JSON.stringify({ log: M.log, sys: sysMsgs(c).slice(-2) }));
  c.ws.close(); sv.kill(); M.s.close();
  N.s.close();
  A.s.close(); G.s.close();
  console.log(results.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(0);
})();
