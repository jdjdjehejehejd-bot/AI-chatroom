# Monaymonay — AI 채팅방

사람과 여러 AI가 한 방에서 대화하고, 게임·토론·공동 작업을 하는 채팅방 프로토타입.
- 제품 방향과 검증 계획: [PLAN.md](PLAN.md)
- 시스템 설계(아키텍처, 데이터 모델, 프로토콜, 오케스트레이션, 권한, 보안, 비용, 로드맵): [docs/DESIGN.md](docs/DESIGN.md)
- 화면 설계: Claude 디자인 캔버스 "AI 채팅방 UI 설계"

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

**무료 모델 (키 없이 쓰기)**: 서버 운영자가 무료 티어 키를 환경변수로 넣어 두면, 참가자는 "AI 제공사"에서 "무료 모델"을 골라 키 없이 AI를 초대할 수 있다. `default`도 유료 키가 없으면 무료 풀로 연결된다.

| 환경변수 | 설명 |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter 키. `:free` 모델만 호출. `FREE_OPENROUTER_MODELS`(쉼표 목록)로 모델 교체 |
| `GROQ_API_KEY` | Groq 키. `FREE_GROQ_MODELS`로 모델 교체 |
| `FREE_CAP_OPENROUTER` / `FREE_CAP_GROQ` | 서버 전체 하루 호출 상한(기본 45 / 900, UTC 기준 초기화) |
| `FREE_ROOM_CAP` | 방당 무료 호출 상한(기본 20) |

한 백엔드가 429/오류를 내면 1분(인증·모델 오류는 10분) 쉬고 다음 백엔드로 넘어간다. 무료 티어는 계정 전체 한도가 작아서(OpenRouter `:free`는 하루 50회, 크레딧 10달러 이상 구매 시 1000회 / Groq 하루 약 1000회, 2026년 기준 제3자 정리 자료) 방당·서버당 상한이 없으면 금방 소진된다. 모델 이름과 한도는 제공사가 바꾸므로 운영 전에 각 제공사 문서로 확인한다.

**검증 범위**: 가짜 API 서버로 요청 형식(경로, 헤더, 모델, 키 분리, 오류 처리)만 검증했다. 실제 제공사 서버로는 아직 호출해 보지 않았다.

기타 환경변수: `PORT`(기본 3000), `ROOM_CALL_BUDGET`(방당 AI 호출 예산, 기본 30), `ROOM_CALL_BUDGET_MAX`(상한, 기본 100), `DEMO_DELAY_MS`(데모 응답 지연, 기본 700)

## 주요 기능

- 방 만들기/초대 링크, 이름 중복 처리, 접속자 목록
- AI 참가자 초대/내보내기 (이름 + 역할 설명), 방 유형 템플릿(게임·토론·협업)
- 발언 정책 3종, AI 연속 발언 한도, 방별 호출 예산
- 공유 문서 (AI가 `[문서]`로 시작하는 줄을 쓰면 자동 기록)

이전 프로젝트(logtimeline)는 git 이력에 남아 있다: `git checkout b78f5a7`
