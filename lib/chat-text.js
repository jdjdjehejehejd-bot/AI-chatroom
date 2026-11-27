'use strict';
/* 대화 글을 읽는 순수 함수들(server.js에서 분리, 동작 동일): 넘김([PASS]) 판별, 방 전체 부름·인사 판별, 진행자 답 해석 */
const isPass = t => /^\s*\[?\s*PASS\s*\]?\s*\.?\s*$/i.test(t);
const GROUP_CALL = /(얘들아|애들아|다들|여러분|모두들|모두\s*안녕|하이\s*하이|\b(everyone|everybody|guys|y'all|hi all|hello all)\b)/i;
/* 누구를 부르지 않은 짧은 인사(ㅎㅇ, 안녕, 하이, hi…)는 방에 있는 모두에게 한 인사다 */
const GREETING = /^(ㅎㅇ|ㅎ2|하이|안녕|안냥|하잉|헬로|방가|반가|ㅂㄱ|좋은\s*(아침|점심|저녁|밤)|굿\s*(모닝|나잇)|hi|hello|hey|yo|morning|good\s*(morning|evening|night))/i;
const isGreeting = t => { const x = String(t).trim(); return x.length <= 20 && !/@\S/.test(x) && GREETING.test(x); };
function parseJudge(text, names) {
  const t = String(text || '');
  let list = null;
  try { const j = JSON.parse((/\{[\s\S]*\}/.exec(t) || [''])[0]); if (j && Array.isArray(j.speak)) list = j.speak.map(String); } catch (e) {}
  if (!list) list = names.filter(n => new RegExp('(^|[^가-힣\\w])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^가-힣\\w])').test(t));
  return [...new Set(list.map(x => x.replace(/^@/, '').trim()))].filter(n => names.includes(n));
}
module.exports = { isPass, GROUP_CALL, GREETING, isGreeting, parseJudge };
