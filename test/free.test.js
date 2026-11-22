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
  sv = startServer(3102, { OPENROUTER_API_KEY: 'orkey', OPENROUTER_BASE_URL: 'http://127.0.0.1:4101', GROQ_API_KEY: 'gqkey', GROQ_BASE_URL: 'http://127.0.0.1:4102', FREE_ROOM_CAP: '3', ADMIN_TOKEN: 'adm' });
  await sleep(600);
  c = await client(3102, 'Ben', 'room2');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free', apiKey: 'zzz' })); await sleep(300);
  check('free + personal key rejected', errs(c).some(e => e.includes('API 키')), errs(c));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free', model: 'evil-model' })); await sleep(300);
  const meta1 = c.ev.filter(e => e.t === 'meta').pop();
  check('free AI added; meta.free.available', meta1.ais.length === 1 && meta1.free.available === true && meta1.free.left > 0, JSON.stringify(meta1.free));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 안녕' })); await sleep(700);
  check('failover: reply came from groq first configured model', aiMsgs(c).some(t => t.includes('FREE-OK(openai/gpt-oss-120b)')), aiMsgs(c).concat(sysMsgs(c)));
  check('openrouter tried first with free router model + its key', A.log.length === 1 && (A.log[0].model === 'openrouter/free' || A.log[0].model.endsWith(':free')) && A.log[0].auth === 'Bearer orkey', JSON.stringify(A.log));
  check('groq used server key and first configured model', G.log[0] && G.log[0].auth === 'Bearer gqkey' && G.log[0].url === '/chat/completions' && G.log[0].model === 'openai/gpt-oss-120b', JSON.stringify(G.log));
  check('user model ignored', !G.log.concat(A.log).some(l => l.model === 'evil-model'));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 또' })); await sleep(700);
  const kp = (await (await fetch('http://127.0.0.1:3102/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).kpi;
  check('cost: free-pool calls counted as $0 (not unpriced/missing)', kp.cost.freeCalls >= 2 && kp.cost.unpricedCalls === 0 && kp.cost.tokMissingCalls === 0 && kp.cost.usd === 0, JSON.stringify(kp.cost));
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
  // 6) NVIDIA/Gemini/Cerebras/Cloudflare free pools: off by default, on only with key + explicit confirmation flag.
  const X = await mock(4105, 'ok');
  sv = startServer(3108, { NVIDIA_API_KEY: 'srv-nv', NVIDIA_BASE_URL: 'http://127.0.0.1:4105', CEREBRAS_API_KEY: 'srv-cb', CEREBRAS_BASE_URL: 'http://127.0.0.1:4105',
    FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'nvidia', base: 'http://127.0.0.1:4105', models: ['bypass'], key: 'bypass' }]) });
  await sleep(600);
  c = await client(3108, 'Mia', 'room8');
  const g0 = c.ev.filter(e => e.t === 'meta').pop();
  check('extra pools stay off with keys but no confirmation; extra backend cannot take reserved id', g0 && !g0.free.available && X.log.length === 0, JSON.stringify(g0 && g0.free));
  c.ws.close(); sv.kill(); await sleep(200);
  sv = startServer(3109, { NVIDIA_API_KEY: 'srv-nv', NVIDIA_BASE_URL: 'http://127.0.0.1:4105', FREE_NVIDIA_CONFIRMED: '1', FREE_NVIDIA_MODELS: 'nv-model', FREE_CAP_NVIDIA: '1', FREE_ROOM_CAP: '5' });
  await sleep(600);
  c = await client(3109, 'Mia', 'room9');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '엔비', persona: 'p', provider: 'free' })); await sleep(250);
  const g1 = c.ev.filter(e => e.t === 'meta').pop();
  check('NVIDIA pool on with key + confirmation, cap applied', g1 && g1.free.available && g1.free.left === 1, JSON.stringify(g1 && g1.free));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@엔비 안녕' })); await sleep(700);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@엔비 상한' })); await sleep(700);
  check('NVIDIA pool uses server key + configured model and obeys cap', X.log.length === 1 && X.log[0].auth === 'Bearer srv-nv' && X.log[0].model === 'nv-model' && sysMsgs(c).some(t => t.includes('소진')), JSON.stringify({ log: X.log, sys: sysMsgs(c).slice(-2) }));
  c.ws.close(); sv.kill(); await sleep(200);
  X.log.length = 0;
  sv = startServer(3110, { CLOUDFLARE_API_TOKEN: 'cf-tok', CLOUDFLARE_ACCOUNT_ID: 'abc', FREE_CLOUDFLARE_CONFIRMED: '1' });
  await sleep(600);
  c = await client(3110, 'Mia', 'room10');
  const g2 = c.ev.filter(e => e.t === 'meta').pop();
  check('Cloudflare pool needs a valid 32-hex account id', g2 && !g2.free.available, JSON.stringify(g2 && g2.free));
  c.ws.close(); sv.kill(); X.s.close();
  // 7) FreeLLMAPI router: tried first with model "auto" and unified key; falls back to other pools when it fails.
  const FL = await mock(4106, 'ok'), FB = await mock(4107, 'ok');
  sv = startServer(3111, { FREELLMAPI_URL: 'http://127.0.0.1:4106', FREELLMAPI_KEY: 'freellmapi-unified', GROQ_API_KEY: 'g', GROQ_BASE_URL: 'http://127.0.0.1:4107', FREE_ROOM_CAP: '10' });
  await sleep(600);
  c = await client(3111, 'Mia', 'room11');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '라우터', persona: 'p', provider: 'free' })); await sleep(250);
  for (const t of ['하나', '둘', '셋']) { c.ws.send(JSON.stringify({ t: 'msg', text: '@라우터 ' + t })); await sleep(600); }
  check('FreeLLMAPI is always tried first (auto model, unified key, /v1 added)', FL.log.length === 3 && FB.log.length === 0 && FL.log.every(l => l.model === 'auto' && l.auth === 'Bearer freellmapi-unified' && l.url === '/v1/chat/completions'), JSON.stringify({ fl: FL.log, fb: FB.log }));
  c.ws.close(); sv.kill(); FL.s.close(); await sleep(200);
  const FL2 = await mock(4108, '429');
  sv = startServer(3112, { FREELLMAPI_URL: 'http://127.0.0.1:4108/v1', FREELLMAPI_KEY: 'k', GROQ_API_KEY: 'g', GROQ_BASE_URL: 'http://127.0.0.1:4107' });
  await sleep(600);
  c = await client(3112, 'Mia', 'room12');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '라우터', persona: 'p', provider: 'free' })); await sleep(250);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@라우터 폴백' })); await sleep(900);
  check('FreeLLMAPI failure falls back to the next free pool', FL2.log.length === 1 && FB.log.length === 1 && c.ev.some(e => e.t === 'msg' && e.msg.kind === 'ai' && /FREE-OK/.test(e.msg.text)), JSON.stringify({ fl: FL2.log, fb: FB.log }));
  c.ws.close(); sv.kill(); FL2.s.close(); FB.s.close();
  // 8) Keyless public APIs (Pollinations, LLM7): on by default so a server with no keys still gives real answers; keyed pools go first.
  const P = await mock(4109, 'ok'), L = await mock(4110, 'ok'), GK = await mock(4112, 'ok');
  sv = startServer(3113, { FREE_KEYLESS: '1', POLLINATIONS_BASE_URL: 'http://127.0.0.1:4109/openai', LLM7_BASE_URL: 'http://127.0.0.1:4110/v1', FREE_ROOM_CAP: '10' });
  await sleep(600);
  c = await client(3113, 'Mia', 'room13');
  const k0 = c.ev.filter(e => e.t === 'meta').pop();
  check('keyless pool makes free available with no keys at all', k0 && k0.free.available, JSON.stringify(k0 && k0.free));
  c.ws.send(JSON.stringify({ t: 'addAI', name: '공개', persona: 'p', provider: 'free' })); await sleep(250);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@공개 하나' })); await sleep(700);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@공개 둘' })); await sleep(700);
  check('keyless: Pollinations without auth header, LLM7 with placeholder bearer', P.log.length + L.log.length === 2 && P.log.every(l => !l.auth && l.model === 'gpt-oss-20b' && l.url === '/openai/chat/completions') && L.log.every(l => l.auth === 'Bearer unused' && l.model === 'default'), JSON.stringify({ p: P.log, l: L.log }));
  c.ws.close(); sv.kill(); await sleep(200);
  P.log.length = 0; L.log.length = 0;
  sv = startServer(3114, { FREE_KEYLESS: '1', POLLINATIONS_BASE_URL: 'http://127.0.0.1:4109/openai', LLM7_BASE_URL: 'http://127.0.0.1:4110/v1', GROQ_API_KEY: 'g', GROQ_BASE_URL: 'http://127.0.0.1:4112' });
  await sleep(600);
  c = await client(3114, 'Mia', 'room14');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '공개', persona: 'p', provider: 'free' })); await sleep(250);
  for (const t of ['a', 'b']) { c.ws.send(JSON.stringify({ t: 'msg', text: '@공개 ' + t })); await sleep(700); }
  check('keyed free pool (Groq) is preferred over keyless APIs', GK.log.length === 2 && P.log.length === 0 && L.log.length === 0, JSON.stringify({ g: GK.log.length, p: P.log.length, l: L.log.length }));
  c.ws.close(); sv.kill(); await sleep(200);
  sv = startServer(3115, { FREE_KEYLESS: '0' });
  await sleep(600);
  c = await client(3115, 'Mia', 'room15');
  const k2 = c.ev.filter(e => e.t === 'meta').pop();
  check('FREE_KEYLESS=0 turns keyless pool off', k2 && !k2.free.available, JSON.stringify(k2 && k2.free));
  c.ws.close(); sv.kill(); P.s.close(); L.s.close(); GK.s.close();
  // 9) Keyless 429: wait briefly and retry once on the same backend; alternate between keyless APIs; retryAI re-runs the AI.
  let n429 = 0; const P9 = http.createServer((req, res) => { let bb = ''; req.on('data', c => bb += c); req.on('end', () => {
    n429++; res.setHeader('content-type', 'application/json');
    if (n429 === 1) { res.writeHead(429, { 'retry-after': '1' }); return res.end('{"error":{"message":"slow down"}}'); }
    res.writeHead(200); res.end(JSON.stringify({ choices: [{ message: { content: 'KEYLESS-OK' } }] })); }); });
  await new Promise(r => P9.listen(4113, '127.0.0.1', r));
  const L9 = await mock(4114, 'ok');
  sv = startServer(3116, { FREE_KEYLESS: '1', KEYLESS_RETRY_S: '1', POLLINATIONS_BASE_URL: 'http://127.0.0.1:4113/openai', LLM7_BASE_URL: 'http://127.0.0.1:4114/v1', FREE_ROOM_CAP: '10' });
  await sleep(600);
  c = await client(3116, 'Mia', 'room16');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '공개', persona: 'p', provider: 'free' })); await sleep(250);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@공개 첫' })); await sleep(3500);
  check('keyless 429 -> short wait + retry on same backend succeeds', n429 === 2 && c.ev.some(e => e.t === 'msg' && e.msg.kind === 'ai' && /KEYLESS-OK/.test(e.msg.text)) && L9.log.length === 0, JSON.stringify({ n429, l: L9.log.length }));
  c.ws.send(JSON.stringify({ t: 'msg', text: '@공개 둘' })); await sleep(900);
  check('next keyless call alternates to the other API', L9.log.length === 1, L9.log.length);
  const aiId = c.ev.filter(e => e.t === 'meta').pop().ais[0].id, before = c.ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').length;
  c.ws.send(JSON.stringify({ t: 'retryAI', id: aiId })); await sleep(900);
  check('retryAI makes the AI answer again', c.ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').length === before + 1, '');
  c.ws.close(); sv.kill(); P9.close(); L9.s.close();
  // 10) 402(결제 필요) 백엔드는 오래 쉬고 다음 백엔드가 답한다. 잠깐 쉬는 중이면 '소진' 대신 '잠시 쉬는 중'이라고 알린다.
  const P402 = http.createServer((req, res) => { req.on('data', () => {}); req.on('end', () => { res.writeHead(402, { 'content-type': 'application/json' }); res.end('{"error":{"message":"payment required"}}'); }); });
  await new Promise(r => P402.listen(4115, '127.0.0.1', r));
  const OK = await mock(4116, 'ok');
  sv = startServer(3117, { FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'paywall', base: 'http://127.0.0.1:4115', models: ['x'], cap: 100 }, { id: 'okb', base: 'http://127.0.0.1:4116', models: ['y'], cap: 100 }]), FREE_ROOM_CAP: '10' });
  await sleep(600);
  c = await client(3117, 'Mia', 'room17');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free' })); await sleep(250);
  for (const t of ['a', 'b', 'c']) { c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 ' + t })); await sleep(600); }
  const h = await (await fetch('http://127.0.0.1:3117/healthz')).json();
  check('402 backend is benched for hours, the other backend answers every time', OK.log.length === 3 && c.ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').length === 3 && h.free.backends.find(x => x.id === 'paywall').cooling, JSON.stringify({ ok: OK.log.length, h: h.free }));
  c.ws.close(); sv.kill(); P402.close(); OK.s.close(); await sleep(200);
  const R = await mock(4117, '429');
  sv = startServer(3118, { FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'busy', base: 'http://127.0.0.1:4117', models: ['z'], cap: 100 }]), FREE_ROOM_CAP: '10' });
  await sleep(600);
  c = await client(3118, 'Mia', 'room18');
  c.ws.send(JSON.stringify({ t: 'addAI', name: '무료', persona: 'p', provider: 'free' })); await sleep(250);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 하나' })); await sleep(700);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@무료 둘' })); await sleep(700);
  check('while cooling, the error says "resting", not "used up"', sysMsgs(c).some(t => t.includes('잠시 쉬는 중')) && !sysMsgs(c).some(t => t.includes('소진')), sysMsgs(c).slice(-2));
  c.ws.close(); sv.kill(); R.s.close();
  // 11) AI마다 다른 모델 고정 + 한 모델이 고장 나면 그 모델만 쉬고 같은 키의 다른 모델로 대신
  const MM = []; let brokenModel = '';
  const PM = http.createServer((req, res) => { let bb = ''; req.on('data', c => bb += c); req.on('end', () => {
    const j = JSON.parse(bb || '{}'); const who = (/이제 (\S+?)이\(가\)/.exec((j.messages[1] || {}).content || '') || [])[1] || '?'; MM.push({ who, model: j.model });
    res.setHeader('content-type', 'application/json');
    if (j.model === brokenModel) { res.writeHead(500); return res.end('{"error":{"message":"boom"}}'); }
    res.writeHead(200); res.end(JSON.stringify({ choices: [{ message: { content: who + ' via ' + j.model } }] })); }); });
  await new Promise(r => PM.listen(4118, '127.0.0.1', r));
  sv = startServer(3119, { FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'multi', base: 'http://127.0.0.1:4118', models: ['m1', 'm2', 'm3'], cap: 500, key: 'k' }]), FREE_ROOM_CAP: '100' });
  await sleep(600);
  c = await client(3119, 'Mia', 'room19');
  for (const n of ['가', '나', '다']) { c.ws.send(JSON.stringify({ t: 'addAI', name: n, persona: 'p', provider: 'free' })); await sleep(200); }
  for (const n of ['가', '나', '다', '가', '나', '다']) { c.ws.send(JSON.stringify({ t: 'msg', text: '@' + n + ' 안녕' })); await sleep(500); }
  const byAI = {}; MM.forEach(x => { (byAI[x.who] = byAI[x.who] || new Set()).add(x.model); });
  const pinned = ['가', '나', '다'].map(n => [...(byAI[n] || [])]);
  check('each AI keeps one model, and the three AIs use three different models', pinned.every(p => p.length === 1) && new Set(pinned.map(p => p[0])).size === 3, JSON.stringify(pinned));
  await sleep(5200); brokenModel = pinned[0][0]; MM.length = 0;   // 연결당 메시지 속도 제한(5초 8개)을 피해 잠시 쉼
  c.ws.send(JSON.stringify({ t: 'msg', text: '@가 다시' })); await sleep(700);
  c.ws.send(JSON.stringify({ t: 'msg', text: '@나 너는?' })); await sleep(700);
  const fell = MM.filter(x => x.who === '가'), other = MM.filter(x => x.who === '나');
  check('broken model: that AI falls back to another model of the same key; other AIs unaffected', fell.length === 2 && fell[0].model === brokenModel && fell[1].model !== brokenModel && other.length === 1 && other[0].model === pinned[1][0], JSON.stringify(MM));
  c.ws.close(); sv.kill(); PM.close();
  N.s.close();
  A.s.close(); G.s.close();
  console.log(results.every(Boolean) ? 'ALL OK' : 'SOME FAILED'); process.exit(0);
})();
