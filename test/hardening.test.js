/* 운영 점검(시작 검증), 공유 링크 영속성, 제공사 호출 지표 */
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const ROOT=path.resolve(__dirname,'..');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
const run=(env,port)=>{let out='';const sv=spawn('node',['server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:String(port),DEMO_DELAY_MS:'20',REQUIRE_LOGIN:'0'},env)});sv.stdout.on('data',d=>out+=d);sv.stderr.on('data',d=>out+=d);const x={sv,out:()=>out,exited:new Promise(r=>sv.on('exit',c=>r(c)))};return x};
const cl=(port,room,name)=>new Promise(r=>{const ws=new WS('ws://127.0.0.1:'+port+'/ws');const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',room,name,consent:true}));setTimeout(()=>r({ws,ev,s:o=>ws.send(JSON.stringify(o))}),400)})});
(async()=>{
 // 1. 운영인데 SESSION_SECRET 없음 → 시작 거부
 let a=run({NODE_ENV:'production'},3330);const code=await Promise.race([a.exited,sleep(2500).then(()=>'alive')]);
 check('production without SESSION_SECRET refuses to start',code===1&&/SESSION_SECRET/.test(a.out()),code+' '+a.out());a.sv.kill();
 a=run({PUBLIC_URL:'https://x.example'},3330);check('https PUBLIC_URL counts as production',await Promise.race([a.exited,sleep(2500).then(()=>'alive')])===1);a.sv.kill();
 a=run({NODE_ENV:'production',ALLOW_EPHEMERAL_SECRET:'1'},3330);await sleep(1200);check('ALLOW_EPHEMERAL_SECRET=1 starts with DATA_DIR warning',(await fetch('http://127.0.0.1:3330/healthz')).status===200&&/DATA_DIR/.test(a.out()),a.out());a.sv.kill();await sleep(300);
 a=run({PUBLIC_URL:'https://x.example',SESSION_SECRET:'s',DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'h-'))},3330);await sleep(1200);check('https without COOKIE_SECURE warns',/COOKIE_SECURE/.test(a.out())&&/ADMIN_TOKEN/.test(a.out()),a.out());a.sv.kill();await sleep(300);
 // 2. FREE_EXTRA_BACKENDS: 운영에서는 원격 http 거부, 로컬 http와 https는 허용
 const avail=async(base,port)=>{const s=run({NODE_ENV:'production',SESSION_SECRET:'s',DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'h-')),FREE_EXTRA_BACKENDS:JSON.stringify([{id:'ex',base,models:['m']}])},port);await sleep(1000);const c=await cl(port,'fb1','Ann');const st=c.ev.find(e=>e.t==='state');c.ws.close();s.sv.kill();await sleep(300);return st&&st.free.available};
 check('production rejects remote http backend',(await avail('http://evil.example/v1',3331))===false);
 check('production accepts https backend',(await avail('https://ok.example/v1',3332))===true);
 check('production accepts localhost http backend',(await avail('http://127.0.0.1:9/v1',3333))===true);
 // 3. 공유 링크 영속성 + 제공사 지표
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'h-'));
 let s=run({DATA_DIR:dir,ADMIN_TOKEN:'adm'},3334);await sleep(900);
 let A=await cl(3334,'sh1','Ann');A.s({t:'mode',id:'make'});await sleep(300);A.s({t:'msg',text:'만들어줘'});await sleep(2500);
 A.s({t:'share',kind:'result'});await sleep(400);
 const sh=A.ev.find(e=>e.t==='shared'||e.t==='share');const url=sh&&(sh.url||sh.link||sh.id);
 const id=(JSON.stringify(sh||{}).match(/[0-9a-f]{12}/)||[])[0];
 check('share link created',!!id,JSON.stringify(sh));
 check('share page served',(await fetch('http://127.0.0.1:3334/s/'+id)).status===200);
 A.ws.close();await sleep(300);s.sv.kill();await sleep(700);
 s=run({DATA_DIR:dir,ADMIN_TOKEN:'adm'},3334);await sleep(900);
 check('share link survives restart',(await fetch('http://127.0.0.1:3334/s/'+id)).status===200);
 // 만료된 링크는 재시작 때 버려진다
 s.sv.kill();await sleep(600);const f=path.join(dir,'shares.json');const j=JSON.parse(fs.readFileSync(f,'utf8'));for(const k in j)j[k].exp=Date.now()-1000;fs.writeFileSync(f,JSON.stringify(j));
 s=run({DATA_DIR:dir,ADMIN_TOKEN:'adm'},3334);await sleep(900);check('expired share not restored',(await fetch('http://127.0.0.1:3334/s/'+id)).status===404);
 s.sv.kill();
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED '+res.filter(x=>!x).length);process.exit(0);
})();
