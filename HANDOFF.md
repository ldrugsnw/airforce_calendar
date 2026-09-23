# 프로젝트 인수인계

최종 확인: 2026-09-14 (UTC)

## 1. 현재 상태

- 프로젝트: 공군 장병용 모바일 우선 휴가 관리 웹 앱
- 브랜치: `main`
- HEAD: `4de74fe` (`docs: 포트폴리오용 서비스 소개 개선`)
- `origin/main`도 `4de74fe`이며 로컬 커밋 차이는 없다.
- 아래 변경은 모두 **미커밋 working tree**에 있다. 전체 reset/checkout으로 되돌리지 않는다.
- 이번 인수인계 작성 중 코드, 디자인, DB 스키마는 변경하지 않았다.
- `supabase/migrations/202609100001_feedback_input_limits.sql`은 로컬 테스트 DB에서는 검증됐지만 원격 Supabase에는 적용하지 않았다. 다음 세션에서도 사용자 승인 없이 원격 마이그레이션을 실행하지 않는다.

최근 커밋:

```text
4de74fe docs: 포트폴리오용 서비스 소개 개선
1638097 feat: Google 로그인 연결
a41f15a feat: 이메일 링크 로그인과 공개 피드백 베타 배포 준비
0a29646 feat: add authenticated Supabase data layer
5f968c0 refactor: 달력 표시 계산 분리
```

### 변경 파일

수정됨:

```text
src/components/CalendarMonthHeader.tsx
src/components/LeaveGrantForm.tsx
src/components/LeaveUsageDetailCard.tsx
src/components/LeaveUsageEditForm.tsx
src/components/OutingFormPanel.tsx
src/components/calendarStyles.ts
src/domain/calendarDate.test.ts
src/domain/calendarDate.ts
src/domain/leave.ts
src/domain/leaveUsage.ts
src/domain/outing.ts
src/pages/CalendarPage.test.tsx
src/pages/CalendarPage.tsx
src/pages/HomePage.test.tsx
src/pages/HomePage.tsx
src/pages/LeaveCreatePage.tsx
src/pages/LeaveDetailFlow.test.tsx
src/pages/LeaveDetailPage.tsx
src/pages/LeaveFlow.test.tsx
src/pages/LeavePage.tsx
src/server/appSnapshot.test.ts
src/server/appSnapshot.ts
src/store/appStorage.test.ts
src/store/appStorage.ts
src/styles.css
supabase/tests/server_foundation.sql
```

새 파일/디렉터리:

```text
HANDOFF.md
docs/air-force-leave-policy-research-2026-09.md
docs/beta-feedback-2026-09.md
docs/handoff-2026-09-10-calendar-ux.md
src/components/LeaveHeatmap.tsx
supabase/migrations/202609100001_feedback_input_limits.sql
```

## 2. 구현된 기능

### 기준 커밋까지 구현되어 있던 기능

- 보유 휴가 종류·일수·획득일·사유·메모 등록, 수정, 삭제
- 월간 달력에서 휴가 기간과 외출 일정 등록, 수정, 취소
- 휴가 종류별 잔여 일수와 사용 완료/예정 일수 계산
- 이어진 여러 휴가 기록을 연속 일정으로 표시
- 홈에서 현재/다음 휴가와 D-day 표시
- KST 기준 날짜 처리
- Google 로그인과 사용자별 Supabase 저장
- RPC 기반 스냅샷 조회/변경, 요청 ID 중복 방지, revision 충돌 검사
- 네트워크 오류 시 사용자별 마지막 서버 스냅샷 읽기
- 기존 localStorage 데이터의 계정 이전 흐름
- Supabase 환경변수가 없을 때 localStorage 저장 모드
- 모바일 중심 레이아웃, 하단 내비게이션, 시스템 다크 모드

### 오늘 이전부터 working tree에 있던 미커밋 개선

- 휴가 종류 입력을 드롭다운에서 한 번에 보이는 라디오 칩으로 변경
- 획득 일수 `− / +` 버튼과 1~365일 검증 추가
- 획득일을 선택 입력으로 변경하고 미래 날짜 허용
- 앱·저장소·서버 계약·DB의 날짜 범위를 2000-01-01~2999-12-31로 통일
- 사유/메모 길이 제한과 외출 입력 검증 강화
- 휴가가 없을 때 달력에서 휴가 추가 화면으로 이동한 뒤 선택 날짜로 복귀
- 위로휴가 노란색의 라이트/다크 모드 글자 대비 개선
- 입력 제한을 반영하는 로컬 DB 마이그레이션과 pgTAP 테스트 추가
- 베타 피드백 분석 및 공군 휴가 정책 조사 문서 추가

