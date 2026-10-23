/* 개인정보처리방침, 이용약관, 계정 삭제 안내 페이지. 운영자 정보는 환경변수로 넣는다 */
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OPERATOR = () => process.env.OPERATOR_NAME || '[운영자 이름을 OPERATOR_NAME에 설정하세요]';
const CONTACT = () => process.env.CONTACT_EMAIL || '[문의 이메일을 CONTACT_EMAIL에 설정하세요]';
const VERSION = '2026-10-23';

const CSS = ':root{--bg:#f5f6f8;--fg:#0f172a;--mut:#64748b;--card:#fff;--line:#e2e6ec;--acc:#4f46e5}@media(prefers-color-scheme:dark){:root{--bg:#0b0d12;--fg:#e7eaf0;--mut:#8b93a5;--card:#12151c;--line:#242a38;--acc:#818cf8}}' +
  'body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.75 "Inter","Noto Sans KR",system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px}' +
  'h1{font-size:26px;margin:0 0 6px}h2{font-size:17px;margin:30px 0 8px}p,li{color:var(--fg)}.mut{color:var(--mut);font-size:13px}table{border-collapse:collapse;width:100%;font-size:13.5px;display:block;overflow-x:auto}th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}th{background:var(--card)}' +
  'a{color:var(--acc)}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0}button{font:inherit;border-radius:10px;border:1px solid var(--line);padding:9px 16px;background:var(--card);color:var(--fg);cursor:pointer}button.danger{background:#b42318;color:#fff;border-color:#b42318}input{font:inherit;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg)}nav a{margin-right:14px;font-size:13px}';

function shell(title, body, script) {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body><main>' +
    '<nav><a href="/">← 앱으로</a><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a><a href="/delete-account">계정·데이터 삭제</a></nav>' + body + (script ? '<script>' + script + '</script>' : '') + '</main></body></html>';
}

