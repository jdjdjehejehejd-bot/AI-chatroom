/* Debate 모드와 공유 "나도 해보기" 고리: 산출물 생성, 공유 페이지 메타·링크, 질문 비노출, XSS 이스케이프 */
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deb-')); const port = 3351;
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }), stdio: 'ignore' });
  try {
    await sleep(900);
    const ev = []; const ws = new WS('ws://127.0.0.1:' + port + '/ws'); ws.on('message', d => ev.push(JSON.parse(d)));
    await new Promise(r => ws.on('open', r)); const s = o => ws.send(JSON.stringify(o));
    s({ t: 'join', room: 'dbt1', name: 'Ann', consent: true }); await sleep(400);
    s({ t: 'mode', id: 'debate' }); await sleep(300);
    const meta0 = ev.filter(e => e.t === 'meta').pop();
    check('debate mode applied (4 free→3 roles)', meta0 && meta0.mode && meta0.mode.id === 'debate', JSON.stringify(meta0 && meta0.mode));
    s({ t: 'msg', text: '비밀질문XYZ 재택근무가 나을까?' }); await sleep(2500);
    const who = ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').map(e => e.msg.who);
    check('free room (5 AIs) runs the full pipeline 옹호자→반박자→검증자→심판', who.join(',').includes('옹호자,반박자,검증자,심판'), who.join(','));
    const dv = ev.filter(e => e.t === 'deliv').pop();
    check('judge saves a verdict card as deliverable', dv && dv.deliv.by === '심판' && /## 결론/.test(dv.deliv.text) && /## 갈리는 것/.test(dv.deliv.text), JSON.stringify(dv && dv.deliv));
    s({ t: 'share', kind: 'result' }); await sleep(400);
    const sh = ev.filter(e => e.t === 'shared').pop();
    check('share link created', sh && /^\/s\/[0-9a-f]{12}$/.test(sh.url), JSON.stringify(sh));
    const page = await (await fetch('http://127.0.0.1:' + port + sh.url)).text();
    check('share page has link-preview meta', /property="og:title"/.test(page) && /property="og:description"/.test(page), page.slice(0, 400));
    check('free share carries remix link with mode only', /href="\/\?mode=debate"/.test(page) && /Debate 모드로 해보기/.test(page), page.slice(0, 900));
    check('remix link/page never leaks the asked question', !/비밀질문XYZ/.test(page), 'leak');
    // 존재하지 않는 공유 ID는 404, 이상한 mode 값은 무시
    const bad = await fetch('http://127.0.0.1:' + port + '/s/zzzzzzzzzzzz'); check('unknown share id → 404', bad.status === 404, bad.status);
    // 플러스 방은 배지가 없어 홍보 링크도 없음(선택권 존중)
    s({ t: 'join', room: 'dbt2', name: 'Bob', consent: true }); await sleep(300);
    s({ t: 'plan', id: 'plus' }); await sleep(200); s({ t: 'mode', id: 'debate' }); await sleep(300);
    s({ t: 'msg', text: '질문' }); await sleep(3000); s({ t: 'share', kind: 'result' }); await sleep(400);
    const sh2 = ev.filter(e => e.t === 'shared').pop(); const page2 = await (await fetch('http://127.0.0.1:' + port + sh2.url)).text();
    check('plus share has no promo bar but keeps preview meta', !/class="badge"/.test(page2) && /og:title/.test(page2), page2.slice(0, 300));
    const meta2 = ev.filter(e => e.t === 'meta').pop();
    check('plus room gets 검증자 in the pipeline', ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai' && e.msg.who === '검증자').length >= 1, 'no verifier');
    ws.close();
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
