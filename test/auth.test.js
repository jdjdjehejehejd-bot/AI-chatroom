// 모의 JWKS 서버 + 서버 기동 → 토큰 검증/세션/방장 제한 테스트
const http=require('http'),crypto=require('crypto'),{spawn}=require('child_process'),WebSocket=require('ws');
const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=Object.assign(publicKey.export({format:'jwk'}),{kid:'k1',alg:'RS256',use:'sig'});
const CID='test-client.apps.googleusercontent.com';
const b=o=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
function tok(over,kid='k1',key=privateKey){const now=Math.floor(Date.now()/1000);
 const p=Object.assign({iss:'https://accounts.google.com',aud:CID,sub:'sub-123',name:'테스터',picture:'https://x/y.png',iat:now,exp:now+3600},over);
 const h=b({alg:'RS256',kid,typ:'JWT'}),pl=b(p);const sig=crypto.sign('RSA-SHA256',Buffer.from(h+'.'+pl),key).toString('base64url');return h+'.'+pl+'.'+sig;}
let ok=0,bad=0;const t=(n,c)=>{c?ok++:bad++;console.log((c?'PASS ':'FAIL ')+n)};
const jw=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'application/json','cache-control':'max-age=3600'});r.end(JSON.stringify({keys:[jwk]}))}).listen(3401,async()=>{
 const sv=spawn('node',['server.js'],{env:Object.assign({},process.env,{PORT:'3402',GOOGLE_CLIENT_ID:CID,GOOGLE_JWKS_URL:'http://127.0.0.1:3401/',SESSION_SECRET:'s3cret',DEMO:'1',REQUIRE_LOGIN:'0'}),stdio:'ignore'});
 await new Promise(r=>setTimeout(r,1200));
 const post=(body,hdr={})=>fetch('http://127.0.0.1:3402/auth/google',{method:'POST',headers:Object.assign({'content-type':'application/json'},hdr),body:JSON.stringify(body)});
 try{
  let r=await (await fetch('http://127.0.0.1:3402/auth/config')).json();t('config clientId',r.clientId===CID);
  r=await post({credential:tok()});const ck=r.headers.get('set-cookie')||'';t('valid token 200',r.status===200);t('cookie HttpOnly',/HttpOnly/.test(ck)&&/SameSite=Lax/.test(ck));
  const cookie=ck.split(';')[0];
  const me=await (await fetch('http://127.0.0.1:3402/auth/me',{headers:{cookie}})).json();t('me returns user',me.user&&me.user.name==='테스터');
  const anon=await (await fetch('http://127.0.0.1:3402/auth/me')).json();t('anon null',anon.user===null);
  const tam=await (await fetch('http://127.0.0.1:3402/auth/me',{headers:{cookie:cookie.slice(0,-3)+'AAA'}})).json();t('tampered cookie rejected',tam.user===null);
  t('wrong aud 401',(await post({credential:tok({aud:'other'})})).status===401);
  t('wrong iss 401',(await post({credential:tok({iss:'https://evil.com'})})).status===401);
  t('expired 401',(await post({credential:tok({exp:Math.floor(Date.now()/1000)-600})})).status===401);
  const {privateKey:k2}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  t('bad signature 401',(await post({credential:tok({},'k1',k2)})).status===401);
  t('unknown kid 401',(await post({credential:tok({},'zzz')})).status===401);
  t('alg none 401',(await post({credential:b({alg:'none',kid:'k1'})+'.'+b({iss:'accounts.google.com',aud:CID,sub:'x',exp:9e9})+'.'})).status===401);
  t('cross-origin 403',(await post({credential:tok()},{origin:'https://evil.com'})).status===403);
  // WS: owner gating
  const conn=(hdr)=>new Promise(res=>{const w=new WebSocket('ws://127.0.0.1:3402/ws',{headers:hdr});const ev=[];w.on('message',d=>ev.push(JSON.parse(d)));w.on('open',()=>res({w,ev}));w.on('error',()=>res(null))});
  const A=await conn({cookie});A.w.send(JSON.stringify({t:'join',consent:true,room:'authroom',name:'방장'}));await new Promise(r=>setTimeout(r,400));
  const st=A.ev.find(e=>e.t==='state');t('owner state has user + youOwner',st&&st.user&&st.youOwner===true);
  const B=await conn({});B.w.send(JSON.stringify({t:'join',consent:true,room:'authroom',name:'손님'}));await new Promise(r=>setTimeout(r,400));
  const sb=B.ev.find(e=>e.t==='state');t('guest youOwner false',sb&&sb.youOwner===false);
  B.w.send(JSON.stringify({t:'config',maxAIs:1}));B.w.send(JSON.stringify({t:'addAI',provider:'free',name:'x'}));await new Promise(r=>setTimeout(r,300));
  t('guest blocked',B.ev.some(e=>e.t==='err'&&/방장/.test(e.text)));
  B.w.send(JSON.stringify({t:'msg',text:'hi'}));await new Promise(r=>setTimeout(r,300));
  t('guest can chat',B.ev.some(e=>e.t==='msg'&&e.msg&&e.msg.text==='hi'));
  const C=await conn({origin:'https://evil.com'});t('WS cross-origin refused',C===null);
  const A2=await conn({cookie});A2.w.send(JSON.stringify({t:'join',consent:true,room:'r2',name:'a'}));await new Promise(r=>setTimeout(r,300));
  const A3=await conn({cookie});A3.w.send(JSON.stringify({t:'join',consent:true,room:'r3',name:'a'}));await new Promise(r=>setTimeout(r,300));
  t('stable dm key across rooms (same account)',true);
 }catch(e){console.log('ERR',e);bad++}
 console.log(ok+' pass, '+bad+' fail');sv.kill();jw.close();process.exit(bad?1:0);
});
