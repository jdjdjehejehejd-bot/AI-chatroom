const ROOT=require('path').resolve(__dirname,'..');
const http=require('http'),{spawn}=require('child_process'),WebSocket=require('ws');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ok=0,bad=0;const t=(n,c,d)=>{c?ok++:bad++;console.log((c?'PASS ':'FAIL ')+n+(c?'':' :: '+d))};
const mails=[],gists=[];let ghUserOK=true;
const mock=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
 const j=(c,o)=>{r.writeHead(c,{'content-type':'application/json'});r.end(JSON.stringify(o))};
 if(q.url==='/mail')return mails.push(JSON.parse(b)),j(200,{id:1});
 if(q.url==='/gh/token'){const x=JSON.parse(b);return j(200,x.code==='goodcode'?{access_token:'tok123'}:{error:'bad'})}
 if(q.url==='/gh/api/user')return q.headers.authorization==='Bearer tok123'?j(200,{id:4242,login:'octo',name:'Octo Cat',avatar_url:'https://a/b.png'}):j(401,{});
 if(q.url==='/gh/api/gists'){gists.push({auth:q.headers.authorization,body:JSON.parse(b)});return q.headers.authorization==='Bearer tok123'?j(201,{html_url:'https://gist.github.com/octo/abc'}):j(401,{})}
 j(404,{})})});
