/* 익명 깔때기·재방문 이벤트: 방 단위로 한 번씩만, 사용자 식별자·내용 없음, 클라이언트 이벤트는 허용 목록만 */
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const start = (port, dir) => spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, ADMIN_TOKEN: 'adm', REQUIRE_LOGIN: '0', ALLOW_DEV_PLAN: '1', DEMO_DELAY_MS: '30', SESSION_SECRET: 's', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' }), stdio: 'ignore' });
const cl = (port, room, name) => new Promise(r => { const ws = new WS('ws://127.0.0.1:' + port + '/ws'); const ev = []; ws.on('message', d => ev.push(JSON.parse(d))); ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', room, name, consent: true })); setTimeout(() => r({ ws, ev, s: o => ws.send(JSON.stringify(o)) }), 400); }); });
const events = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).events;
const kpi = async port => (await (await fetch('http://127.0.0.1:' + port + '/admin/events', { headers: { authorization: 'Bearer adm' } })).json()).kpi;
const sum = (e, k) => Object.values(e).reduce((a, d) => a + (d[k] || 0), 0);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-')); const port = 3391; let sv = start(port, dir);
  try {
    await sleep(900);
    const A = await cl(port, 'kp1', 'Ann');
    A.s({ t: 'mode', id: 'make' }); await sleep(300);
    A.s({ t: 'msg', text: '웹페이지 만들어줘' }); await sleep(2500);
    A.s({ t: 'msg', text: '조금 고쳐줘' }); await sleep(2500);
    const dv = A.ev.filter(e => e.t === 'deliv').pop().deliv; const v2 = dv.v, v1 = v2 - 1;
    const send = async o => { A.s(o); await sleep(700); };   // 서버는 연결당 5초에 8개까지만 받는다
    await send({ t: 'share', kind: 'result' });                                    // 최신 버전 공유 → 채택 1
    await send({ t: 'share', kind: 'chat' });                                      // 대화 공유는 결과 공유와 따로 센다
    await send({ t: 'kpi', n: 'copy_success', v: v2 }); await send({ t: 'kpi', n: 'copy_success', v: v2 });   // 같은 버전·같은 행동은 한 번만
    await send({ t: 'kpi', n: 'copy_failed', v: v2 }); await send({ t: 'kpi', n: 'download_clicked', v: v2 }); await send({ t: 'kpi', n: 'download_clicked', v: v2 });
    await send({ t: 'kpi', n: 'evil_event', v: v2 }); await send({ t: 'kpi', n: 'copy_success', v: 99 }); await send({ t: 'kpi', n: 'copy_success' });
    await send({ t: 'kpi', n: 'copy_success', v: v1 });                            // 이전 버전의 복사 성공 → 채택 2
    await send({ t: 'kpi', n: 'rate', v: v2, r: 5 }); await send({ t: 'kpi', n: 'rate', v: v2, r: 1 }); await send({ t: 'kpi', n: 'rate', v: v1, r: 0 });
    await send({ t: 'kpi', n: 'rate', v: v1, r: 6 }); await send({ t: 'kpi', n: 'rate', v: v1, r: 3.5 });
    let e = await events(port);
    check('funnel: each step counted once per room', ['first_human_msg', 'first_ai_reply', 'first_deliverable', 'first_share'].every(k => sum(e, k) === 1), JSON.stringify(e));
    check('result share and chat share are separate; first_share counts result shares only', sum(e, 'result_share_created') === 1 && sum(e, 'chat_share_created') === 1 && sum(e, 'share_created') === 0, JSON.stringify(e));
    check('run outcomes: completed counted, run_with_deliverable counted, no failure/cancel', sum(e, 'run_completed') >= 2 && sum(e, 'run_with_deliverable') >= 1 && sum(e, 'run_failed') === 0, JSON.stringify(e));
    check('copy success / failed / download click are separate, once per version', sum(e, 'copy_success') === 2 && sum(e, 'copy_failed') === 1 && sum(e, 'download_clicked') === 1, JSON.stringify(e));
    check('invalid version, unknown action and missing version are ignored', sum(e, 'evil_event') === 0 && sum(e, 'copy_success.make') === 2, JSON.stringify(e));
    check('adoption counted once per deliverable version (share + copy on one version = 1)', sum(e, 'deliv_adopted') === 2, JSON.stringify(e));
    check('ratings: only 1..5 integers, once per version', sum(e, 'rating.5') === 1 && sum(e, 'rating.1') === 0 && sum(e, 'rating.0') === 0 && sum(e, 'rating.6') === 0, JSON.stringify(e));
    check('events are tagged with the flow (make)', sum(e, 'run_started.make') >= 2 && sum(e, 'first_deliverable.make') === 1 && sum(e, 'deliv_adopted.make') === 2, JSON.stringify(e));
    check('events carry no room id / name / text', !/kp1|Ann|웹페이지/.test(JSON.stringify(e)), 'leak');
    const k = await kpi(port);
    check('admin kpi: funnel and ratios', k.funnel.rooms === 1 && k.funnel.humanMsg === 1 && k.funnel.replyPerMsg === 1 && k.funnel.deliverable === 1, JSON.stringify(k.funnel));
    check('admin kpi: adopted per version, ratings, per-flow table', k.adopted === 2 && k.adoptedPerVersion === 1 && k.ratings.rated === 1 && k.ratings.useful === 1 && k.ratings.usefulRate === 1 && k.byFlow.make.adopted === 2 && k.byFlow.free.runs === 0, JSON.stringify(k));
    check('admin kpi: run breakdown and failed-call field', k.runs.failed === 0 && k.runs.withDeliverable >= 1 && k.runs.deliverablePerRun > 0 && k.cost.failedCallsUnverified === 0 && k.byFlow.make.resultShares === 1 && k.byFlow.make.chatShares === 1, JSON.stringify([k.runs, k.cost]));
    check('admin kpi: demo mode = no_real_calls (not "cost 0 and complete")', k.cost.status === 'no_real_calls' && k.cost.perAdoptedUsd === null && k.cost.perUsefulUsd === null && k.cost.realCalls === 0, JSON.stringify(k.cost));
    const F = await cl(port, 'kp3', 'Fay'); F.s({ t: 'addAI', name: '모나', persona: '', provider: 'demo' }); await sleep(300); F.s({ t: 'config', policy: 'round' }); await sleep(200);
    F.s({ t: 'msg', text: '자유롭게 이야기해요' }); await sleep(1500); F.ws.close();
    const kf = await kpi(port);
    check('free flow (no mode) is counted separately from modes', kf.byFlow.free.runs >= 1 && kf.byFlow.free.completed >= 1 && kf.byFlow.make.runs === 2, JSON.stringify([kf.byFlow.free, kf.byFlow.make.runs]));
    A.ws.close(); await sleep(1500);
    // 방 나이를 3일 전으로 돌려 재시작 → 재방문(d2_7), 같은 날 두 번째 입장은 세지 않는다
    sv.kill(); await sleep(600);
    const f = path.join(dir, 'rooms', 'kp1.json'); const d = JSON.parse(fs.readFileSync(f, 'utf8')); d.created = Date.now() - 3 * 86400000; fs.writeFileSync(f, JSON.stringify(d));
    sv = start(port, dir); await sleep(1000);
    const B = await cl(port, 'kp1', 'Bob'); B.ws.close(); await sleep(300);
    const B2 = await cl(port, 'kp1', 'Bob'); B2.ws.close(); await sleep(300);
    e = await events(port);
    check('room return counted once per day (age bucket d2_7)', sum(e, 'room_return.d2_7') === 1 && !sum(e, 'room_return.d1') && !sum(e, 'room_return.d8p'), JSON.stringify(e));
    const E = await cl(port, 'kp2', 'Eve'); E.ws.close(); await sleep(300);
    e = await events(port);
    check('a brand-new room is not a return', sum(e, 'room_return.d2_7') === 1, JSON.stringify(e));
  } finally { sv.kill(); }
  console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(0);
})();
