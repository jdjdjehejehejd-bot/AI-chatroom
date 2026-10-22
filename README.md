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
| `ANTHROPIC_API_KEY` + `AI_MODEL` | Anthropic API 호출 (서버가 키 보관) |
| `OPENAI_API_KEY` + `AI_MODEL` (+ `OPENAI_BASE_URL`) | OpenAI 호환 API 호출 |

실제 AI 호출은 아직 실제 키로 테스트하지 않았다.

기타 환경변수: `PORT`(기본 3000), `ROOM_CALL_BUDGET`(방당 AI 호출 예산, 기본 30), `ROOM_CALL_BUDGET_MAX`(상한, 기본 100), `DEMO_DELAY_MS`(데모 응답 지연, 기본 700)

## 주요 기능

- 방 만들기/초대 링크, 이름 중복 처리, 접속자 목록
- AI 참가자 초대/내보내기 (이름 + 역할 설명), 방 유형 템플릿(게임·토론·협업)
- 발언 정책 3종, AI 연속 발언 한도, 방별 호출 예산
- 공유 문서 (AI가 `[문서]`로 시작하는 줄을 쓰면 자동 기록)

이전 프로젝트(logtimeline)는 git 이력에 남아 있다: `git checkout b78f5a7`