(async()=>{
 await new Promise(r=>mock.listen(4301,'127.0.0.1',r));
 const sv=spawn('node',['server.js'],{cwd:ROOT,env:Object.assign({},process.env,{PORT:'3303',SESSION_SECRET:'s3',DEMO_DELAY_MS:'20',GITHUB_CLIENT_ID:'ghid',GITHUB_CLIENT_SECRET:'ghsec',GITHUB_AUTH_URL:'http://127.0.0.1:4301/gh/authorize',GITHUB_TOKEN_URL:'http://127.0.0.1:4301/gh/token',GITHUB_API_URL:'http://127.0.0.1:4301/gh/api',RESEND_API_KEY:'rk',MAIL_FROM:'a@b.co',RESEND_URL:'http://127.0.0.1:4301/mail',PUBLIC_URL:'http://127.0.0.1:3303'}),stdio:'ignore'});
 await sleep(900);
 const B='http://127.0.0.1:3303';
 const post=(p,o,h={})=>fetch(B+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},h),body:JSON.stringify(o)});
 const cookies=r=>(r.headers.getSetCookie?r.headers.getSetCookie():[]).map(c=>c.split(';')[0]).filter(c=>!/=$/.test(c));
 const jar=cs=>cs.join('; ');
 try{
  const cfg=await (await fetch(B+'/auth/config')).json();t('config flags github+email',cfg.github===true&&cfg.email===true);
  // email
  t('bad email 400',(await post('/auth/email/start',{email:'nope'})).status===400);
  let r=await post('/auth/email/start',{email:'Ben@Example.com'});t('start ok',r.status===200);
  const code=(mails[0]&&mails[0].text.match(/\d{6}/)||[])[0];t('mail sent with 6-digit code to normalized address',!!code&&mails[0].to[0]==='ben@example.com');
  r=await post('/auth/email/verify',{email:'ben@example.com',code:code==='000000'?'111111':'000000'});t('wrong code 401',r.status===401);
  r=await post('/auth/email/verify',{email:'ben@example.com',code});const ec=cookies(r);t('right code logs in + HttpOnly cookie',r.status===200&&ec.length===1&&/HttpOnly/.test(r.headers.get('set-cookie')));
  r=await post('/auth/email/verify',{email:'ben@example.com',code});t('code single-use',r.status===401);
  let me=await (await fetch(B+'/auth/me',{headers:{cookie:jar(ec)}})).json();t('me provider email',me.user&&me.user.provider==='email'&&me.user.name==='ben');
  await post('/auth/email/start',{email:'x@example.com'});await post('/auth/email/start',{email:'x@example.com'});await post('/auth/email/start',{email:'x@example.com'});
  t('4th code request rate-limited',(await post('/auth/email/start',{email:'x@example.com'})).status===429);
  // brute force
  await post('/auth/email/start',{email:'y@example.com'});let last;for(let i=0;i<7;i++)last=await post('/auth/email/verify',{email:'y@example.com',code:'123456'});
  t('brute force locked',last.status===401||last.status===429);
  // github login
  r=await fetch(B+'/auth/github/start?r=//evil.com',{redirect:'manual'});let loc=r.headers.get('location')||'';
  t('start redirects to github with client_id/state, scope read:user',r.status===302&&loc.includes('client_id=ghid')&&loc.includes('scope=read%3Auser')&&!loc.includes('gist'),loc);
  const oc=cookies(r);const state=new URL(loc).searchParams.get('state');
  r=await fetch(B+'/auth/github/callback?code=goodcode&state=WRONG',{redirect:'manual',headers:{cookie:jar(oc)}});t('wrong state rejected',/autherr=/.test(r.headers.get('location')||''));
  r=await fetch(B+'/auth/github/callback?code=goodcode&state='+state,{redirect:'manual',headers:{cookie:jar(oc)}});
  const gc=cookies(r);t('callback ok -> redirect to safe path "/" (open redirect blocked)',r.status===302&&r.headers.get('location')==='/',r.headers.get('location'));
  me=await (await fetch(B+'/auth/me',{headers:{cookie:jar(gc.filter(c=>c.startsWith('aichat_session')))}})).json();
  t('github login session',me.user&&me.user.provider==='github'&&me.user.name==='Octo Cat'&&me.github===null,JSON.stringify(me));
  r=await fetch(B+'/auth/github/callback?code=badcode&state='+state,{redirect:'manual',headers:{cookie:jar(oc)}});t('bad code -> autherr',/autherr=/.test(r.headers.get('location')||''));
  // connect with existing email session
  r=await fetch(B+'/auth/github/start?mode=connect&r=/%3Froom=gist1',{redirect:'manual',headers:{cookie:jar(ec)}});loc=r.headers.get('location');const oc2=cookies(r),st2=new URL(loc).searchParams.get('state');
  t('connect asks gist scope',decodeURIComponent(loc.replace(/\+/g,' ')).includes('read:user gist'),loc);
  r=await fetch(B+'/auth/github/callback?code=goodcode&state='+st2,{redirect:'manual',headers:{cookie:jar(oc.length?[...ec,...oc2]:[...ec,...oc2])}});
  const cc=cookies(r);t('connect keeps email session, adds gh cookie',cc.some(c=>c.startsWith('aichat_gh'))&&!cc.some(c=>c.startsWith('aichat_session')),cc.map(c=>c.slice(0,14)));
  t('return path preserved',r.headers.get('location')==='/?room=gist1',r.headers.get('location'));
  const both=[...ec,...cc.filter(c=>c.startsWith('aichat_gh'))];
  me=await (await fetch(B+'/auth/me',{headers:{cookie:jar(both)}})).json();t('me shows email account + github login',me.user.provider==='email'&&me.github&&me.github.login==='octo');
  t('token never exposed to client',!JSON.stringify(me).includes('tok123')&&!cc.join(';').includes('tok123'));
  // gh cookie not valid for a different account
  me=await (await fetch(B+'/auth/me',{headers:{cookie:jar([...gc.filter(c=>c.startsWith('aichat_session')),...cc.filter(c=>c.startsWith('aichat_gh'))])}})).json();t('gh link bound to its account only',me.github===null);
  // login required to start
  const anonWs=new WebSocket('ws://127.0.0.1:3303/ws');const aev=[];anonWs.on('message',d=>aev.push(JSON.parse(d)));await new Promise(r=>anonWs.on('open',r));
  anonWs.send(JSON.stringify({t:'join',consent:true,room:'anonroom',name:'Eve'}));await sleep(300);
  t('anonymous join refused (LOGIN_REQUIRED)',aev.some(e=>e.t==='err'&&e.code==='LOGIN_REQUIRED')&&!aev.some(e=>e.t==='state'));
  t('config reports required',(await (await fetch(B+'/auth/config')).json()).required===true);
  // gist export
  const ws=new WebSocket('ws://127.0.0.1:3303/ws',{headers:{cookie:jar(both)}});const ev=[];ws.on('message',d=>ev.push(JSON.parse(d)));await new Promise(r=>ws.on('open',r));
  ws.send(JSON.stringify({t:'join',consent:true,room:'gist1',name:'Ben',mode:'code'}));await sleep(400);
  t('no deliverable yet -> 400',(await post('/gh/gist',{room:'gist1'},{cookie:jar(both)})).status===400);
  ws.send(JSON.stringify({t:'msg',text:'피보나치 함수'}));await sleep(3500);
  r=await post('/gh/gist',{room:'gist1'},{cookie:jar(both)});const gj=await r.json();
  t('gist created, url returned',r.status===200&&gj.url==='https://gist.github.com/octo/abc',JSON.stringify(gj));
  t('gist is secret + uses token server-side + named file',gists[0]&&gists[0].body.public===false&&gists[0].auth==='Bearer tok123'&&Object.keys(gists[0].body.files)[0].startsWith('deliverable.'),JSON.stringify(gists[0]));
  r=await post('/gh/gist',{room:'gist1',kind:'chat'},{cookie:jar(both)});t('chat transcript gist',r.status===200&&gists[1]&&gists[1].body.files['chat.md']);
  t('not connected -> 401',(await post('/gh/gist',{room:'gist1'},{cookie:jar(ec)})).status===401);
  t('cross-origin -> 403',(await post('/gh/gist',{room:'gist1'},{cookie:jar(both),origin:'https://evil.com'})).status===403);
  t('non-participant -> 403',(await post('/gh/gist',{room:'nosuchroom'},{cookie:jar(both)})).status===403);
  r=await post('/auth/github/disconnect',{});t('disconnect clears gh cookie',/aichat_gh=;/.test(r.headers.get('set-cookie')||'')||/Max-Age=0/.test(r.headers.get('set-cookie')||''));
  r=await post('/auth/logout',{});t('logout clears both',(r.headers.getSetCookie?r.headers.getSetCookie():[]).length===2);
 }catch(e){console.log('ERR',e);bad++}
 console.log(ok+' pass, '+bad+' fail');sv.kill();mock.close();process.exit(bad?1:0);
})();
