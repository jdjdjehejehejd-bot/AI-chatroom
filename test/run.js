/* 서버 자동 테스트 실행기: `npm test`. 각 파일을 따로 실행해 실패(FAIL 줄·비정상 종료·제한시간)를 모은다.
   실제 외부 서비스(AI 제공사·OAuth·메일)는 호출하지 않는다. 가짜 서버로 요청 형식과 오류 처리만 검증한다. */
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const only = process.argv.slice(2);
// npm test must never use a developer's real provider credentials. Mock-provider
// tests set their own keys explicitly when spawning the server.
const testEnv = { ...process.env };
for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY', 'GOOGLE_API_KEY', 'MISTRAL_API_KEY', 'NVIDIA_API_KEY', 'AI_MODEL', 'FREE_EXTRA_BACKENDS', 'MISTRAL_FREE_TRAINING_OPT_OUT_CONFIRMED', 'FREE_MISTRAL_MODELS', 'FREE_CAP_MISTRAL']) delete testEnv[key];
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only.length || only.some(o => f.startsWith(o)))).sort();
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(__dirname, f)], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', env: testEnv, timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter(l => /^FAIL /.test(l) || /\d+ pass, [1-9]\d* fail/.test(l) || /^SOME FAILED/.test(l));
  const passN = (out.match(/^PASS /gm) || []).length;
  const ok = r.status === 0 && !fails.length && !r.error;
  console.log((ok ? 'ok   ' : 'FAIL ') + f.replace('.test.js', '') + '  (' + passN + ' checks, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  if (!ok) { bad++; fails.slice(0, 8).forEach(l => console.log('     ' + l)); if (r.error) console.log('     ' + r.error.message); if (r.status !== 0 && !fails.length) console.log(out.split('\n').slice(-8).join('\n')); }
}
console.log(bad ? bad + '개 테스트 파일 실패' : files.length + '개 테스트 파일 모두 통과');
process.exit(bad ? 1 : 0);
