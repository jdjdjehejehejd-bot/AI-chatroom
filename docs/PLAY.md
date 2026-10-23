# Google Play 출시 (PWA + Trusted Web Activity)

1. **HTTPS 배포**: `PUBLIC_URL`을 실제 주소로, `COOKIE_SECURE=1`, `TRUST_PROXY=1`(프록시 뒤일 때)로 설정한다. 서버가 PWA 매니페스트(`/manifest.webmanifest`), 서비스워커(`/sw.js`), 아이콘(192/512/maskable)을 제공한다. Lighthouse의 PWA 항목으로 확인한다.
2. **TWA 패키징**: `npx @bubblewrap/cli init --manifest https://도메인/manifest.webmanifest` → `bubblewrap build`. 패키지명을 정한 뒤 서명 키의 SHA-256 지문을 얻는다(Play 앱 서명을 쓰면 Play Console의 "앱 무결성"에 나오는 지문).
3. **Digital Asset Links**: 서버 환경변수 `ANDROID_PACKAGE=패키지명`, `ANDROID_SHA256=지문1,지문2`를 넣으면 `/.well-known/assetlinks.json`이 자동으로 제공된다. 이게 맞아야 주소창 없이 열린다.
4. **스토어 등록 정보**: 개인정보처리방침 URL = `/privacy`, 계정 삭제 URL = `/delete-account`, 데이터 보안 양식은 방침 내용(수집 항목·AI 제공자 전달·보관 기간)과 일치하게 작성. UGC 앱이므로 신고·차단 기능 스크린샷을 준비한다.
5. **결제**: Play 결제로 플러스를 팔 경우 서버에서 영수증을 검증한 뒤 `/admin/plan` 로직(플랜 부여)을 호출하도록 연결한다. 디지털 상품은 Play 결제가 필요하다.

## 운영 화면
- `/admin` — `ADMIN_TOKEN`을 입력해 신고 목록을 보고 "조치 완료/기각"으로 처리한다.
- `MAX_WS_PER_IP`(기본 20): 한 IP의 동시 접속 상한. 프록시 뒤라면 `TRUST_PROXY=1`이어야 사용자별 IP로 센다.
