const http=require('http'),{spawn}=require('child_process'),fs=require('fs');
const gists=[];
const mock=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
 const j=(c,o)=>{r.writeHead(c,{'content-type':'application/json'});r.end(JSON.stringify(o))};
 const u=new URL(q.url,'http://x');
 if(u.pathname==='/gh/authorize'){r.writeHead(302,{location:u.searchParams.get('redirect_uri')+'?code=goodcode&state='+u.searchParams.get('state')});return r.end()}
 if(u.pathname==='/gh/token')return j(200,{access_token:'tok123'});
 if(u.pathname==='/gh/api/user')return j(200,{id:77,login:'octo',name:'Octo',avatar_url:'https://a/b.png'});
 if(u.pathname==='/gh/api/gists'){gists.push(JSON.parse(b));return j(201,{html_url:'https://gist.github.com/octo/zzz'})}
 j(404,{})})}).listen(4302,'127.0.0.1');
const out=fs.openSync('auth_ui_server.log','w');
spawn('node',['server.js'],{cwd:require('path').resolve(__dirname,'../..'),stdio:['ignore',out,out],env:Object.assign({},process.env,{PORT:'3304',SESSION_SECRET:'s4',DEMO_DELAY_MS:'30',EMAIL_DEV_LOG:'1',GITHUB_CLIENT_ID:'ghid',GITHUB_CLIENT_SECRET:'ghsec',GITHUB_AUTH_URL:'http://127.0.0.1:4302/gh/authorize',GITHUB_TOKEN_URL:'http://127.0.0.1:4302/gh/token',GITHUB_API_URL:'http://127.0.0.1:4302/gh/api',PUBLIC_URL:'http://127.0.0.1:3304'})});
