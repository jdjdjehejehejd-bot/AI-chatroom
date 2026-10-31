const ROOT=require('path').resolve(__dirname,'..');
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aichat-'));let out='';
const start=()=>{const sv=spawn('node',['server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:'3321',DATA_DIR:dir,DEMO_DELAY_MS:'20',SESSION_SECRET:'as',EMAIL_DEV_LOG:'1',ADMIN_TOKEN:'adm',PUBLIC_URL:'http://127.0.0.1:3321',OPERATOR_NAME:'테스트운영',CONTACT_EMAIL:'help@example.com',REQUIRE_LOGIN:'0'})});sv.stdout.on('data',d=>out+=d);sv.stderr.on('data',d=>out+=d);return sv};
const B='http://127.0.0.1:3321';
const post=(p,o,h={})=>fetch(B+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},h),body:JSON.stringify(o)});
async function login(email){await post('/auth/email/start',{email});await sleep(150);const code=[...out.matchAll(new RegExp(email.replace('.','\\.')+' 코드: (\\d{6})','g'))].pop()[1];const r=await post('/auth/email/verify',{email,code});return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')}
const cl=(room,name,cookie,consent)=>new Promise(r=>{const ws=new WS('ws://127.0.0.1:3321/ws',{headers:cookie?{cookie}:{}});const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('close',()=>ev.push({t:'_closed'}));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',room,name,consent}));setTimeout(()=>r({ws,ev,s:o=>ws.send(JSON.stringify(o))}),400)})});
const msgs=c=>c.ev.filter(e=>e.t==='msg').map(e=>e.msg);
(async()=>{
 let sv=start();await sleep(900);
 // legal pages
 for(const p of ['/privacy','/terms','/delete-account']){const r=await fetch(B+p);const t=await r.text();check(p+' 200 html + CSP',r.status===200&&/html/.test(r.headers.get('content-type'))&&!!r.headers.get('content-security-policy')&&t.length>500,r.status)}
 const pko=await (await fetch(B+'/privacy?lang=ko')).text();
 check('privacy shows operator info',/테스트운영/.test(pko));
 check('Korean privacy explains Mistral Free training and server-key routing',/Mistral Studio Free mode/.test(pko)&&/운영자 키로 Mistral/.test(pko)&&/학습 옵트아웃/.test(pko));
 const pen=await (await fetch(B+'/privacy?lang=en')).text();
 check('English privacy explains Mistral Free training and retention',/operator’s key/.test(pen)&&/Mistral Studio Free mode/.test(pen)&&/zero data retention/.test(pen));
 check('healthz',(await fetch(B+'/healthz')).status===200);
 const ck1=await login('ben@example.com'),ck2=await login('mia@example.com'),ck3=await login('zed@example.com');
 // consent
 let X=await cl('safe1','Ben',ck1,false);
 check('consent required without consent',X.ev.some(e=>e.t==='err'&&e.code==='CONSENT_REQUIRED')&&!X.ev.some(e=>e.t==='state'),JSON.stringify(X.ev.map(e=>e.t)));
 X.ws.close();
 const A=await cl('safe1','Ben',ck1,true);check('join ok with consent',A.ev.some(e=>e.t==='state'));
 const M=await cl('safe1','Mia',ck2,true);
 const Z=await cl('safe1','Zed',ck3,true);
 const G=await cl('safe1','Guest',null,true);
 check('guest join ok (anon)',G.ev.some(e=>e.t==='state'));
 // second join w/o consent flag works (already consented)
 const M2=await cl('safe1','Mia',ck2,undefined);check('consent remembered',M2.ev.some(e=>e.t==='state'));M2.ws.close();
 A.s({t:'addAI',name:'봇',persona:'p'});await sleep(250); A.s({t:'addAI',name:'봇2',persona:'p'});await sleep(250);
 M.s({t:'msg',text:'미아의 스팸 메시지'});await sleep(300);
 Z.s({t:'msg',text:'제드의 정상 메시지'});await sleep(300);
 const mm=msgs(A).find(m=>m.text==='미아의 스팸 메시지');
 check('msg has no _sub leak',mm&&!('_sub' in mm)&&!JSON.stringify(A.ev).includes('_sub'));
 // report
 A.s({t:'report',id:mm.id,reason:'spam',note:'광고'});await sleep(250);
 check('reported ack',A.ev.some(e=>e.t==='reported'&&e.id===mm.id));
 A.s({t:'report',id:mm.id,reason:'spam'});await sleep(250);
 const rl=await (await fetch(B+'/admin/reports',{headers:{authorization:'Bearer adm'}})).json();
 check('admin reports 1 (dup guarded)',rl.reports&&rl.reports.length===1&&rl.reports[0].text.includes('스팸')&&rl.reports[0].reason==='spam',JSON.stringify(rl));
 check('admin reports requires token',(await fetch(B+'/admin/reports')).status===401);
 // report AI message
 A.s({t:'msg',text:'@봇 안녕'});await sleep(600);
 const ai=msgs(A).find(m=>m.kind==='ai');check('AI replied',!!ai);
 if(ai){M.s({t:'report',id:ai.id,reason:'abuse'});await sleep(250);
  const r2=await (await fetch(B+'/admin/reports',{headers:{authorization:'Bearer adm'}})).json();
  check('AI message report recorded',r2.reports.length===2&&r2.reports.some(x=>x.aiId||x.who===ai.who),JSON.stringify(r2.reports[0]))}
 const rid=rl.reports[0].id;
 check('resolve works',(await post('/admin/reports/resolve',{id:rid,status:'resolved'},{authorization:'Bearer adm'})).status===200&&(await (await fetch(B+'/admin/reports',{headers:{authorization:'Bearer adm'}})).json()).reports.every(x=>x.id!==rid));
 // block
 A.s({t:'block',name:'Mia'});await sleep(300);
 check('blocked ack',A.ev.some(e=>e.t==='blocked'&&e.name==='Mia'));
 M.s({t:'msg',text:'차단 후 메시지'});await sleep(300);
 check('blocker does not see blocked msg',!msgs(A).some(m=>m.text==='차단 후 메시지'));
 check('others still see it',msgs(Z).some(m=>m.text==='차단 후 메시지'));
 const A2=await cl('safe1','Ben',ck1,true);
 const st=A2.ev.find(e=>e.t==='state');
 check('state history hides blocked sender for blocker',!st.messages.some(m=>m.text.includes('미아')||m.text==='차단 후 메시지')&&st.messages.some(m=>m.text==='제드의 정상 메시지'),JSON.stringify(st.messages.map(m=>m.text)));
 check('state carries blocked list',Array.isArray(st.blocked)&&st.blocked.length===1,JSON.stringify(st.blocked));
 A.s({t:'unblock',name:'Mia'});await sleep(300);
 const A3=await cl('safe1','Ben',ck1,true);check('unblock restores history',A3.ev.find(e=>e.t==='state').messages.some(m=>m.text==='차단 후 메시지'));A3.ws.close();A2.ws.close();
 // anonymous session block
 G.s({t:'block',name:'Zed'});await sleep(250);Z.s({t:'msg',text:'제드 둘째'});await sleep(300);
 check('anon session block hides',!msgs(G).some(m=>m.text==='제드 둘째')&&msgs(A).some(m=>m.text==='제드 둘째'));
 // kick: only owner (Ben is owner since first)
 M.s({t:'kick',name:'Zed'});await sleep(250);
 check('non-owner kick rejected',!Z.ev.some(e=>e.code==='KICKED'));
 A.s({t:'kick',name:'Zed'});await sleep(400);
 check('kicked user got KICKED + closed',Z.ev.some(e=>e.t==='err'&&e.code==='KICKED')&&Z.ev.some(e=>e.t==='_closed'),JSON.stringify(Z.ev.slice(-3)));
 const Z2=await cl('safe1','Zed',ck3,true);check('kicked cannot rejoin',Z2.ev.some(e=>e.code==='KICKED')&&!Z2.ev.some(e=>e.t==='state'));
 // restart persistence of ban
 await sleep(3500);sv.kill('SIGTERM');await sleep(600);sv=start();await sleep(1000);
 const Z3=await cl('safe1','Zed',ck3,true);check('ban persists after restart',Z3.ev.some(e=>e.code==='KICKED'));
 const rr=await (await fetch(B+'/admin/reports?status=all',{headers:{authorization:'Bearer adm'}})).json();check('reports persist',rr.reports.length>=2,rr.reports&&rr.reports.length);
 // export + delete (Mia: member of safe1; also owner of room mia1)
 const M3=await cl('mia1','Mia',ck2,true);M3.s({t:'msg',text:'미아방 글'});await sleep(300);
 const Mb=await cl('safe1','Mia',ck2,true);Mb.s({t:'msg',text:'미아 개인정보 글'});await sleep(300);
 await sleep(3500);
 const ex=await fetch(B+'/api/export',{headers:{cookie:ck2}});const exj=await ex.json();
 check('export attachment with my msgs',ex.status===200&&/attachment/.test(ex.headers.get('content-disposition')||'')&&JSON.stringify(exj).includes('미아 개인정보 글'),JSON.stringify(exj).slice(0,200));
 check('export requires login',(await fetch(B+'/api/export')).status===401);
 check('delete requires login',(await post('/auth/delete',{confirm:'삭제'})).status===401);
 check('delete needs confirm',(await post('/auth/delete',{confirm:'x'},{cookie:ck2})).status===400);
 check('delete blocks cross-origin',(await post('/auth/delete',{confirm:'삭제'},{cookie:ck2,origin:'http://evil.example'})).status>=400);
 const dr=await post('/auth/delete',{confirm:'삭제'},{cookie:ck2});
 check('delete ok + cookies cleared',dr.status===200&&dr.headers.getSetCookie().some(c=>/aichat_session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)),dr.status+JSON.stringify(dr.headers.getSetCookie()));
 check('old session dead after delete',(await (await fetch(B+'/auth/me',{headers:{cookie:ck2}})).json()).user==null);
 await sleep(500);
 check('owned room file removed',!fs.existsSync(path.join(dir,'rooms','mia1.json')));
 check('owned room closed with ROOM_DELETED',M3.ev.some(e=>e.code==='ROOM_DELETED'));
 const A4=await cl('safe1','Ben',ck1,true);const sm=A4.ev.find(e=>e.t==='state').messages;
 check("member room: Mia's msgs anonymized",!sm.some(m=>m.text.includes('미아 개인정보'))&&sm.some(m=>m.who==='탈퇴한 사용자'),JSON.stringify(sm.map(m=>[m.who,m.text])));
 const newroom=await cl('mia1','X',ck1,true);check('deleted room is brand new',newroom.ev.find(e=>e.t==='state').messages.length<=1);
 await sleep(3500);
 await new Promise(r=>{sv.once('exit',r);sv.kill('SIGTERM')});
 const accountFile=path.join(dir,'accounts.json'), persisted=JSON.parse(fs.readFileSync(accountFile,'utf8'));
 const hasAccounts=Object.keys(persisted).length>0;
 check('accounts persisted for consent-version test',hasAccounts);
 Object.values(persisted).forEach(a=>a.consentVer='2026-10-23');
 fs.writeFileSync(accountFile,JSON.stringify(persisted));
 sv=start();await sleep(1000);
 const stale=await cl('safe1','Ben',ck1,undefined);
 check('old policy consent requires re-consent',stale.ev.some(e=>e.t==='err'&&e.code==='CONSENT_REQUIRED')&&!stale.ev.some(e=>e.t==='state'),JSON.stringify(stale.ev.map(e=>e.t)));
 stale.ws.close();
 const renewed=await cl('safe1','Ben',ck1,true);
 check('re-consent under current policy version permits entry',renewed.ev.some(e=>e.t==='state'),JSON.stringify(renewed.ev.map(e=>e.t)));
 await sleep(3500);
 const updatedAccounts=JSON.parse(fs.readFileSync(accountFile,'utf8'));
 check('new consent version is persisted',Object.values(updatedAccounts).some(a=>a.consentVer==='2026-10-31'));
 const raw=fs.readdirSync(dir,{recursive:true}).map(f=>{try{return fs.readFileSync(path.join(dir,f),'utf8')}catch(e){return''}}).join('\n');
 check('no mia content on disk after restart',!raw.includes('미아 개인정보 글')&&!raw.includes('mia@example.com')==true||!raw.includes('미아 개인정보 글'),'');
 check('mia email not in accounts',!raw.includes('mia@example.com'));
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED');sv.kill();setTimeout(()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch(e){}process.exit(0)},300);
})();