function privacy() {
  return shell('개인정보처리방침', `<h1>개인정보처리방침</h1><p class="mut">시행일 ${VERSION} · 운영자 ${esc(OPERATOR())}</p>
<p>이 서비스(“AI 채팅방”)는 사람과 여러 AI가 함께 대화하는 채팅 서비스입니다. 운영자는 이용자의 개인정보를 아래와 같이 처리합니다.</p>
<h2>1. 수집하는 항목과 방법</h2>
<table><tr><th>구분</th><th>항목</th><th>수집 방법</th></tr>
<tr><td>Google 로그인</td><td>계정 고유 ID, 이름, 프로필 이미지 주소 (이메일 주소는 저장하지 않습니다)</td><td>로그인 시 Google에서 전달</td></tr>
<tr><td>GitHub 로그인·연동</td><td>계정 고유 번호, 사용자 이름, 프로필 이미지 주소. 연동 시 Gist 작성 권한의 액세스 토큰(서버 데이터베이스에는 저장하지 않고 암호화한 쿠키에만 보관)</td><td>로그인·연동 시 GitHub에서 전달</td></tr>
<tr><td>이메일 로그인</td><td>이메일 주소. 인증 코드를 보낼 때만 사용하고, 계정 식별자로는 주소의 해시값만 저장합니다(코드 확인 전까지 주소는 서버 메모리에 임시 보관).</td><td>이용자 입력</td></tr>
<tr><td>서비스 이용</td><td>대화 내용(단체방, AI와의 귓속말, AI끼리의 쪽지), 공유 문서·산출물·방 설정, 마켓에 올린 에셋, 일일 AI 호출 횟수, 신고·차단 기록, 약관 동의 시각</td><td>이용 과정에서 생성</td></tr>
<tr><td>접속 정보</td><td>접속 IP는 과도한 요청을 막기 위해 메모리에서 일시적으로만 처리하며 저장하지 않습니다.</td><td>자동</td></tr>
<tr><td>쿠키·브라우저 저장소</td><td>로그인 유지 쿠키(30일), GitHub 연동 쿠키(암호화), 로그인 절차용 임시 쿠키(10분), 닉네임·최근 방 목록·귓속말 식별 키(브라우저 localStorage)</td><td>자동</td></tr>
<tr><td>개인 API 키</td><td>이용자가 AI 제공사 키를 직접 입력한 경우 서버 메모리에서만 사용하며 파일이나 데이터베이스에 저장하지 않습니다(서버를 재시작하면 사라집니다).</td><td>이용자 입력</td></tr></table>
<h2>2. 이용 목적</h2>
<p>로그인과 본인 확인, 대화방 제공과 AI 응답 생성, 방·산출물 보관, 이용 한도(일일 호출 수) 관리, 부정 이용 방지, 신고 처리와 이용자 보호, 고객 문의 응대.</p>
<h2>3. 보유 및 이용 기간</h2>
<ul><li>대화방 데이터: 마지막 활동 후 무료 방 7일, 플러스 방 365일이 지나면 삭제합니다. 이용자가 직접 삭제를 요청하면 즉시 삭제합니다.</li>
<li>계정 정보: 계정 삭제(탈퇴) 시 지체 없이 삭제합니다.</li>
<li>신고 기록: 안전 확보를 위해 접수 후 180일 보관한 뒤 삭제합니다.</li>
<li>법령에 따라 보존해야 하는 정보는 해당 기간 동안 보관합니다.</li></ul>
<h2>4. 제3자 제공과 처리 위탁 (국외 이전 포함)</h2>
<p><b>대화방에서 사람이 쓴 글은 같은 방의 다른 참가자와 AI에게 전달됩니다.</b> AI가 답하려면 최근 대화, 공유 문서, 방 기억, 해당 AI가 받은 귓속말이 AI 제공사의 서버로 전송됩니다. 주민등록번호, 금융정보, 건강정보 등 민감한 정보는 입력하지 마세요.</p>
<table><tr><th>받는 자</th><th>목적·항목</th><th>비고</th></tr>
<tr><td>AI 제공사 (서버 설정에 따라 OpenAI, Anthropic, Google, Groq, Mistral, NVIDIA, OpenRouter 등 중 일부)</td><td>AI 응답 생성을 위한 대화 내용</td><td>이용자가 개인 키를 입력한 AI는 해당 제공사로 전송됩니다. 대부분 국외(미국 등) 서버입니다.</td></tr>
<tr><td>Google, GitHub</td><td>로그인·연동</td><td>국외</td></tr>
<tr><td>이메일 발송 업체(설정 시 Resend)</td><td>인증 코드 발송을 위한 이메일 주소</td><td>국외</td></tr>
<tr><td>클라우드 호스팅 사업자</td><td>서버 운영과 데이터 저장</td><td>운영 환경에 따라 다름</td></tr></table>
<p class="mut">위 업체 중 실제로 사용하지 않는 곳은 해당되지 않습니다. 법령에 따른 요구가 있는 경우를 제외하고 이용자 동의 없이 그 밖의 제3자에게 제공하지 않습니다.</p>
<h2>5. 이용자의 권리와 행사 방법</h2>
<ul><li><b>열람·내려받기</b>: 앱 설정 → 계정 → “내 데이터 내려받기”</li>
<li><b>삭제</b>: 앱 설정 → 계정 → “계정 삭제” 또는 <a href="/delete-account">계정·데이터 삭제 페이지</a>. 내가 만든 방과 마켓 에셋, 귓속말 기록이 삭제되고, 다른 사람 방에 남긴 내 메시지는 “[삭제된 메시지]”로 바뀝니다.</li>
<li><b>신고·차단</b>: 메시지의 ⋯ 메뉴에서 신고하거나 사용자를 차단할 수 있습니다.</li>
<li>그 밖의 요청과 동의 철회는 아래 문의처로 연락하세요.</li></ul>
<h2>6. 파기 절차와 방법</h2>
<p>보유 기간이 지났거나 삭제를 요청받은 정보는 저장소에서 삭제합니다. 백업이 있는 경우 백업 보관 주기(운영자 설정)가 지나면 함께 파기됩니다.</p>
<h2>7. 안전성 확보 조치</h2>
<p>전송 구간 암호화(HTTPS), 서명된 HttpOnly 로그인 쿠키, GitHub 토큰 암호화, 접근 권한 최소화, 개인 API 키 미저장, 요청 횟수 제한.</p>
<h2>8. 아동의 개인정보</h2>
<p>이 서비스는 만 14세 미만 아동의 가입과 이용을 받지 않습니다. 만 14세 미만임을 알게 되면 해당 계정과 정보를 삭제합니다.</p>
<h2>9. 문의처</h2>
<p>개인정보 보호 담당: ${esc(OPERATOR())} · 이메일 ${esc(CONTACT())}</p>
<h2>10. 변경 고지</h2>
<p>이 방침이 바뀌면 시행 7일 전에 서비스 화면에 알립니다. 이용자에게 불리한 변경은 30일 전에 알립니다.</p>`);
}

