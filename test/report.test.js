const ROOT=require('path').resolve(__dirname,'..');
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aichat-'));
const start=()=>spawn('node',['server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:'3322',DATA_DIR:dir,DEMO_DELAY_MS:'20',SESSION_SECRET:'as',ADMIN_TOKEN:'adm',REQUIRE_LOGIN:'0'}),stdio:'ignore'});
const B='http://127.0.0.1:3322';
const cl=(room,name)=>new Promise(r=>{const ws=new WS('ws://127.0.0.1:3322/ws');const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',room,name,consent:true}));setTimeout(()=>r({ws,ev,s:o=>ws.send(JSON.stringify(o))}),400)})});
const evs=async()=>(await (await fetch(B+'/admin/events',{headers:{authorization:'Bearer adm'}})).json()).events;
const sum=(e,k)=>Object.values(e).reduce((a,d)=>a+(d[k]||0),0);
(async()=>{
 let sv=start();await sleep(900);
 const A=await cl('pk1','Ann');
 A.s({t:'mode',id:'make'});await sleep(400);
 A.s({t:'msg',text:'웹페이지 만들어줘'});await sleep(2500);
 let d=A.ev.filter(e=>e.t==='deliv'&&e.deliv);
 check('deliverable v1 saved with hist',d.length>=1&&d[d.length-1].hist.length>=1,JSON.stringify(d.map(x=>x.hist&&x.hist.length)));
 const rc=A.ev.filter(e=>e.t==='msg'&&e.msg.code==='RUN_RECEIPT');
 check('run receipt system message',rc.length===1&&/이번 실행: AI 호출 \d+회 · 남은 예산 \d+회/.test(rc[0].msg.text),JSON.stringify(rc));
 A.s({t:'msg',text:'한 번 더'});await sleep(2500);
 const last=A.ev.filter(e=>e.t==='deliv'&&e.deliv).pop();
 check('v2 and hist grows',last.deliv.v>=2&&last.hist.length>=2,JSON.stringify(last.hist));
 A.s({t:'delver',v:1});await sleep(250);
 const dv=A.ev.find(e=>e.t==='delver');
 check('old version text retrievable',dv&&dv.item.v===1&&dv.item.text.length>0);
 A.s({t:'delver',v:99});await sleep(150);
 check('unknown version ignored',A.ev.filter(e=>e.t==='delver').length===1);
 const top=last.deliv.v;
 A.s({t:'delrestore',v:1});await sleep(300);
 const rs=A.ev.filter(e=>e.t==='deliv'&&e.deliv).pop();
 check('restore creates new version from v1',rs.deliv.v===top+1&&rs.deliv.from===1&&rs.deliv.text===dv.item.text,JSON.stringify(rs.hist));
 check('restore announced',A.ev.some(e=>e.t==='msg'&&e.msg.code==='DELIV_RESTORED'));
 const B2=await cl('pk1','Bob');
 const st=B2.ev.find(e=>e.t==='state');check('late joiner gets hist',st&&st.dhist&&st.dhist.length>=3,JSON.stringify(st&&st.dhist));
 // hist capped at 8
 for(let i=0;i<7;i++){A.s({t:'delrestore',v:rs.hist[rs.hist.length-1].v});await sleep(1500)}
 const cap=A.ev.filter(e=>e.t==='deliv'&&e.deliv).pop();check('hist capped at 8',cap.hist.length===8,cap.hist.length);
 // events
 check('admin events needs token',(await fetch(B+'/admin/events')).status===401);
 let e=await evs();
 check('counts',sum(e,'room_created')===1&&sum(e,'mode_applied')===1&&sum(e,'run_started')>=2&&sum(e,'run_completed')>=2&&sum(e,'deliverable_saved')>=2&&sum(e,'deliverable_restored')>=8,JSON.stringify(e));
 const raw=JSON.stringify(e);check('events hold no room/user/content',!/pk1|Ann|Bob|웹페이지/.test(raw),raw);
 // persistence
 A.ws.close();B2.ws.close();await sleep(300);sv.kill();await sleep(600);
 sv=start();await sleep(900);
 e=await evs();check('events persisted across restart',sum(e,'room_created')===1,JSON.stringify(e));
 const C=await cl('pk1','Cy');const s2=C.ev.find(x=>x.t==='state');check('hist persisted across restart',s2&&s2.dhist.length===8&&s2.deliv.v===cap.deliv.v,JSON.stringify(s2&&s2.dhist.length));
 sv.kill();
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED '+res.filter(x=>!x).length);process.exit(0);
})();
