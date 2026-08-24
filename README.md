# airforce-calendar

대한민국 공군 장병을 위한 모바일 중심의 개인 휴가 관리 캘린더입니다.

현재 보유 휴가·휴가 일정·외출 관리와 브라우저 로컬 저장을 지원합니다. Supabase 환경 변수를 설정하면 이메일 OTP 로그인, 사용자별 서버 저장, 오프라인 읽기 캐시와 기존 로컬 데이터 이전 모드로 동작합니다.

## 개발 환경

- React
- TypeScript
- Vite
- Tailwind CSS
- Vitest

## 실행

```bash
npm install
npm run dev
```

환경 변수가 없으면 기존 로컬 저장 모드로 실행됩니다. 서버 모드를 사용하려면 `.env.example`을 참고해 `.env`에 Supabase URL과 publishable key를 설정합니다. secret/service-role key는 브라우저 환경 변수에 넣지 않습니다.

## 로컬 Supabase

Docker가 실행 중인 환경에서 다음 순서로 서버 스키마와 DB 테스트를 확인합니다.

```bash
npm run supabase:start
npm run supabase:reset
npm run test:db
```

비공개 베타 사용 이메일은 Supabase Dashboard의 `beta_allowlist`에 소문자로 직접 추가합니다. OTP 만료는 10분, 재전송 간격은 60초로 구성되어 있습니다.

## 확인

```bash
npm run lint
npm test
npm run build
npm run test:db
```