function terms() {
  return shell('이용약관', `<h1>이용약관</h1><p class="mut">시행일 ${VERSION} · 운영자 ${esc(OPERATOR())}</p>
<h2>1. 서비스</h2><p>사람과 여러 AI가 한 방에서 대화하고, 코드·아이디어·문서 같은 결과물을 함께 만드는 서비스입니다. 일부 기능은 로그인과 플랜(무료/플러스)에 따라 제한됩니다.</p>
<h2>2. 계정</h2><p>Google, GitHub, 이메일 코드로 로그인합니다. 만 14세 미만은 이용할 수 없습니다. 계정은 본인이 관리해야 하며 타인에게 양도할 수 없습니다.</p>
<h2>3. AI가 만든 내용에 대한 안내</h2><ul><li>AI의 답변은 부정확하거나 편향될 수 있고 사실과 다를 수 있습니다. 의료·법률·금융 등 중요한 판단의 근거로 쓰지 마세요.</li><li>AI의 답변이 부적절하다면 해당 메시지의 ⋯ 메뉴에서 신고하세요.</li><li>대화 내용은 AI 응답을 만들기 위해 AI 제공사로 전송됩니다(개인정보처리방침 참고).</li></ul>
<h2>4. 금지 행위</h2><ul><li>불법 정보, 아동·청소년 성적 콘텐츠, 혐오·차별·폭력 조장, 괴롭힘과 협박</li><li>타인의 개인정보 노출, 사칭, 스팸과 광고성 도배</li><li>악성코드 제작 요청, 서비스 보안·한도 우회, 다른 AI의 규칙을 덮어쓰려는 프롬프트 주입, 서비스 장애를 일으키는 행위</li><li>마켓에 타인의 저작물이나 위 항목에 해당하는 내용을 게시하는 행위</li></ul>
<h2>5. 신고와 조치</h2><p>누구나 메시지를 신고하고 사용자를 차단할 수 있으며, 방장은 참가자를 내보낼 수 있습니다. 운영자는 신고를 검토해 경고, 콘텐츠 숨김·삭제, 마켓 게시 중단, 이용 제한 등의 조치를 할 수 있습니다.</p>
<h2>6. 이용자 콘텐츠</h2><p>이용자가 쓴 글과 만든 결과물의 권리는 이용자에게 있습니다. 서비스 제공(저장, 같은 방 참가자와 AI에 전달, 마켓 게시물 표시)에 필요한 범위에서만 이용할 수 있도록 허락하는 것으로 봅니다. 공유 링크로 공개한 내용은 링크를 아는 누구나 볼 수 있습니다.</p>
<h2>7. 요금과 크레딧</h2><p>무료 플랜과 플러스 플랜의 한도(방 예산, 일일 AI 호출 수, 보관 기간 등)는 서비스 화면에 표시된 대로 적용됩니다. 유료 결제는 준비 중이며 시작 시 별도로 안내합니다.</p>
<h2>8. 서비스 변경과 중단</h2><p>운영자는 서비스를 개선하거나 일부를 변경·중단할 수 있으며, 중요한 변경은 미리 알립니다. 무료 방은 보관 기간이 지나면 삭제됩니다.</p>
<h2>9. 책임의 제한</h2><p>운영자는 천재지변, 외부 AI·로그인 제공사의 장애 등 통제할 수 없는 사유로 인한 서비스 중단과 AI 답변의 정확성에 대해 법령이 허용하는 범위에서 책임을 지지 않습니다.</p>
<h2>10. 문의</h2><p>${esc(OPERATOR())} · ${esc(CONTACT())}</p>`);
}

