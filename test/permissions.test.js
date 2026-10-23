/* 방 권한 규칙 표(README "방 권한"): 방장이 있는 방은 설정 변경이 방장 전용, 게스트가 만든 방은 모두가 같은 권한. */
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = []; const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
let out = ''; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perm-')); const PORT = 3335, B = 'http://127.0.0.1:' + PORT;
const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: dir, DEMO_DELAY_MS: '20', SESSION_SECRET: 'as', EMAIL_DEV_LOG: '1', REQUIRE_LOGIN: '0' }) });
sv.stdout.on('data', d => out += d); sv.stderr.on('data', d => out += d);
const post = (p, o) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
async function login(email) { await post('/auth/email/start', { email }); await sleep(150); const code = [...out.matchAll(new RegExp(email.replace('.', '\\.') + ' 코드: (\\d{6})', 'g'))].pop()[1]; const r = await post('/auth/email/verify', { email, code }); return r.headers.getSetCookie().map(c => c.split(';')[0]).join('; '); }
const cl = (room, name, cookie) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + PORT + '/ws', { headers: cookie ? { cookie } : {} }); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name, consent: true })); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
const OWNER_ONLY = { kick: { name: 'Zed' }, memory: { text: 'm' }, mute: { id: 'a1', muted: true }, config: { budgetLimit: 10 }, plan: { plan: 'plus' }, asset: { asset: {} }, brand: { name: 'x' }, pipeline: { steps: [] }, applyLib: { id: 'x' }, delLib: { id: 'x' }, mode: { id: 'make' }, addAI: { name: 'Bot', persona: 'p' }, removeAI: { id: 'a1' }, share: { kind: 'chat' }, clearNotes: { id: 'a1' } };
const denied = (c, from) => c.ev.slice(from).filter(e => e.t === 'err' && /방장/.test(e.text)).length;
(async () => {
  await sleep(900);
  const ck1 = await login('ben@example.com'), ck2 = await login('mia@example.com');
  // 1) 방장이 있는 방
  const O = await cl('permown', 'Ben', ck1), M = await cl('permown', 'Mia', ck2), G = await cl('permown', 'Guest', null);
  for (const [who, c] of [['logged-in non-owner', M], ['guest', G]]) {
    const miss = []; for (const [t, p] of Object.entries(OWNER_ONLY)) { const n = c.ev.length; c.s(Object.assign({ t }, p)); await sleep(700); if (!denied(c, n)) miss.push(t); }
    check('owned room: ' + who + ' denied for all ' + Object.keys(OWNER_ONLY).length + ' owner-only actions', !miss.length, 'not denied: ' + miss);
  }
  const n0 = O.ev.length; O.s({ t: 'config', budgetLimit: 12 }); await sleep(200);
  check('owned room: owner is not denied', !denied(O, n0));
  check('owned room: non-owner state says youOwner=false', M.ev.find(e => e.t === 'state').youOwner === false && O.ev.find(e => e.t === 'state').youOwner === true);
  await sleep(5200);
  // 일반 발언·귓속말은 누구나
  M.s({ t: 'msg', text: '안녕' }); await sleep(250);
  check('owned room: non-owner can chat', M.ev.some(e => e.t === 'msg' && e.msg.text === '안녕'));
  // 2) 게스트가 만든 방: 모두 같은 권한
  const g1 = await cl('permgst', 'Gus', null), g2 = await cl('permgst', 'Gia', ck2);
  const miss2 = []; for (const t of ['config', 'addAI', 'mode', 'mute', 'memory']) { const n = g2.ev.length; g2.s(Object.assign({ t }, OWNER_ONLY[t])); await sleep(700); if (denied(g2, n)) miss2.push(t); }
  check('guest-created room: any participant may change settings', !miss2.length, 'denied: ' + miss2);
  check('guest-created room: everyone gets youOwner=true', g1.ev.find(e => e.t === 'state').youOwner === true && g2.ev.find(e => e.t === 'state').youOwner === true);
  await sleep(5200);
  // 3) 방장 삭제 권한: 다른 사람의 메시지는 방장만 지울 수 있다
  O.s({ t: 'msg', text: '방장 글' }); await sleep(250);
  const mid = M.ev.find(e => e.t === 'msg' && e.msg.text === '방장 글').msg.id;
  const n1 = M.ev.length; M.s({ t: 'delmsg', id: mid }); await sleep(250);
  check('non-owner cannot delete others\' messages', M.ev.slice(n1).some(e => e.t === 'err') && !M.ev.slice(n1).some(e => e.t === 'msgdel'));
  M.s({ t: 'msg', text: '내 글' }); await sleep(250);
  const mine = O.ev.find(e => e.t === 'msg' && e.msg.text === '내 글').msg.id;
  O.s({ t: 'delmsg', id: mine }); await sleep(250);
  check('owner may delete a participant\'s message', O.ev.some(e => e.t === 'msgdel' && e.id === mine));
  sv.kill(); console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
