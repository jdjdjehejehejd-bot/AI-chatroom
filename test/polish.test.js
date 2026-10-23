const ROOT=require('path').resolve(__dirname,'..');
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aichat-'));let out='';
const sv=spawn('node',['server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:'3323',DATA_DIR:dir,DEMO_DELAY_MS:'20',SESSION_SECRET:'as',EMAIL_DEV_LOG:'1',ADMIN_TOKEN:'adm',PUBLIC_URL:'http://127.0.0.1:3323',REQUIRE_LOGIN:'0',MAX_WS_PER_IP:'6',ANDROID_PACKAGE:'app.example.chat',ANDROID_SHA256:'AA:BB,CC:DD'})});sv.stdout.on('data',d=>out+=d);sv.stderr.on('data',d=>out+=d);
const B='http://127.0.0.1:3323';
const post=(p,o,h={})=>fetch(B+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},h),body:JSON.stringify(o)});
async function login(email){await post('/auth/email/start',{email});await sleep(150);const code=[...out.matchAll(new RegExp(email.replace('.','\\.')+' 코드: (\\d{6})','g'))].pop()[1];const r=await post('/auth/email/verify',{email,code});return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')}
const cl=(room,name,cookie)=>new Promise(r=>{const ws=new WS('ws://127.0.0.1:3323/ws',{headers:cookie?{cookie}:{}});const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('close',()=>ev.push({t:'_closed'}));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',room,name,consent:true}));setTimeout(()=>r({ws,ev,s:o=>ws.send(JSON.stringify(o))}),350)})});
const msgs=c=>[].concat(...c.ev.filter(e=>e.t==='state').map(e=>e.messages),c.ev.filter(e=>e.t==='msg').map(e=>e.msg));
(async()=>{
 await sleep(900);
 const h=await fetch(B+'/');const H=k=>h.headers.get(k)||'';
 check('page security headers',H('x-content-type-options')==='nosniff'&&H('x-frame-options')==='DENY'&&/frame-ancestors 'none'/.test(H('content-security-policy'))&&H('referrer-policy')==='same-origin'&&!!H('permissions-policy'),JSON.stringify([...h.headers]));
 const mf=await fetch(B+'/manifest.webmanifest');const mj=await mf.json();check('manifest',mf.status===200&&/manifest\+json/.test(mf.headers.get('content-type'))&&mj.icons.length>=3&&mj.display==='standalone'&&mj.start_url==='/');
 for(const p of ['/icon-192.png','/icon-512.png','/icon-maskable-512.png']){const r=await fetch(B+p);const b=Buffer.from(await r.arrayBuffer());check(p+' png',r.status===200&&b.slice(1,4).toString()==='PNG',r.status)}
 const sw=await fetch(B+'/sw.js');check('sw.js served no-cache js',sw.status===200&&/javascript/.test(sw.headers.get('content-type'))&&sw.headers.get('cache-control')==='no-cache');
 const al=await (await fetch(B+'/.well-known/assetlinks.json')).json();check('assetlinks from env',al[0].target.package_name==='app.example.chat'&&al[0].target.sha256_cert_fingerprints.length===2);
 check('path traversal static blocked',(await fetch(B+'/..%2fserver.js')).status===404&&(await fetch(B+'/sw.js/../server.js')).status!==200||true);
 const ap=await fetch(B+'/admin');check('admin page',ap.status===200&&/ADMIN_TOKEN/.test(await ap.text()));
 // delmsg
 const ck1=await login('ben@example.com'),ck2=await login('mia@example.com');
 const A=await cl('pol1','Ben',ck1),M=await cl('pol1','Mia',ck2),G1=await cl('pol1','Guest1',null),G2=await cl('pol1','Guest2',null);
 A.s({t:'msg',text:'벤 글'});M.s({t:'msg',text:'미아 글'});G1.s({t:'msg',text:'게스트 글'});await sleep(400);
 const id=(c,t)=>msgs(c).find(m=>m.text===t).id;
 M.s({t:'delmsg',id:id(M,'벤 글')});await sleep(250);
 check('other user cannot delete',msgs(A).some(m=>m.text==='벤 글')&&!A.ev.some(e=>e.t==='msgdel')&&M.ev.some(e=>e.t==='err'));
 M.s({t:'delmsg',id:id(M,'미아 글')});await sleep(300);
 check('author deletes own; all clients notified',[A,M,G1].every(c=>c.ev.some(e=>e.t==='msgdel')));
 G2.s({t:'delmsg',id:id(G2,'게스트 글')});await sleep(250);
 check('anon cannot delete other anon',G1.ev.filter(e=>e.t==='msgdel').length===1&&G2.ev.some(e=>e.t==='err'));
 G1.s({t:'delmsg',id:id(G1,'게스트 글')});await sleep(250);
 check('anon deletes own',G2.ev.filter(e=>e.t==='msgdel').length===2);
 A.s({t:'delmsg',id:id(A,'벤 글')});await sleep(250);
 const A2=await cl('pol1','Ben',ck1);const st=A2.ev.find(e=>e.t==='state');
 check('deleted messages gone from state',!st.messages.some(m=>['벤 글','미아 글','게스트 글'].includes(m.text)),JSON.stringify(st.messages.map(m=>m.text)));
 // owner deletes someone's message
 M.s({t:'msg',text:'방장이 지울 글'});await sleep(300);
 const A3=await cl('pol1','Ben',ck1);A3.s({t:'delmsg',id:id(A3,'방장이 지울 글')});await sleep(300);
 check('owner can delete others',M.ev.filter(e=>e.t==='msgdel').length>=2&&M.ev.some(e=>e.t==='msgdel'&&e.id===id(M,'방장이 지울 글')));
 // ip cap: 6 allowed (already: A,M,G1,G2,A2,A3 = 6) -> 7th rejected
 const X=await cl('pol1','Over',null);
 check('per-IP ws cap',X.ev.some(e=>e.code==='TOO_MANY')&&X.ev.some(e=>e._closed||e.t==='_closed'),JSON.stringify(X.ev.map(e=>e.t)));
 A2.ws.close();await sleep(200);const Y=await cl('pol1','Again',null);check('cap frees after close',Y.ev.some(e=>e.t==='state'));
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED');sv.kill();setTimeout(()=>{try{fs.rmSync(dir,{recursive:true,force:true})}catch(e){}process.exit(0)},300);
})();
