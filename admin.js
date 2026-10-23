/* 운영자용 신고 처리 화면. 토큰은 이 탭의 sessionStorage에만 두고, 서버는 매 요청마다 ADMIN_TOKEN을 검사한다. */
module.exports = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>운영자 · 신고 처리</title>
<style>:root{--bg:#f5f6f8;--fg:#0f172a;--mut:#64748b;--card:#fff;--line:#e2e6ec;--acc:#4f46e5;--err:#b42318}
@media(prefers-color-scheme:dark){:root{--bg:#0b0d12;--fg:#e7eaf0;--mut:#8b93a5;--card:#12151c;--line:#242a38;--acc:#818cf8;--err:#ffb4ab}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 system-ui,"Noto Sans KR",sans-serif}main{max-width:760px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:20px}input,button,select{font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg)}button{cursor:pointer}button.p{background:var(--acc);border-color:var(--acc);color:#fff}
.r{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}.m{color:var(--mut);font-size:12.5px}.t{white-space:pre-wrap;margin:6px 0;padding:8px;border-radius:8px;background:var(--bg)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}</style></head><body><main>
<h1>신고 처리</h1>
<div class="row"><input id="tok" type="password" placeholder="ADMIN_TOKEN" autocomplete="off" style="flex:1;min-width:200px"><select id="st"><option value="open">처리 대기</option><option value="all">전체</option></select><button class="p" id="go">불러오기</button></div>
<p class="m" id="msg"></p><div id="list"></div>
<h2 style="font-size:16px;margin-top:28px">사용 집계 <span class="m">(날짜별 횟수만 기록, 방·사용자·대화 내용 없음)</span></h2><button id="evgo">집계 보기</button><div id="ev" style="overflow-x:auto;margin-top:8px"></div></main>
<script>
var $=function(i){return document.getElementById(i)};try{$("tok").value=sessionStorage.getItem("adm")||""}catch(e){}
function api(p,o){o=o||{};o.headers=Object.assign({authorization:"Bearer "+$("tok").value,"content-type":"application/json"},o.headers||{});return fetch(p,o)}
function load(){try{sessionStorage.setItem("adm",$("tok").value)}catch(e){}
 api("/admin/reports?status="+$("st").value).then(function(r){if(r.status===401){$("msg").textContent="토큰이 올바르지 않습니다.";$("list").textContent="";return null}return r.json()}).then(function(j){if(!j)return;
  $("msg").textContent=j.reports.length+"건";var box=$("list");box.textContent="";
  j.reports.forEach(function(x){var d=document.createElement("div");d.className="r";
   var m=document.createElement("div");m.className="m";m.textContent=new Date(x.ts).toLocaleString()+" · 방 "+(x.roomId||x.room||"?")+" · 사유 "+x.reason+" · "+x.kind+" · 상태 "+x.status;d.appendChild(m);
   var t=document.createElement("div");t.className="t";t.textContent=(x.who||"")+(x.aiId?" (AI)":"")+": "+(x.text||"");d.appendChild(t);
   if(x.note){var n=document.createElement("div");n.className="m";n.textContent="신고자 메모: "+x.note;d.appendChild(n)}
   if(x.status==="open"){var row=document.createElement("div");row.className="row";[["resolved","조치 완료"],["dismissed","기각"]].forEach(function(s){var b=document.createElement("button");b.textContent=s[1];b.onclick=function(){api("/admin/reports/resolve",{method:"POST",body:JSON.stringify({id:x.id,status:s[0]})}).then(load)};row.appendChild(b)});d.appendChild(row)}
   box.appendChild(d)})})}
$("evgo").onclick=function(){api("/admin/events").then(function(r){if(r.status===401){$("msg").textContent="토큰이 올바르지 않습니다.";return null}return r.json()}).then(function(j){if(!j)return;var days=Object.keys(j.events).sort().reverse().slice(0,14),names={};days.forEach(function(d){Object.keys(j.events[d]).forEach(function(k){names[k]=1})});var cols=Object.keys(names).sort(),t=document.createElement("table");t.style.cssText="border-collapse:collapse;font-size:12.5px";var h=t.insertRow();["날짜"].concat(cols).forEach(function(c){var th=document.createElement("th");th.textContent=c;th.style.cssText="text-align:left;padding:4px 8px;border-bottom:1px solid var(--line)";h.appendChild(th)});days.forEach(function(d){var r=t.insertRow();[d].concat(cols.map(function(c){return j.events[d][c]||0})).forEach(function(v){var td=r.insertCell();td.textContent=v;td.style.cssText="padding:4px 8px;border-bottom:1px solid var(--line)"})});$("ev").textContent="";$("ev").appendChild(t)})};
$("go").onclick=load;$("st").onchange=load;if($("tok").value)load();
</script></body></html>`;
