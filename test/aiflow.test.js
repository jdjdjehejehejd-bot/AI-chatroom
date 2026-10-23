const ROOT=require('path').resolve(__dirname,'..');
const {spawn}=require('child_process');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
(async()=>{
 const sv=spawn('node',[ROOT+'/server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:3106,ALLOW_DEV_PLAN:'1',DEMO_DELAY_MS:'30'}),stdio:'ignore'});
 await sleep(700);
 const cl=(name)=>new Promise(r=>{const ws=new WS('ws://127.0.0.1:3106/ws');const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',consent:true,room:'flow',name}));setTimeout(()=>r({ws,ev}),300)})});
 const A=await cl('Ben');const s=o=>A.ws.send(JSON.stringify(o));
 s({t:'plan',id:'plus'});await sleep(150);
 s({t:'config',policy:'free'});
 for(const n of ['가','나','다'])s({t:'addAI',name:n,persona:'테스터'});await sleep(400);
 let meta=()=>[...A.ev].reverse().find(e=>e.t==='meta');
 check('policy free applied',meta().policy==='free',meta().policy);
 s({t:'msg',text:'안녕 다들'});await sleep(2500);
 const ais=A.ev.filter(e=>e.t==='msg'&&e.msg.kind==='ai');
 check('some AIs spoke',ais.length>=1,ais.length);
 check('not every AI spoke every turn (PASS silently dropped)',!A.ev.some(e=>e.t==='msg'&&/PASS/i.test(e.msg.text)));
 // mute
 const na=meta().ais.find(a=>a.name==='나');
 s({t:'mute',aiId:na.id,muted:true});await sleep(250);
 check('mute flag in meta',meta().ais.find(a=>a.name==='나').muted===true);
 const before=A.ev.length;
 s({t:'msg',text:'@나 대답해'});await sleep(2500);
 const after=A.ev.slice(before);
 check('muted AI silent even when mentioned + notice',!after.some(e=>e.t==='msg'&&e.msg.kind==='ai'&&e.msg.who==='나')&&after.some(e=>e.t==='msg'&&e.msg.code==='AI_MUTED_SKIP'));
 s({t:'mute',aiId:na.id,muted:false});await sleep(200);
 // AI->AI DM peek: demo emits DM on 2nd AI turn
 for(let i=0;i<3;i++){s({t:'msg',text:'계속 이야기해 '+i});await sleep(2200);}
 const dmEv=A.ev.filter(e=>e.t==='aidms');
 check('AI↔AI DM broadcast to human (peek)',dmEv.length>0&&dmEv[dmEv.length-1].list[0].msgs.length>=1,JSON.stringify(dmEv.slice(-1)));
 check('DM line not shown publicly',!A.ev.some(e=>e.t==='msg'&&/\[DM @/.test(e.msg.text)));
 const B=await cl('Mia');const st=B.ev.find(e=>e.t==='state');
 check('late joiner state has aidms',Array.isArray(st.aidms)&&st.aidms.length>0);
 // non-owner... (no owner here) ; limits
 check('DM thread msgs capped',st.aidms.every(t=>t.msgs.length<=30));
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED');sv.kill();process.exit(0);
})();
