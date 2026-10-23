/* 앱 셸만 캐시한다. 대화·인증·API는 절대 캐시하지 않는다. 오프라인이면 안내 화면을 보여준다. */
const V = 'shell-v1', SHELL = ['/', '/manifest.webmanifest', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (!(u.pathname === '/' || /\.(png|svg|webmanifest)$/.test(u.pathname))) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); } return res; })
    .catch(() => caches.match(r).then(m => m || new Response('오프라인입니다. 연결을 확인한 뒤 다시 열어 주세요.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))));
});
