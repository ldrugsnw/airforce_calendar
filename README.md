# airforce-calendar

대한민국 공군 장병을 위한 모바일 중심의 개인 휴가 관리 캘린더입니다.

현재 보유 휴가·휴가 일정·외출 관리와 브라우저 로컬 저장을 지원합니다. Supabase 환경 변수를 설정하면 Google 로그인, 사용자별 서버 저장, 오프라인 읽기 캐시와 기존 로컬 데이터 이전 모드로 동작합니다.

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

서버 모드에서 Google 로그인을 사용하려면 Supabase Auth의 Google Provider와 Google Cloud 웹 OAuth 클라이언트를 연결해야 합니다. 현재 피드백 베타는 별도 이메일 허용 목록 없이 가입할 수 있습니다.

## Vercel 배포

- Framework Preset은 `Vite`, Build Command는 `npm run build`, Output Directory는 `dist`를 사용합니다.
- `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를 Vercel 환경 변수에 설정한 뒤 빌드합니다.
- `vercel.json`은 `/calendar`, `/leave` 같은 직접 경로 요청을 앱으로 연결합니다.
- 배포 주소를 Supabase Authentication의 URL Configuration에서 Site URL과 Redirect URLs에 등록합니다.
- Google Cloud 웹 OAuth 클라이언트에는 배포 origin과 Supabase Dashboard에 표시된 callback URL을 등록합니다.
- Supabase Authentication의 Google Provider에 Client ID와 Client Secret을 저장합니다. Client Secret은 소스 코드나 Vercel 환경 변수에 넣지 않습니다.
- Google Auth Platform의 Data Access에는 `openid`, 이메일, 프로필 기본 scope만 사용합니다.

## 확인

```bash
npm run lint
npm test
npm run build
npm run test:db
```
