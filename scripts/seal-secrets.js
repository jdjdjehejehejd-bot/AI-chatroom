#!/usr/bin/env node
/* 사용법: CONFIG_KEY=<열쇠> node scripts/seal-secrets.js NAME=value NAME2=value2 ...
   - 기존 secrets.enc가 있으면 열어서 값을 합치고(같은 이름은 덮어씀), NAME= 처럼 빈 값을 주면 그 항목을 지운다.
   - CONFIG_KEY가 없으면 새 열쇠를 만들어 화면에 한 번 보여 준다(잘 보관할 것).
   - 값은 화면에 출력하지 않는다. */
const fs = require('fs'), crypto = require('crypto');
const S = require('../secrets');
let key = process.env.CONFIG_KEY;
if (!key) { key = crypto.randomBytes(32).toString('base64url'); console.log('새 CONFIG_KEY(서버 환경변수에 넣고 안전하게 보관): ' + key); }
let obj = {};
if (fs.existsSync(S.FILE)) obj = S.open(fs.readFileSync(S.FILE, 'utf8'), key);
for (const a of process.argv.slice(2)) {
  const i = a.indexOf('='); if (i < 1) continue;
  const k = a.slice(0, i), v = a.slice(i + 1);
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(k)) { console.error('잘못된 이름: ' + k); process.exit(1); }
  if (v) obj[k] = v; else delete obj[k];
}
fs.writeFileSync(S.FILE, S.seal(obj, key));
console.log('secrets.enc 저장: ' + Object.keys(obj).join(', '));
