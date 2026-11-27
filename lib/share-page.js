'use strict';
/* 공유 링크(/s/<id>) 페이지: 결과물·검토 카드·대화를 읽기 전용으로 보여 준다(server.js에서 분리, 동작 동일). 모든 글자는 이스케이프한다 */
const { MODES } = require('./modes');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* 검토 카드 같은 마크다운 결과를 공유 페이지에서 읽기 좋게: 제목·목록·문단만 지원하고 모든 글자는 이스케이프한다 */
function mdLite(t) {
  const out = []; let list = false, para = [];
  const flush = () => { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } };
  const inline = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  for (const raw of String(t || '').split('\n')) {
    const l = raw.trimEnd(), h = /^(#{1,4})\s+(.*)$/.exec(l), li = /^\s*[-*]\s+(.*)$/.exec(l) || /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if (h) { flush(); if (list) { out.push('</ul>'); list = false; } out.push('<h' + Math.min(4, h[1].length + 1) + '>' + inline(h[2]) + '</h' + Math.min(4, h[1].length + 1) + '>'); }
    else if (li) { flush(); if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(li[1]) + '</li>'); }
    else if (!l.trim()) { flush(); if (list) { out.push('</ul>'); list = false; } }
    else { if (list) { out.push('</ul>'); list = false; } para.push(inline(l)); }
  }
  flush(); if (list) out.push('</ul>');
  return out.join('');
}
function sharePage(r) {
  const mk = r.mode && MODES[r.mode] ? r.mode : '';
  const review = mk === 'review' && r.kind === 'result';
  const bar = r.badge && !review ? '<a class="badge" href="/?' + (mk ? 'mode=' + mk + '&' : '') + 'ref=share">AI 채팅방으로 만들었어요 · ' + (mk ? '나도 ' + MODES[mk].label + ' 모드로 해보기 →' : '나도 만들어 보기 →') + '</a>' : '';
  const plain = r.kind === 'result' && r.lang !== 'html' ? String(r.text || '').replace(/[#*`|>\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110) : (r.kind === 'chat' ? 'AI들과 사람이 함께 나눈 대화' : '');
  const og = '<meta property="og:title" content="' + esc(r.title) + '"><meta property="og:type" content="website">' + (plain ? '<meta property="og:description" content="' + esc(plain) + '">' : '');
  let body;
  if (r.kind === 'result' && r.lang === 'html') body = '<iframe sandbox="" title="' + esc(r.title) + '" srcdoc="' + esc(r.text) + '"></iframe>';
  else if (review || (r.kind === 'result' && /^(markdown|md)$/i.test(r.lang || ''))) body = '<main class="doc">' + (review ? '<p class="kicker">여러 AI가 따로 검토하고 편집장이 종합한 검토 카드</p>' : '') + mdLite(r.text) + '</main>';
  else if (r.kind === 'result') body = '<pre>' + esc(r.text) + '</pre>';
  else body = '<div class="chat">' + r.msgs.map(m => '<div class="m' + (m.kind === 'ai' ? ' ai' : '') + '"><b>' + esc(m.who) + (m.kind === 'ai' ? ' · AI' : '') + '</b><p>' + esc(m.text) + '</p></div>').join('') + '</div>';
  /* 검토 카드는 요금제와 상관없이 끝에 '내 문서도 검토받기'를 둔다(광고 배너가 아니라 같은 기능으로 가는 링크) */
  const cta = review ? '<footer class="cta"><p>기획서·보고서·이메일 초안을 붙여 넣으면 서로 다른 AI들이 따로 검토하고 고친 버전을 드려요.</p><a href="/?mode=review&amp;ref=share">내 문서도 검토받기</a></footer>' : '';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark">' + og + '<title>' + esc(r.title) + '</title><style>' +
    ':root{--bg:#EDEFF2;--sf:#fff;--ink:#17191E;--mu:#667080;--ln:#E3E6EB;--ai:#EEF0F3}@media (prefers-color-scheme:dark){:root{--bg:#0F1114;--sf:#16191E;--ink:#E9ECF1;--mu:#8D95A4;--ln:#232831;--ai:#1D2128}}' +
    'html,body{height:100%;margin:0}body{display:flex;flex-direction:column;font:15px/1.65 "Apple SD Gothic Neo","Pretendard","Noto Sans KR",system-ui,sans-serif;background:var(--bg);color:var(--ink)}' +
    '.badge{flex:none;display:block;text-align:center;padding:10px 12px;background:var(--ink);color:var(--sf);text-decoration:none;font-weight:600;font-size:13.5px}' +
    'iframe{flex:1;border:0;width:100%;background:#fff}pre{flex:1;margin:0;padding:16px;overflow:auto;white-space:pre-wrap;background:var(--sf)}' +
    '.doc{flex:1;width:100%;max-width:720px;margin:0 auto;box-sizing:border-box;padding:24px 16px 8px;overflow-wrap:anywhere}.doc h2,.doc h3{font-size:17px;margin:26px 0 8px;line-height:1.35}.doc h2:first-of-type{margin-top:8px}.doc ul{margin:0;padding-left:20px}.doc li{margin:4px 0}.doc p{margin:0 0 10px}.kicker{color:var(--mu);font-size:13px}' +
    '.cta{width:100%;max-width:720px;margin:8px auto 24px;box-sizing:border-box;padding:16px;border:1px solid var(--ln);border-radius:14px;background:var(--sf)}.cta p{margin:0 0 10px;color:var(--mu);font-size:14px}.cta a{display:inline-block;background:var(--ink);color:var(--sf);text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px}' +
    '.chat{flex:1;overflow:auto;padding:16px;max-width:720px;width:100%;margin:0 auto;box-sizing:border-box}.m{background:var(--sf);border-radius:14px;padding:10px 14px;margin-bottom:10px}.m.ai{background:var(--ai)}.m p{margin:4px 0 0;white-space:pre-wrap;word-break:break-word}' +
    '@media (max-width:760px){.cta{margin:8px 16px 24px;width:auto}}</style></head><body>' + bar + body + cta + '</body></html>';
}
module.exports = { sharePage, mdLite, esc };