### 2026-09-14 세션에서 변경한 내용

- 달력에서 휴가/외출 등록 모드를 날짜 선택 전에 명시적으로 선택하도록 구성
- 단계 안내를 모드 버튼과 달력 사이에 배치
  - 휴가: `① 시작일 선택` → `② 종료일 선택`
  - 하루 휴가는 같은 날짜를 다시 누른다고 안내
  - 외출은 하루만 선택한다고 안내
  - 휴가 선택 취소를 달력 가까이에 배치
- 홈의 휴가 잔디를 정확히 `[오늘-70일, 오늘+70일)`인 140일/20주로 변경
  - 가로 스크롤 제거
  - 미래 일정, 휴가 종류별 색상, 날짜별 접근성 설명 유지
- 휴가 추가 화면에서 선택한 휴가 종류 칩을 달력과 같은 색으로 표시
- 달력 상단의 일(day) 단위 날짜 이동 입력 제거
- `YYYY년 M월` 제목을 눌러 연도(2000~2999)와 월만 선택하는 모바일용 월 이동 UI 추가
- 이전/다음 달 화살표와 `오늘` 이동 유지
- 월을 이동해도 선택 중인 휴가 시작일 상태가 유지되도록 테스트

## 3. 현재 정상 동작 및 검증 결과

2026-09-14 현재 아래 검증이 통과했다.

| 검증 | 결과 |
| --- | --- |
| `npm test` | 16개 파일, 83개 테스트 통과 |
| `npm run lint` | 통과 |
| `npm run build` | 통과 |
| `npm run test:db` | 로컬 DB 1개 파일, 13개 테스트 통과 |
| `git diff --check` | 통과 |

확인된 정상 동작:

- 휴가/외출 모드별 날짜 선택과 저장 흐름
- 시작일/종료일 단계 안내와 하루 휴가 선택 안내
- 보유 휴가가 없는 상태의 추가 화면 왕복
- 연·월 선택, 이전/다음 달, 오늘 이동과 선택 상태 보존
- 휴가 종류별 달력 및 등록 칩 색상
- 휴가 잔디의 140일 경계와 미래 일정 표시
- 획득일 `null`, 미래 획득일, 날짜/일수/문자열 제한의 로컬·서버 계약
- 로컬 Supabase의 새 DB 제약과 RPC 동작

## 4. 미완성 작업과 알려진 문제

- 모든 변경이 미커밋이다. 다음 작업 전에 `git status`와 `git diff`를 다시 확인해야 한다.
- 새 DB 마이그레이션은 원격 Supabase에 적용하지 않았다. 원격 스키마가 이전 상태라면 서버 모드에서 획득일 없이 저장하는 요청 등 새 계약과 맞지 않을 수 있다.
- build는 성공하지만 minified JS가 약 518.9 kB로 Vite의 500 kB 경고를 낸다. 기능 오류는 아니다.
- 실제 iPhone Safari/Android 기기에서 최신 월 선택 UI와 20주 휴가 잔디를 사람이 직접 확인한 결과는 아직 기록되지 않았다.
- 공휴일 데이터, 공군 기본 휴가 템플릿, 복합 휴가 입력 개선은 조사/백로그 상태이며 구현되지 않았다.
- `docs/handoff-2026-09-10-calendar-ux.md`에는 당시의 12개월 휴가 잔디 등 현재와 달라진 설명이 포함되어 있다. 최신 상태는 이 문서를 우선한다.

### 추후 검증할 제품 아이디어

친구·동기·선후임과 확정/희망 휴가를 공유하고 겹치는 날짜를 찾는 방향을 논의했다. 이는 **확정된 개발 계획이 아니다**. 카카오톡 대비 실제 조율 효용, 초대 참여율, 일정 공유 의향과 민감정보 위험을 사용자 인터뷰/프로토타입으로 먼저 검증해야 한다. 현재 코드와 DB에는 친구, 그룹, 공유 링크, 희망 휴가 기능이 없다.

## 5. 다음 작업 우선순위

