'use strict';
/* 무료 모델 풀의 백엔드 목록을 환경변수로부터 만든다(server.js에서 분리, 동작 동일).
   주소는 운영자만 정하고, 키 값은 목록에 넣지 않는 것이 원칙이다(keyEnv로 이름만 가리킨다. FREE_EXTRA_BACKENDS·FREELLMAPI_KEY는 예외). */
module.exports = function buildFreeBackends({ BASES, PRODUCTION }) {
  /* 무료 모델 풀: 서버가 가진 무료 티어 키로 사용자 대신 호출한다. 무료 티어는 계정 전체 한도가 작으므로
     백엔드별 일일 상한, 방별 상한, 실패 시 다음 백엔드로 넘어가는 로직을 둔다.
     Mistral은 Free mode의 학습 옵트아웃 확인, 전용 API 키, 계정에 포함된 모델 ID가 모두 설정되어야 활성화된다.
     MISTRAL_FREE_TRAINING_OPT_OUT_CONFIRMED는 운영자 확인값이지 제공사 설정을 자동 검증하지 않는다.
     모델 이름은 제공사가 자주 바꾸므로 환경변수로 교체할 수 있고, FREE_EXTRA_BACKENDS(JSON)로 운영자가
     OpenAI 호환 백엔드를 더 추가할 수 있다. 주소는 운영자만 정하므로 사용자는 서버를 임의 주소로 향하게 할 수 없다 */
  const csv = (v, d) => String(v || d).split(',').map(s => s.trim()).filter(Boolean);
  const mistralFreeOptOutConfirmed = process.env.MISTRAL_FREE_TRAINING_OPT_OUT_CONFIRMED === '1';
  const mistralFreeModels = String(process.env.FREE_MISTRAL_MODELS || '').split(',').map(s => s.trim())
    .filter(s => /^[A-Za-z0-9_.:/-]{1,120}$/.test(s)).slice(0, 20);
  const capFromEnv = (name, fallback) => {
    const raw = process.env[name];
    if (raw == null || String(raw).trim() === '') return fallback;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
  };
  /* 추가 무료 풀(NVIDIA NIM, Google Gemini, Cerebras, Cloudflare Workers AI): 기본 꺼짐.
     각 제공사의 무료 티어 약관은 공개 서비스에서 여러 사람의 대화를 운영자 키로 보내는 것을 허용하지 않거나(NVIDIA API Trial은 시험·평가 용도),
     무료 티어 입력이 제품 개선에 쓰일 수 있어서(Google·NVIDIA), 운영자가 FREE_<ID>_CONFIRMED=1 로 "약관을 확인했고 책임진다"고 명시하고
     키와 모델 목록을 넣은 경우에만 켜진다. 이 값은 확인 서약일 뿐 제공사 설정을 검증하지 않는다. 모델 ID는 기본값이 있으나 제공사가 자주 바꾸므로 FREE_<ID>_MODELS 로 교체한다 */
  const gatedFree = (id, o) => {
    const U = id.toUpperCase();
    const confirmed = process.env['FREE_' + U + '_CONFIRMED'] === '1';
    const keyEnv = confirmed && o.ready() ? o.keyEnv : '';
    const models = String(process.env['FREE_' + U + '_MODELS'] || o.models).split(',').map(x => x.trim()).filter(x => /^[A-Za-z0-9_.:@\/-]{1,120}$/.test(x)).slice(0, 20);
    return { id, keyEnv, base: o.base(), models, cap: capFromEnv('FREE_CAP_' + U, o.cap), gated: true };
  };
  const FREE_BACKENDS = [
    { id: 'openrouter', keyEnv: 'OPENROUTER_API_KEY', base: BASES.openrouter,
      models: csv(process.env.FREE_OPENROUTER_MODELS, 'openrouter/free'),
      cap: Number(process.env.FREE_CAP_OPENROUTER || 45) },
    { id: 'groq', keyEnv: 'GROQ_API_KEY', base: BASES.groq,
      models: csv(process.env.FREE_GROQ_MODELS, 'openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b'),
      cap: Number(process.env.FREE_CAP_GROQ || 900) },
    { id: 'mistral', keyEnv: mistralFreeOptOutConfirmed ? 'MISTRAL_API_KEY' : '', base: BASES.mistral,
      models: mistralFreeModels,
      cap: capFromEnv('FREE_CAP_MISTRAL', 30) }
  ];
  FREE_BACKENDS.push(
    gatedFree('nvidia', { keyEnv: 'NVIDIA_API_KEY', ready: () => !!process.env.NVIDIA_API_KEY, base: () => BASES.nvidia, models: 'deepseek-ai/deepseek-v4.1-flash,openai/gpt-oss-20b', cap: 100 }),
    gatedFree('gemini', { keyEnv: 'GEMINI_API_KEY', ready: () => !!process.env.GEMINI_API_KEY, base: () => BASES.google, models: 'gemini-3.5-flash-lite', cap: 50 }),
    gatedFree('cerebras', { keyEnv: 'CEREBRAS_API_KEY', ready: () => !!process.env.CEREBRAS_API_KEY, base: () => process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1', models: 'gpt-oss-120b', cap: 100 }),
    gatedFree('cloudflare', { keyEnv: 'CLOUDFLARE_API_TOKEN', ready: () => !!process.env.CLOUDFLARE_API_TOKEN && /^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID || ''),
      base: () => process.env.CLOUDFLARE_BASE_URL || ('https://api.cloudflare.com/client/v4/accounts/' + (process.env.CLOUDFLARE_ACCOUNT_ID || 'x') + '/ai/v1'), models: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', cap: 100 })
  );
  /* 키 없이 쓰는 공개 무료 API(Pollinations, LLM7): 계정·키가 없어도 동작해 서버에 아무 키가 없을 때도 실제 AI 답을 낼 수 있다.
     2026-11-22 브라우저로 실제 호출해 확인. 둘 다 익명 한도가 공개되지 않았거나 줄어든 적이 있고 예고 없이 바뀔 수 있어
     하루 상한을 두고 실패하면 다른 백엔드로 넘어간다. 입력은 해당 서비스로 전송된다(개인정보처리방침에 명시). FREE_KEYLESS=0이면 끈다 */
  if (process.env.FREE_KEYLESS !== '0') {
    FREE_BACKENDS.push(
      { id: 'pollinations', key: '', keyEnv: '', noKey: true, base: process.env.POLLINATIONS_BASE_URL || 'https://text.pollinations.ai/openai',
        models: csv(process.env.FREE_POLLINATIONS_MODELS, 'gpt-oss-20b'), cap: capFromEnv('FREE_CAP_POLLINATIONS', 500), keyless: true },
      { id: 'llm7', key: 'unused', keyEnv: '', base: process.env.LLM7_BASE_URL || 'https://api.llm7.io/v1',
        models: csv(process.env.FREE_LLM7_MODELS, 'default'), cap: capFromEnv('FREE_CAP_LLM7', 300), keyless: true }
    );
  }
  /* FreeLLMAPI(여러 무료 제공사를 하나의 OpenAI 호환 주소로 묶는 개인용 라우터)를 운영자가 이미 돌리고 있으면 주소와 통합 키만 넣어 연결한다.
     여러 제공사를 FreeLLMAPI가 알아서 돌려 쓰므로 가장 먼저 시도한다. 주소는 운영자만 정한다(https 또는 localhost) */
  (() => {
    const base = String(process.env.FREELLMAPI_URL || '').trim().replace(/\/+$/, '');
    if (!base) return;
    const okBase = /^https:\/\//.test(base) || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(base) || (!PRODUCTION && /^http:\/\//.test(base));
    if (!okBase) return console.error('FREELLMAPI_URL은 https 주소 또는 localhost여야 합니다: 무시합니다.');
    const models = String(process.env.FREELLMAPI_MODELS || 'auto').split(',').map(x => x.trim()).filter(x => /^[A-Za-z0-9_.:@\/-]{1,120}$/.test(x)).slice(0, 20);
    FREE_BACKENDS.unshift({ id: 'freellmapi', key: String(process.env.FREELLMAPI_KEY || ''), keyEnv: '', noKey: !process.env.FREELLMAPI_KEY,
      base: /\/v1$/.test(base) ? base : base + '/v1', models, cap: capFromEnv('FREE_CAP_FREELLMAPI', 1000) });
  })();
  try {
    const extra = JSON.parse(process.env.FREE_EXTRA_BACKENDS || '[]');
    (Array.isArray(extra) ? extra : []).forEach(e => {
      if (e && !['mistral', 'nvidia', 'gemini', 'cerebras', 'cloudflare', 'freellmapi', 'pollinations', 'llm7'].includes(e.id) && /^[a-z0-9_-]{2,20}$/.test(e.id) && /^https?:\/\//.test(e.base) && (!PRODUCTION || /^https:\/\//.test(e.base) || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(e.base)) && Array.isArray(e.models) && e.models.length && !FREE_BACKENDS.some(b => b.id === e.id)) {
        FREE_BACKENDS.push({ id: e.id, key: e.key ? String(e.key) : '', keyEnv: '', noKey: !e.key, base: String(e.base),
          models: e.models.map(String), cap: Number(e.cap) > 0 ? Number(e.cap) : 100 });
      }
    });
  } catch (e) { console.error('FREE_EXTRA_BACKENDS 형식 오류: 무시합니다.'); }
  return FREE_BACKENDS;
};
