/* 진짜 단체방 같은 자유 채팅(기본 free): 턴·순서·답할 의무가 없다.
   새 메시지마다 AI들이 각자(동시에) 볼지·말할지 정하고, 먼저 끝난 말이 먼저 올라오며, 모두 넘기면 아무도 말하지 않는다.
   @로 불러도 넘길 수 있다(프롬프트로 알려만 줌). 사람 말 뒤 AI 말은 연속 발언 한도까지 */
const { spawn } = require('child_process'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'); const WS = require('ws');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
(async () => {
  let mode = 'allpass'; const log = []; let lastUser = '';
  const nameOf = j => (/(?:이제 (\S+?)이\(가\) 말할 차례다|너는 (\S+?)이다\.)/.exec(((j.messages[1] || {}).content) || '') || []).slice(1).find(Boolean) || '';
  const mock = http.createServer((req, rq) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const sys = (j.messages[0] || {}).content || ''; const name = nameOf(j); lastUser = ((j.messages[1] || {}).content) || lastUser;
    const must = /\[PASS\] 금지|\[PASS\]는 허용되지 않는다/.test(sys);
    log.push({ name, called: sys.includes('너를 @로 불렀다'), optional: /\[PASS\]/.test(sys) && !must, must, rescue: sys.includes('아직 아무도 반응하지 않았다'), again: sys.includes('[PASS]는 허용되지 않는다'), wind: /AI들끼리 \d+번 말했다/.test(sys) });
    /* 'allpass': 할 말이 없으면 넘기지만 지시(반드시 답하라)는 따르는 모델. 'stubborn': 첫 지시를 무시하고 한 번 더 요구받아야 답하는 모델 */
    let text = '[PASS]', delay = 30;
    if (mode === 'allpass' && must) text = name + ' 응답';
    if (mode === 'aidm') { if (sys.includes('1:1 비공개 DM')) text = '알겠어\n[DM @나] 아까 나한테 뭐라 했어?'; else if (sys.includes('너에게만 몰래 DM을 보냈다') && sys.includes('반드시')) text = '별말 안 했어 ㅋㅋ'; }
    if (mode === 'greetjoin') { const u = ((j.messages[1] || {}).content) || ''; if (/\(알림\) Bob 님이 입장했습니다/.test(u) && name === '가') text = 'Bob 어서와!'; }
    if (mode === 'dmonly') { if (sys.includes('1:1 비공개 DM')) text = '[DM @나] Ann이 서운했대'; else if (sys.includes('너에게만 몰래 DM을 보냈다') && sys.includes('반드시')) text = 'Ann 미안해, 일부러 그런 거 아니야'; }
    if (mode === 'nopass') { text = /말할 차례다/.test((j.messages[1] || {}).content || '') ? name + ' 결국 대답' : '[PASS]'; }
        if (mode === 'relay') { if (sys.includes('1:1 비공개 DM')) text = '알겠어 물어볼게\n[DM @나] 너 아까 왜 조용했어?'; else if (sys.includes('물어본 것의 답이 왔다')) text = '나는 그냥 피곤했대'; else if (sys.includes('너에게만 몰래 DM을 보냈다')) text = '그냥 피곤했어'; }
    if (mode === 'greetdm') { const u = (j.messages[1] || {}).content || ''; if (sys.includes('1:1 비공개 DM')) text = '알겠어\n[DM @나] 너 왜 조용해?'; else if (name === '나' && sys.includes('너에게만 몰래 DM을 보냈다') && /ㅎㅇ/.test(u) && !/\(나\): 안녕/.test(u)) text = '안녕!'; else if (name === '나' && sys.includes('너에게만 몰래 DM을 보냈다')) text = '그냥 피곤해서'; else if (must) text = name + ' 응답'; }
        if (mode === 'whisper') { if (name === '다' && !sys.includes('1:1 비공개 DM')) text = '[DM @Ann] 너한테만 말하는 건데, 아까 그거 비밀이야'; }
    if (mode === 'dmgroup') { if (sys.includes('1:1 비공개 DM')) text = '알겠어 지금 물어볼게\n[단체방] @나 아까 뭐라고 했어?'; else if (must) text = name + ' 대답: 별말 안 했어'; }
    if (mode === 'stubborn' && /\[PASS\]는 허용되지 않는다/.test(sys)) text = name + ' 마지못해 응답';
    if (mode === 'chatty') text = name + ' 의견';
    if (mode === 'one' && name === '나' && log.filter(l => l.name === '나').length === 1) text = '나는 이렇게 생각해';
    if (mode === 'dup') { const ctx = ((j.messages[1] || {}).content) || ''; text = /랑데부/.test(ctx) ? '[PASS]' : '랑데부'; delay = name === '가' ? 80 : 350; }
    if (mode === 'race') { text = name + ' 의견'; delay = name === '가' ? 300 : name === '다' ? 100 : 200; }
    setTimeout(() => { rq.writeHead(200, { 'content-type': 'application/json' }); rq.end(JSON.stringify({ choices: [{ message: { content: text } }] })); }, delay);
  }); });
  await new Promise(r => mock.listen(4121, '127.0.0.1', r));
  const sv = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: '3321', DEFAULT_POLICY: 'free', CHAT_EVENT_GAP_MS: '0', ROOM_CALL_BUDGET: '200', ROOM_CALL_BUDGET_MAX: '200', CHAT_JITTER_MIN_MS: '0', CHAT_JITTER_MAX_MS: '60', CHAT_SAFETY_MAX: '7', CHAT_SLOWDOWN_MS: '20', CHAT_TYPE_MIN_MS: '500', CHAT_TYPE_PER_CHAR_MS: '0', FREE_ROOM_CAP: '300', FREE_EXTRA_BACKENDS: JSON.stringify([{ id: 'mk', base: 'http://127.0.0.1:4121', models: ['m'], cap: 900 }]), FREE_ROOM_CAP: '300', REQUIRE_LOGIN: '0', SESSION_SECRET: 's' }), stdio: 'ignore' });
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
    ws.send(JSON.stringify({ t: 'msg', text: '오늘 좀 심심하네' })); await sleep(1500);
    { const sp = new Set(ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').map(e => e.msg.who)); check('AIs that pass never show a typing bubble (only the one that speaks types)', ev.filter(e => e.t === 'typing' && e.on).every(e => sp.has(e.who)) && sp.size === 1, JSON.stringify([...sp])); }
    check('nobody is forced at first: everyone looked once and could pass', log.slice(0, 3).every(l => l.optional) && new Set(log.slice(0, 3).map(l => l.name)).size === 3, JSON.stringify(log));
    check('a human line is never just ignored: when all passed, exactly one AI is asked to react and does', ais() - a0 === 1 && log.filter(l => l.rescue).length === 1 && log[3].rescue && log.slice(4).every(l => l.optional) && !ev.some(e => e.t === 'msg' && e.msg.code === 'AI_ERROR'), JSON.stringify({ n: ais() - a0, log }));
    check('passing does not use up the room budget (only the one real line counts)', budgetUsed() === 1, budgetUsed());
    a0 = ais(); log.length = 0; mode = 'one';
    ws.send(JSON.stringify({ t: 'msg', text: '오늘 날씨 어때?' })); await sleep(1500);
    check('one AI speaks; the others get another look at the new message (no turns)', ais() - a0 === 1 && log.length >= 4, JSON.stringify(log));
    a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: '@나 너한테 묻는 거야' })); await sleep(1500);
    check('@mention must be answered: mentioned AI is told to answer and does; others stay optional', ais() - a0 === 1 && ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').pop().msg.who === '나' && log.find(l => l.name === '나').called && log.find(l => l.name === '나').must && !log.find(l => l.name === '가').called, JSON.stringify(log));
    a0 = ais(); log.length = 0; mode = 'stubborn';
    ws.send(JSON.stringify({ t: 'msg', text: '@다 대답해 줘' })); await sleep(1500);
    check('@mention: a model that still passes is asked once more and then answers', ais() - a0 === 1 && ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').pop().msg.who === '다' && log.filter(l => l.name === '다' && l.again).length === 1, JSON.stringify(log));
    // 방 전체에 건 인사·질문(얘들아, 다들…)은 모두를 부른 것: AI마다 각자 답한다
    await sleep(1500); a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: '안녕 얘들아' })); await sleep(2000);
    { const who = ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').slice(-3).map(e => e.msg.who).sort().join(',');
      check('a greeting to everyone gets an answer from every AI', ais() - a0 === 3 && who === '가,나,다', JSON.stringify({ n: ais() - a0, who, log: log.map(l => l.name + (l.must ? '!' : '')) })); }
    // 이름 없이 건 짧은 인사(ㅎㅇㅎㅇ)도 모두에게 한 인사: AI마다 답한다
    await sleep(1500); a0 = ais(); log.length = 0; mode = 'allpass';
    ws.send(JSON.stringify({ t: 'msg', text: 'ㅎㅇㅎㅇ' })); await sleep(2000);
    check('a bare greeting (ㅎㅇㅎㅇ) gets an answer from every AI', ais() - a0 === 3, JSON.stringify(log.map(l => l.name + (l.must ? '!' : ''))));
    check('greeting together: each AI is asked to answer once, no re-think just because another AI greeted first', log.filter(l => l.must).length === 3, JSON.stringify(log.map(l => l.name)));
    // 끝까지 넘기려는 모델: 불렸으면 넘김 선택지를 빼고 한 번 더 불러 결국 답한다
    a0 = ais(); log.length = 0; mode = 'nopass';
    ws.send(JSON.stringify({ t: 'msg', text: '@가 대답해' })); await sleep(2000);
    check('a mentioned AI that keeps passing is finally asked without a pass option and answers', ev.filter(e => e.t === 'msg' && e.msg.kind === 'ai').pop().msg.who === '가' && ais() - a0 === 1, JSON.stringify(log.map(l => l.name + (l.optional ? '?' : '') + (l.must ? '!' : ''))));
    // 방 소식(입장)도 AI가 대화로 보고 반응한다
    mode = 'allpass'; await sleep(1500); log.length = 0; mode = 'greetjoin';
    const j0 = ev.length; const wb = new WS('ws://127.0.0.1:3321/ws'); await new Promise(r => wb.on('open', r));
    wb.send(JSON.stringify({ t: 'join', room: 'auto1', name: 'Bob', consent: true })); await sleep(2500);
    check('AIs see a join notice in their context and can greet the newcomer', ev.slice(j0).some(e => e.t === 'msg' && e.msg.kind === 'ai' && e.msg.text === 'Bob 어서와!'), JSON.stringify(ev.slice(j0).filter(e => e.t === 'msg').map(e => e.msg.who + ':' + e.msg.text)));
    wb.close(); await sleep(300);
    a0 = ais(); log.length = 0; mode = 'chatty';
    ws.send(JSON.stringify({ t: 'msg', text: '자유롭게 떠들어 봐' })); await sleep(9000);
    check('no fixed 4-line cap: AIs keep going while they have something to say, never beyond the safety line (7 here)', ais() - a0 > 4 && ais() - a0 <= 7, ais() - a0);
    check('prompt tells AIs how long they have been chatting so they can wind down', log.some(l => l.wind), '');
    const n0 = ev.length; mode = 'race';
    ws.send(JSON.stringify({ t: 'msg', text: '각자 한마디씩!' })); await sleep(3000);
    const seq = ev.slice(n0).filter(e => (e.t === 'typing' && e.on) || (e.t === 'msg' && e.msg.kind === 'ai')).map(e => e.t === 'typing' ? 'T:' + e.who : 'M:' + e.msg.who);
    const firstMsg = seq.findIndex(x => x.startsWith('M:'));
    check('the three speakers type at the same time before any reply', ['가', '나', '다'].every(n => seq.slice(0, firstMsg).includes('T:' + n)), JSON.stringify(seq));
    const ms = seq.filter(x => x.startsWith('M:'));
    check('after one posts, the others re-read before posting (no pile-up of stale replies)', ms.length >= 2 && ms.every((x, i) => i === 0 || x !== ms[i - 1]), JSON.stringify(seq));
    await sleep(6000);
    check('typing indicators cleared when the room goes quiet', ev.slice(n0).some(e => e.t === 'typing' && e.who === null), '');
    // 맥락 표시: 대화 기록에 사람/AI/내 말이 구분되어 들어가고, 자유 채팅에서는 '네 차례다'라고 하지 않는다
    check('chat log marks (사람)/(AI)/(나) so each AI can read whose line is whose', lastUser.includes('(사람)') && lastUser.includes('(나)') && !lastUser.includes('말할 차례다'), lastUser.slice(-300));
    // 같은 대화를 보고 동시에 생각해도, 먼저 올라온 말이 있으면 낡은 생각을 버리고 다시 읽는다(중복 답 방지)
    mode = 'allpass'; await sleep(4000);   // 앞 대화가 완전히 잦아든 뒤
    const d0 = ev.length; mode = 'dup';
    ws.send(JSON.stringify({ t: 'msg', text: '끝말잇기 다음 단어?' })); await sleep(3000);
    const dups = ev.slice(d0).filter(e => e.t === 'msg' && e.msg.kind === 'ai' && e.msg.text === '랑데부').length;
    check('no duplicate answers: a stale draft is re-thought after someone else posts', dups === 1, dups + ' ' + JSON.stringify(ev.slice(d0).filter(e => e.t === 'err' || e.t === 'msg').map(e => e.t === 'err' ? 'ERR:' + e.text : e.msg.who + ':' + e.msg.text)) + JSON.stringify(log.slice(-6)));
    // 귓속말에서 "단체방에 물어볼게" → 말만 하지 않고 [단체방] 줄로 실제로 올리고, 불린 AI가 답한다
    mode = 'allpass'; await sleep(2500);
    const g0 = ev.length; mode = 'dmgroup';
    const ga = (ev.filter(e => e.t === 'meta').pop()).ais.find(a => a.name === '가');
    ws.send(JSON.stringify({ t: 'dm', aiId: ga.id, text: '나한테 욕한 거 직접 물어봐' })); await sleep(2500);
    const gm = ev.slice(g0).filter(e => e.t === 'msg' && e.msg.kind === 'ai').map(e => e.msg.who + ':' + e.msg.text);
    const dmr = ev.slice(g0).filter(e => e.t === 'dm' && e.msg.kind === 'ai').map(e => e.msg.text);
    check('whisper can act in the group: [단체방] line is posted by that AI, the DM keeps only the private part', gm[0] === '가:@나 아까 뭐라고 했어?' && dmr.length === 1 && dmr[0] === '알겠어 지금 물어볼게', JSON.stringify({ gm, dmr }));
    check('the AI mentioned from a whisper-triggered line answers in the group', gm.some(x => x.startsWith('나:나 대답')), JSON.stringify(gm));
    // 단체방 대화 중에도 AI가 스스로 판단해 사람에게 귓속말을 보낸다(단체방에는 안 보이고, 씹은 것으로 치지 않는다)
    mode = 'allpass'; await sleep(2500);
    const w0 = ev.length; log.length = 0; mode = 'whisper';
    ws.send(JSON.stringify({ t: 'msg', text: '다들 비밀 하나씩 있어?' })); await sleep(2500);
    const wdm = ev.slice(w0).filter(e => e.t === 'dm' && e.msg.kind === 'ai');
    const da = (ev.filter(e => e.t === 'meta').pop()).ais.find(a => a.name === '다');
    check('AI can whisper to a human on its own from the group chat', wdm.length === 1 && wdm[0].aiId === da.id && wdm[0].msg.text.includes('비밀이야'), JSON.stringify(wdm));
    check('the whisper is not posted in the group and counts as a reaction (no rescue)', !ev.slice(w0).some(e => e.t === 'msg' && e.msg.kind === 'ai') && !log.some(l => l.rescue), JSON.stringify(log));
    // AI끼리 몰래 쪽지: 받은 AI는 반드시 답하고([DM] 줄 없이 답해도 보낸 AI에게 가는 답장이 됨), 단체방에는 아무것도 안 올라가며, 답장에 대한 답장은 선택이라 끝난다
    mode = 'allpass'; await sleep(2500);
    const k0 = ev.length; log.length = 0; mode = 'aidm';
    const ga2 = (ev.filter(e => e.t === 'meta').pop()).ais.find(a => a.name === '가');
    ws.send(JSON.stringify({ t: 'dm', aiId: ga2.id, text: '나한테 뭐라 했는지 걔한테 물어봐' })); await sleep(3000);
    const ad = (ev.slice(k0).filter(e => e.t === 'aidms').pop() || { list: [] }).list;
    const th = ad.find(t => [t.a, t.b].sort().join() === '가,나') || { msgs: [] };
    check('AI-to-AI DM gets answered privately by the receiving AI', th.msgs.some(m => m.from === '가' && m.to === '나') && th.msgs.some(m => m.from === '나' && m.to === '가' && m.text.includes('별말 안 했어')), JSON.stringify(th.msgs));
    check('the private exchange does not spill into the group, and it stops', !ev.slice(k0).some(e => e.t === 'msg' && e.msg.kind === 'ai') && log.filter(l => l.name === '가').length <= 3, JSON.stringify(log.map(l => l.name)));
    // 귓속말로 "대신 전해줘": 답장 본문이 비어도 무엇을 했는지 보이고, 받은 AI는 사람에게 직접 하는 말(사과)을 단체방에 할 수 있다
    mode = 'allpass'; await sleep(2500);
    const q0 = ev.length; mode = 'dmonly';
    const ga3 = (ev.filter(e => e.t === 'meta').pop()).ais.find(a => a.name === '가');
    ws.send(JSON.stringify({ t: 'dm', aiId: ga3.id, text: '네가 대신 전해줘' })); await sleep(3000);
    const dr = ev.slice(q0).filter(e => e.t === 'dm' && e.msg.kind === 'ai').map(e => e.msg.text);
    check('DM reply is never "(응답 없음)" when the AI acted: it says what it passed on', dr.length === 1 && dr[0].startsWith('(나에게 몰래 전했어요)'), JSON.stringify(dr));
    check('the receiving AI can apologise to the person in the group', ev.slice(q0).some(e => e.t === 'msg' && e.msg.kind === 'ai' && e.msg.who === '나' && e.msg.text.includes('Ann 미안해')), JSON.stringify(ev.slice(q0).filter(e => e.t === 'msg').map(e => e.msg.who + ':' + e.msg.text)));
    // 대신 물어봐 줘 → 다른 AI에게 몰래 묻고 → 답이 오면 부탁한 사람에게 귓속말로 전한다(실모델 QA: "답 오면 알려줄게" 하고 끝내 안 알려줌)
    mode = 'allpass'; await sleep(2500);
    const r0 = ev.length; mode = 'relay';
    const ga4 = (ev.filter(e => e.t === 'meta').pop()).ais.find(a => a.name === '가');
    ws.send(JSON.stringify({ t: 'dm', aiId: ga4.id, text: '나한테 왜 조용했는지 대신 물어봐 줘' })); await sleep(4000);
    const rd = ev.slice(r0).filter(e => e.t === 'dm' && e.msg.kind === 'ai' && e.aiId === ga4.id).map(e => e.msg.text);
    check('relay: the asking AI reports the answer back to the person by whisper', rd.length >= 2 && rd[rd.length - 1] === '나는 그냥 피곤했대', JSON.stringify(rd));
    check('relay: nothing about it is posted in the group', !ev.slice(r0).some(e => e.t === 'msg' && e.msg.kind === 'ai'), JSON.stringify(ev.slice(r0).filter(e => e.t === 'msg').map(e => e.msg.who + ':' + e.msg.text)));
    // 인사와 쪽지가 겹쳐도 쪽지를 잊지 않는다(실모델 QA: 단체방 인사만 하고 쪽지 답은 빠뜨림)
    mode = 'allpass'; await sleep(2500);
    const g5 = ev.length; mode = 'greetdm';
    const ga5 = (ev.filter(e => e.t === 'meta').pop()).ais.find(a => a.name === '가');
    ws.send(JSON.stringify({ t: 'dm', aiId: ga5.id, text: '나한테 몰래 물어봐 줘' })); await sleep(200);
    ws.send(JSON.stringify({ t: 'msg', text: 'ㅎㅇ' })); await sleep(5000);
    const ad5 = (ev.slice(g5).filter(e => e.t === 'aidms').pop() || { list: [] }).list.flatMap(t => t.msgs).filter(m => m.from === '나' && m.to === '가');
    check('an AI that greets in the group still answers the private note it got', ad5.some(m => m.text === '그냥 피곤해서'), JSON.stringify({ ad5: ad5.map(m => m.text), msgs: ev.slice(g5).filter(e => e.t === 'msg').map(e => e.msg.who + ':' + e.msg.text), log: log.slice(-8).map(l => l.name + (l.must ? '!' : '')) }));
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