1. `git status`, `git diff`, 이 문서를 읽고 기존 미커밋 변경을 보존한다.
2. localStorage 모드로 실행해 320~430px 모바일 화면과 다크 모드에서 다음을 직접 확인한다.
   - 달력 단계 안내의 위치와 문구 전환
   - 연도/월 선택 UI, 오늘 및 좌우 화살표
   - 휴가 종류 선택 칩 색상과 대비
   - 20주 휴가 잔디가 가로 스크롤 없이 한 화면에 들어오는지
3. 실제 기기 피드백이 있으면 달력 관련 파일만 국소 수정하고 독립적인 입력/검증 개선은 유지한다.
4. 현재 미커밋 변경을 리뷰한 뒤 커밋 범위를 결정한다.
5. 원격 DB 반영이 필요해지면 `202609100001_feedback_input_limits.sql`의 내용을 재검토하고 사용자 승인 후 별도 배포한다.
6. 공유·조율 아이디어는 코드 작성 전에 실제 사용자 문제 인터뷰와 클릭 가능한 프로토타입으로 검증한다.

## 6. 프로젝트 구조

```text
src/app/         라우팅과 전체 앱 레이아웃
src/auth/        Supabase 인증 상태와 Google 로그인 처리
src/components/  달력, 휴가 폼, 상세 카드 등 재사용 UI
src/domain/      날짜·휴가·외출 타입, 계산, 입력 검증
src/pages/       홈, 달력, 내 휴가, 계정, 로그인 화면
src/server/      Supabase 클라이언트, RPC 저장소, 스냅샷 검증/캐시
src/store/       앱 상태 reducer/provider와 localStorage 저장
src/test/        Vitest 공통 테스트 설정
supabase/migrations/  PostgreSQL 스키마와 RPC 마이그레이션
supabase/tests/       pgTAP DB 테스트
docs/                 베타 피드백, 정책 조사, 이전 인수인계
```

주요 파일:

- `src/app/App.tsx`: 인증 상태에 따른 라우팅과 화면 진입점
- `src/store/AppStateProvider.tsx`: local/server 저장소 선택과 앱 상태 수명주기
- `src/server/appRepository.ts`: 로컬 reducer 저장과 Supabase RPC 요청 어댑터
- `src/pages/CalendarPage.tsx`: 표시 월 및 휴가/외출 선택 상태 관리
- `src/components/CalendarMonthHeader.tsx`: 이전/다음/오늘 및 연·월 이동 UI
- `src/components/LeaveHeatmap.tsx`: 홈의 20주 휴가 흐름
- `src/domain/calendarDate.ts`: KST 오늘, 날짜 범위, 월/일 계산
- `supabase/migrations/202608240001_server_foundation.sql`: 서버 테이블, RLS, RPC 기반 구조
- `supabase/migrations/202609100001_feedback_input_limits.sql`: 현재 미배포 입력 제한 변경

## 7. 기술 스택과 외부 연결

- React 19, TypeScript 6, React Router 8
- Vite 8, Tailwind CSS 4
- React Context + `useReducer`
- Vitest, React Testing Library, ESLint
- Supabase Auth, PostgreSQL, RLS, RPC, pgTAP
- Vercel SPA 배포 (`vercel.json`에서 모든 경로를 `index.html`로 rewrite)

환경변수 이름:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

- 두 환경변수가 설정되면 Supabase 서버 모드로 실행한다.
- 환경변수가 없거나 빈 값이면 localStorage 모드로 실행한다.
- 테스트 모드는 환경변수와 무관하게 서버 모드를 비활성화한다.
- 실제 값, access token, service-role key는 문서나 Git에 기록하지 않는다.
- Google 로그인 사용 시 Supabase Auth의 Google Provider와 Google Cloud OAuth 설정이 별도로 필요하다.

## 8. 실행 명령

의존성 설치:

```bash
npm install
```

기본 개발 서버:

```bash
npm run dev
```

원격 Supabase 설정을 사용하지 않는 localStorage 모드:

```bash
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --host 0.0.0.0
```

검증:

```bash
npm run lint
npm test
npm run build
git diff --check
```

로컬 Supabase 및 DB 테스트:

```bash
npm run supabase:start
npm run supabase:reset
npm run test:db
npm run supabase:stop
```

`supabase:reset`은 로컬 DB를 재생성하는 명령이다. 연결 대상이 로컬인지 확인하고 사용하며, 원격 마이그레이션 명령은 사용자 승인 없이 실행하지 않는다.
