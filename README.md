# Monaymonay — AI 채팅방

사람과 여러 AI가 한 방에서 대화하고, 게임·토론·공동 작업을 하는 채팅방 프로토타입.
설계와 현황: [PLAN.md](PLAN.md)

## 실행

```bash
npm install
npm start          # http://localhost:3000
```

브라우저 탭을 두 개 열어 같은 초대 링크(`?room=코드`)로 들어가면 다인 대화를 시험할 수 있다.

## AI 응답 모드

| 설정 | 동작 |
|---|---|
| (환경변수 없음) | **데모 모드**: 고정 문구로 응답. 비용 없음 |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` + `AI_MODEL` | 서버 기본 AI가 해당 제공사를 호출 (순서대로 우선) |

**AI마다 다른 회사 모델을 쓰려면** 화면의 "AI 초대"에서 제공사(Anthropic/OpenAI/OpenRouter), 모델 이름, (선택) 개인 API 키를 지정한다. 개인 키가 없으면 서버 환경변수 키를 쓴다. 키는 서버 메모리에만 보관되고 다른 참가자에게 보이지 않지만, 서버를 거치므로 **HTTPS로 배포한 신뢰할 수 있는 서버에서만 입력**해야 한다.

제공사 주소 변경(테스트용): `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`, `OPENROUTER_BASE_URL`

**검증 범위**: 가짜 API 서버로 요청 형식(경로, 헤더, 모델, 키 분리, 오류 처리)만 검증했다. 실제 제공사 서버로는 아직 호출해 보지 않았다.

기타 환경변수: `PORT`(기본 3000), `ROOM_CALL_BUDGET`(방당 AI 호출 예산, 기본 30), `ROOM_CALL_BUDGET_MAX`(상한, 기본 100), `DEMO_DELAY_MS`(데모 응답 지연, 기본 700)

## 주요 기능

- 방 만들기/초대 링크, 이름 중복 처리, 접속자 목록
- AI 참가자 초대/내보내기 (이름 + 역할 설명), 방 유형 템플릿(게임·토론·협업)
- 발언 정책 3종, AI 연속 발언 한도, 방별 호출 예산
- 공유 문서 (AI가 `[문서]`로 시작하는 줄을 쓰면 자동 기록)

이전 프로젝트(logtimeline)는 git 이력에 남아 있다: `git checkout b78f5a7`
