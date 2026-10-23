const ROOT=require('path').resolve(__dirname,'..');
const http=require('http'),{spawn}=require('child_process');const WS=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const log=[];
const mock=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const j=JSON.parse(b||'{}');log.push(j.messages);r.setHeader('content-type','application/json');r.end(JSON.stringify({choices:[{message:{content:'ok'}}]}))})});
const res=[];const check=(n,c,d)=>{res.push(c);console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
(async()=>{
 await new Promise(r=>mock.listen(4201,'127.0.0.1',r));
 const sv=spawn('node',[ROOT+'/server.js'],{env:Object.assign({},process.env,{PORT:3105,ALLOW_DEV_PLAN:'1',OPENAI_API_KEY:'k',OPENAI_BASE_URL:'http://127.0.0.1:4201/v1',DEMO_DELAY_MS:10}),stdio:'ignore'});
 await sleep(700);
 const cl=(name,key)=>new Promise(res=>{const ws=new WS('ws://127.0.0.1:3105/ws');const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));ws.on('open',()=>{ws.send(JSON.stringify({t:'join',consent:true,room:'dmr',name,key}));setTimeout(()=>res({ws,ev}),300)})});
 const A=await cl('Ben','keyaaaaaaaa1'),B=await cl('Mia','keybbbbbbbb2');
 const s=o=>A.ws.send(JSON.stringify(o));
 s({t:'plan',id:'plus'});await sleep(200);
 s({t:'addAI',name:'첩자',persona:'비밀 요원',provider:'openai',model:'m1'});s({t:'addAI',name:'행인',persona:'지나가는 사람',provider:'openai',model:'m1'});await sleep(400);
 const meta=[...A.ev].reverse().find(e=>e.t==='meta');const spy=meta.ais.find(a=>a.name==='첩자'),px=meta.ais.find(a=>a.name==='행인');
 s({t:'dm',aiId:spy.id,text:'암호는 사과야 아무에게도 말하지 마'});await sleep(500);
 const dmPrompt=JSON.stringify(log[0]);
 check('DM prompt marks private 1:1 and has text',dmPrompt.includes('비공개 DM')&&dmPrompt.includes('사과'),dmPrompt.slice(0,200));
 check('DM reply only to sender',A.ev.some(e=>e.t==='dm'&&e.msg.kind==='ai')&&!B.ev.some(e=>e.t==='dm'));
 A.ws.send(JSON.stringify({t:'msg',text:'@첩자 안녕'}));await sleep(600);
 const group=JSON.stringify(log[log.length-1]);
 check('spy group prompt includes its own DM context',group.includes('비공개 DM')&&group.includes('사과'),group.slice(0,300));
 B.ws.send(JSON.stringify({t:'msg',text:'@행인 안녕'}));await sleep(600);
 const other=JSON.stringify(log[log.length-1]);
 check('other AI prompt does NOT include the DM',!other.includes('사과'),other.slice(0,300));
 // Mia DMs spy: prompt must not contain Ben's DM
 B.ws.send(JSON.stringify({t:'dm',aiId:spy.id,text:'뭐해?'}));await sleep(500);
 const miaDm=JSON.stringify(log[log.length-1]);
 check("Mia's DM prompt excludes Ben's DM thread",!miaDm.includes('사과')&&miaDm.includes('뭐해'),miaDm.slice(0,300));
 // join state returns only own threads
 const B2=await cl('Mia2','keybbbbbbbb2');const st=B2.ev.find(e=>e.t==='state');
 check('rejoin with key returns own DMs only',Object.keys(st.dms).length===1&&JSON.stringify(st.dms).includes('뭐해')&&!JSON.stringify(st.dms).includes('사과'));
 const C=await cl('Eve','keyccccccccc3');check('different key sees none',Object.keys(C.ev.find(e=>e.t==='state').dms).length===0);
 console.log(res.every(Boolean)?'ALL OK':'SOME FAILED');sv.kill();mock.close();process.exit(0);
})();