function deleteAccount() {
  const script = `
var $=function(i){return document.getElementById(i)};
fetch('/auth/me').then(function(r){return r.json()}).then(function(me){
  if(me.user){$('who').textContent=me.user.name+' 님으로 로그인되어 있습니다.';$('yes').hidden=false}else{$('no').hidden=false}
});
$('go').addEventListener('click',function(){
  $('msg').textContent='';
  fetch('/auth/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirm:$('cf').value})}).then(function(r){return r.json()}).then(function(j){
    if(j.ok){$('yes').hidden=true;$('done').hidden=false}else{$('msg').textContent=j.error||'삭제하지 못했습니다.'}
  }).catch(function(){$('msg').textContent='삭제하지 못했습니다.'});
});
$('exp').addEventListener('click',function(){location.href='/api/export'});`;
  return shell('계정·데이터 삭제', `<h1>계정·데이터 삭제</h1><p class="mut">시행일 ${VERSION}</p>
<div class="card"><b>삭제되는 것</b><ul><li>내 계정 정보, 크레딧·플랜 기록, 차단 목록, 약관 동의 기록</li><li>내가 만든 방(대화, 문서, 산출물 포함)과 그 안의 귓속말, 그 방의 공유 링크</li><li>내가 마켓에 올린 에셋과 내가 누른 좋아요</li><li>다른 사람 방에 남긴 내 메시지는 “[삭제된 메시지]”로 바뀌고, 내 귓속말 기록은 삭제됩니다.</li><li>GitHub 연동 정보(이 브라우저의 암호화 쿠키)</li></ul>
<p class="mut">신고 기록은 안전 확보를 위해 접수 후 180일 보관 뒤 삭제됩니다. 삭제는 되돌릴 수 없고, 백업에 남은 사본은 백업 보관 주기가 지나면 파기됩니다. </p></div>
<p id="who" class="mut"></p>
<div id="yes" hidden class="card"><p><b>먼저 내 데이터를 내려받을 수 있어요.</b> <button id="exp" type="button">내 데이터 내려받기(JSON)</button></p>
<p>정말 삭제하려면 아래 칸에 <b>삭제</b>라고 입력하세요.</p><p><input id="cf" placeholder="삭제" aria-label="확인 입력"> <button id="go" type="button" class="danger">계정과 데이터 영구 삭제</button></p><p id="msg" style="color:#b42318"></p></div>
<div id="no" hidden class="card"><p>삭제하려면 먼저 <a href="/">앱</a>에서 로그인한 뒤 이 페이지로 다시 오세요.</p><p>로그인할 수 없다면 가입에 쓴 이메일 또는 계정 정보를 적어 <b>${esc(CONTACT())}</b>로 삭제를 요청하세요. 본인 확인 후 처리합니다.</p></div>
<div id="done" hidden class="card"><b>삭제를 완료했습니다.</b><p>이용해 주셔서 감사합니다.</p></div>`, script);
}
module.exports = { privacy, terms, deleteAccount, TERMS_VERSION: VERSION };
