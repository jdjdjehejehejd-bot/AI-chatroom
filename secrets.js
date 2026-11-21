'use strict';
/* 암호화된 설정 파일(secrets.enc): 제공사 키 같은 비밀 값을 저장소에 암호화해 두고, 서버에는 열쇠(CONFIG_KEY) 하나만 넣는다.
   호스팅을 옮겨도 CONFIG_KEY만 새 곳에 넣으면 된다. 형식: AES-256-GCM, 열쇠는 32바이트(base64url).
   이미 환경변수로 넣은 값이 있으면 그 값을 우선한다(파일보다 서버 설정이 이긴다). 값은 로그에 남기지 않는다. */
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, 'secrets.enc');
function keyBytes(k) {
  const b = Buffer.from(String(k || '').trim(), 'base64url');
  if (b.length !== 32) throw new Error('CONFIG_KEY는 32바이트(base64url 43자)여야 합니다.');
  return b;
}
function seal(obj, key) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyBytes(key), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }, null, 1) + '\n';
}
function open(text, key) {
  const j = JSON.parse(text);
  const d = crypto.createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(j.iv, 'base64'));
  d.setAuthTag(Buffer.from(j.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8'));
}
let status = { keySet: false, file: false, loaded: 0, reason: 'not run' };
function load(env = process.env, file = FILE) {
  status = { keySet: !!env.CONFIG_KEY, file: fs.existsSync(file), loaded: 0, reason: '' };
  if (!env.CONFIG_KEY) return (status.reason = 'no CONFIG_KEY', status);
  if (!status.file) return (status.reason = 'no secrets.enc', status);
  if (!/^[A-Za-z0-9_-]{43}=?$/.test(String(env.CONFIG_KEY).trim())) return (status.reason = 'CONFIG_KEY format (43 chars expected, got ' + String(env.CONFIG_KEY).trim().length + ')', status);
  let obj;
  try { obj = open(fs.readFileSync(file, 'utf8'), env.CONFIG_KEY); }
  catch (e) { console.error('secrets.enc를 열지 못했습니다(CONFIG_KEY가 맞는지 확인): 무시합니다.'); status.reason = 'decrypt failed (wrong CONFIG_KEY)'; return status; }
  let n = 0; const skipped = [];
  for (const [k, v] of Object.entries(obj || {})) {
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(k) || typeof v !== 'string') continue;
    if (env[k] == null || env[k] === '') { env[k] = v; n++; } else skipped.push(k);
  }
  console.log('secrets.enc에서 설정 ' + n + '개를 불러왔습니다.' + (skipped.length ? ' 서버 환경변수가 우선해서 건너뜀: ' + skipped.join(', ') : ''));
  status.loaded = n; status.overridden = skipped; status.reason = 'ok';
  return status;
}
module.exports = { seal, open, load, FILE, status: () => status };
