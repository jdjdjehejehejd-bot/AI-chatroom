const fs=require('fs');
const root=__dirname+'/../';
const server=fs.readFileSync(root+'server.js','utf8').replace(/^#!.*\n/,'');
let html=fs.readFileSync(root+'public/index.html','utf8');
const i18n=fs.readFileSync(root+'public/i18n.js','utf8').replace(/<\/script/gi,'<\\/script');
html=html.replace('<script src="/i18n.js"></script>',()=>'<script>'+i18n+'</script>');
const shim=`<script>
/* 미리보기: 실제 server.js를 브라우저 안에서 그대로 돌리고 WebSocket만 가짜로 연결한다. 데모 응답만 사용, 네트워크 호출 없음. */
(function(){
  var handlers=null;
  var process={env:{ALLOW_DEV_PLAN:'1',DEMO_DELAY_MS:'650'},on:function(){}};
  var console2=console;
  function fakeRequire(n){
    if(n==='http')return{createServer:function(){return{listen:function(){},on:function(){}}}};
    if(n==='fs')return{readFile:function(){},readFileSync:function(){return''},existsSync:function(){return false}};
    if(n==='./store')return{createStore:function(){return{enabled:false,read:function(){return null},write:function(){},remove:function(){},list:function(){return[]}}}};
    if(n==='./legal')return{TERMS_VERSION:'preview',privacy:function(){return''},terms:function(){return''},deleteAccount:function(){return''}};
    if(n==='./admin')return'';
    if(n==='./legal-text')return{};
    if(n==='path')return{join:function(){return[].slice.call(arguments).join('/')},resolve:function(){return''},extname:function(){return''}};
    if(n==='crypto')return{randomBytes:function(k){var h='';for(var i=0;i<k*2;i++)h+='0123456789abcdef'[Math.floor(Math.random()*16)];return{toString:function(){return h}}}};
    if(n==='ws')return{WebSocketServer:function(){return{on:function(ev,fn){if(ev==='connection')handlers=fn}}}};
    return{};
  }
  var module={exports:{}},require=fakeRequire,__dirname='',Buffer=window.Buffer;
  var console={log:function(){},error:function(){},warn:function(){}};
  try{
  (function(process,require,module,__dirname,console){
${server.replace(/<\/script/gi,'<\\/script')}
  })(process,require,module,__dirname,console);
  }catch(e){console2.error('preview server failed',e)}
  function FakeWS(){
    var self=this,sh={};this.readyState=0;
    var sock={readyState:1,hits:[],meta:null,
      send:function(d){setTimeout(function(){if(self.onmessage)self.onmessage({data:d})},0)},
      on:function(ev,fn){sh[ev]=fn},close:function(){},terminate:function(){},ping:function(){}};
    this._sh=sh;this._sock=sock;
    setTimeout(function(){handlers(sock);self.readyState=1;if(self.onopen)self.onopen()},20);
  }
  FakeWS.prototype.send=function(d){var s=this;setTimeout(function(){if(s._sh.message)s._sh.message(d)},0)};
  FakeWS.prototype.close=function(){this.readyState=3;this._sock.readyState=3;if(this._sh.close)this._sh.close();if(this.onclose)this.onclose()};
  window.WebSocket=FakeWS;
})();
</script>`;
// 클라이언트 스크립트 앞에 shim 삽입
const idx=html.indexOf('<script>\n(function () {');
if(idx<0)throw new Error('client script marker');
html=html.slice(0,idx)+shim+'\n'+html.slice(idx);
// 샌드박스 대응: root padding 제거 (앱 셸이 직접 safe-area 처리)
html=html.replace('</style>',':root{padding:0 !important}\n</style>');
// 배너
html=html.replace('<div id="toast"','<div id="toast"');
fs.writeFileSync(process.argv[2],html);
console.log('ok',html.length);
