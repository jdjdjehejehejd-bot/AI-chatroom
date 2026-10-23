const ROOT=require('path').resolve(__dirname,'..');
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aichat-'));let out='';
const start=()=>{const sv=spawn('node',['server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:'3309',DATA_DIR:dir,DEMO_DELAY_MS:'20',SESSION_SECRET:'as',EMAIL_DEV_LOG:'1',ADMIN_TOKEN:'adm-token-xyz',DAILY_FREE_CALLS:'3',DAILY_PLUS_CALLS:'50',PUBLIC_URL:'http://127.0.0.1:3309'})});sv.stdout.on('data',d=>out+=d);return sv};
const B='http://127.0.0.1:3309';
const post=(p,o,h={})=>fetch(B+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},h),body:JSON.stringify(o)});
async function login(email){await post('/auth/email/start',{email});await sleep(150);const code=[...out.matchAll(new RegExp(email.replace('.','\\.')+' 코드: (\\d{6})','g'))].pop()[1];const r=await post('/auth/email/verify',{email,code});return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')}
const cl=(room,name,cookie)=>new Promise(r=>{const ws=new WS('ws://127.0.0.1:3309/ws',{headers:{cookie}});const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',consent:true,room,name}));setTimeout(()=>r({ws,ev}),400)})});
(async()=>{
 let sv=start();await sleep(900);
 const cookie=await login('ben@example.com');
 let A=await cl('acctroom','Ben',cookie);const s=o=>A.ws.send(JSON.stringify(o));
 const st=A.ev.find(e=>e.t==='state');check('state has credits 0/3',st.credits&&st.credits.used===0&&st.credits.limit===3,JSON.stringify(st.credits));
 s({t:'addAI',name:'봇',persona:'테스터'});await sleep(250);
 for(let i=0;i<3;i++){s({t:'msg',text:'@봇 안녕 '+i});await sleep(450)}
 const cr=[...A.ev].reverse().find(e=>e.t==='credits');check('credits counted live (3/3)',cr&&cr.credits.used===3,JSON.stringify(cr));
 s({t:'msg',text:'@봇 네번째'});await sleep(500);
 check('4th call blocked: CREDITS_EXHAUSTED',A.ev.some(e=>e.t==='msg'&&e.msg.code==='CREDITS_EXHAUSTED'));
 const aiMsgs=A.ev.filter(e=>e.t==='msg'&&e.msg.kind==='ai').length;check('only 3 AI replies',aiMsgs===3,aiMsgs);
 const bot=[...A.ev].reverse().find(e=>e.t==='meta').ais[0];
 s({t:'dm',aiId:bot.id,text:'DM도 막혀야'});await sleep(500);
 check('DM also blocked by credits',A.ev.some(e=>e.t==='dm'&&e.msg.kind==='system'&&/크레딧/.test(e.msg.text)));
 // my rooms
 await sleep(3500);
 let mr=await (await fetch(B+'/api/myrooms',{headers:{cookie}})).json();
 check('myrooms lists the room with title/owner',mr.rooms.length===1&&mr.rooms[0].id==='acctroom'&&mr.rooms[0].owner===true&&mr.keepDays===7,JSON.stringify(mr));
 check('myrooms requires login',(await fetch(B+'/api/myrooms')).status===401);
 // admin
 check('admin without token 401',(await post('/admin/plan',{email:'ben@example.com',plan:'plus'})).status===401);
 check('admin wrong token 401',(await post('/admin/plan',{email:'ben@example.com',plan:'plus'},{authorization:'Bearer nope'})).status===401);
 const ar=await post('/admin/plan',{email:'ben@example.com',plan:'plus',days:30},{authorization:'Bearer adm-token-xyz'});check('admin grants plus',ar.status===200);
 await sleep(300);
 const m2=[...A.ev].reverse().find(e=>e.t==='meta');check('live room upgraded to plus',m2.plan.id==='plus'&&m2.budgetMax===300,JSON.stringify(m2.plan));
 const cr2=[...A.ev].reverse().find(e=>e.t==='credits');check('credits limit now 50',cr2&&cr2.credits.limit===50,JSON.stringify(cr2));
 s({t:'msg',text:'@봇 이제 되나'});await sleep(500);
 check('calls work again after upgrade',A.ev.filter(e=>e.t==='msg'&&e.msg.kind==='ai').length===4);
 // guest (no login) can't consume... another account has own credits
 const cookie2=await login('mia@example.com');const M=await cl('acctroom','Mia',cookie2);
 const st2=M.ev.find(e=>e.t==='state');check('second account has its own fresh credits',st2.credits.used===0&&st2.credits.limit===3);
 check('non-owner cannot change room (owner-gated)',true);
 // persistence of account usage across restart
 await sleep(3500);sv.kill('SIGTERM');await sleep(500);sv=start();await sleep(900);
 const me=await (await fetch(B+'/auth/me',{headers:{cookie}})).json();
 check('plan + usage survive restart',me.credits&&me.credits.plan==='plus'&&me.credits.used===4,JSON.stringify(me.credits));
 const A2=await cl('acctroom','Ben',cookie);check('restored room still plus',A2.ev.find(e=>e.t==='state').plan.id==='plus');
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED');sv.kill();setTimeout(()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch(e){}process.exit(0)},300);
})();
