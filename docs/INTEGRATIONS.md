# GitHub·Notion 연동 설계

## 목표

로그인한 사용자가 AI 채팅방에서 GitHub와 Notion을 연결하고, 대화와 산출물을 외부 서비스로 내보내거나 가져오며, 선택한 대상과 자동 동기화하고, 채팅 명령으로 조회·작업할 수 있게 한다.

## 인증과 보안

- GitHub 기존 OAuth 연결을 유지하고, 저장소 기능을 사용할 때만 `repo` 권한을 요청한다. Gist만 사용하는 기존 연결은 기존 scope를 유지한다.
- Notion은 사용자별 OAuth 연결을 사용한다. 액세스 토큰은 서버의 암호화 HttpOnly 쿠키에만 저장하고 브라우저 JavaScript에는 노출하지 않는다.
- OAuth state는 단일 사용·단기 쿠키로 바인딩한다. 콜백 복귀 경로는 현재 앱 내부 경로만 허용한다.
- 외부 API 응답은 필요한 필드만 클라이언트로 전달하고, 토큰·시크릿·원문 인증 헤더는 로그나 채팅에 넣지 않는다.
- 자동 동기화는 사용자가 명시적으로 대상과 방향을 선택한 경우에만 활성화한다.

## 기능 범위

### GitHub

- 연결·해제, 사용자 저장소·브랜치 목록
- 채팅/산출물을 선택한 저장소 경로에 커밋
- 저장소 파일 목록·내용 가져오기
- 이슈 목록 조회·이슈 생성
- 사용자가 선택한 저장소에 웹훅을 등록하고 서명 검증 후 변경 이벤트를 처리

### Notion

- OAuth 연결·해제 및 연결된 워크스페이스 표시
- 접근 가능한 페이지·데이터 소스 검색
- 채팅/산출물을 페이지에 블록으로 내보내기
- 선택한 페이지의 블록 내용을 채팅방으로 가져오기
- 웹훅 검증 토큰과 HMAC 서명으로 페이지 변경 이벤트 수신

### 공통

- 설정의 연동 패널에서 연결 상태, 대상, 동기화 방향과 자동 동기화 여부 관리
- 수동 동기화는 마지막 동기화 상태와 오류를 표시
- 채팅 명령: `/github repos`, `/github issues`, `/github file <repo> <path>`, `/notion search <query>`, `/notion import <page>`, `/notion export`
- 명령 결과는 현재 방에 시스템 메시지로 표시하며 외부 서비스의 비밀 값은 포함하지 않는다.

## 저장 모델

계정 레코드에 `integrations`를 추가한다. 토큰 자체는 저장 레코드가 아니라 암호화 쿠키에 둔다.

```json
{
  "integrations": {
    "github": { "repo": "owner/name", "branch": "main", "path": "ai-chatroom", "auto": false, "direction": "out" },
    "notion": { "pageId": "...", "auto": false, "direction": "out" }
  }
}
```

## 동기화 정책

- GitHub 파일 쓰기는 Contents API의 최신 SHA를 먼저 확인하고 직렬로 PUT한다.
- Notion 블록 쓰기는 한 요청당 100개 이하로 나누며, 기존 페이지 콘텐츠를 덮어쓰는 파괴적 동작은 사용하지 않고 append 방식을 기본으로 한다.
- 자동 동기화는 메시지·산출물 변경 시 debounce하여 실행하고 실패하면 다음 수동 동기화에서 재시도한다.
- 외부 변경을 채팅방에 반영할 때는 웹훅 이벤트의 서명을 검증한 뒤 대상 방과 매핑을 확인한다.

## 공식 근거

- Notion OAuth integration: https://developers.notion.com/guides/connections-and-tokens/oauth-integrations/
- Notion update page: https://developers.notion.com/reference/patch-page
- Notion append block children: https://developers.notion.com/reference/patch-block-children
- Notion search: https://developers.notion.com/reference/post-search
- Notion webhooks: https://developers.notion.com/reference/webhooks
- GitHub OAuth scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- GitHub repository contents: https://docs.github.com/en/rest/repos/contents
- GitHub repository API: https://docs.github.com/en/rest/repos/repos
- GitHub issues API: https://docs.github.com/en/rest/issues/issues
- GitHub webhook delivery validation: https://docs.github.com/en/webhooks/using-webhooks/handling-webhook-deliveries
