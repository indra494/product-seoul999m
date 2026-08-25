# SEOUL: 999M BELOW

`서울 지하 999M`은 오염된 서울의 지하 999m를 배경으로 한 웹 기반 굴착 전략 액션 게임입니다. 플레이어는 땅굴을 개척하고 자동 진군대와 설치물을 운용해 상대 생존 코어를 파괴합니다.

## 프로젝트 구성

- `1. 정보/`: 대회 요구사항과 참고 자료
- `2. 기획/`: 게임 규칙, 콘텐츠와 밸런스
- `3. 설계/`: 기술 구조, 에셋 원본과 제작 규격
- `4. 개발/seoul-999m-below/`: 실행 가능한 웹게임
- `5. 오픈/`: 공개·시연·제출 자료

## 로컬 실행

```powershell
cd "4. 개발/seoul-999m-below"
npm install
npm run dev
```

프로덕션 빌드와 자동 테스트는 게임 디렉터리에서 `npm test`로 실행합니다.

## Cloudflare 배포

게임은 Cloudflare Workers, 정적 Assets, 방별 Durable Object(`RoomHub`) 하나의 배포물로 운영합니다. 배포 대상 설정은 `4. 개발/seoul-999m-below/wrangler.jsonc`에 있습니다.

### 최초 1회

Node.js `22.13.0` 이상과 Cloudflare 계정이 필요합니다. 다음 명령은 브라우저를 열어 Cloudflare 로그인을 진행합니다. 계정 비밀번호나 토큰을 프로젝트 파일에 저장하지 않습니다.

```powershell
cd "4. 개발/seoul-999m-below"
npx wrangler login
npx wrangler whoami
```

### 배포

배포할 코드가 현재 폴더에 있는지 확인한 뒤, 테스트와 배포를 차례로 실행합니다.

```powershell
cd "4. 개발/seoul-999m-below"
npm test
npm run deploy
```

`npm run deploy`는 프로덕션 빌드 후 Worker, 정적 에셋, Durable Object 설정을 Cloudflare에 업로드합니다. 완료되면 터미널에 기본 공개 주소가 표시됩니다.

```text
https://seoul-999m-below.<Cloudflare Workers 서브도메인>.workers.dev
```

현재 Worker 이름은 `seoul-999m-below`입니다. 같은 Cloudflare 계정에 이 이름의 Worker가 이미 있으면 해당 Worker를 갱신하고, 없으면 새로 만듭니다. 다른 이름의 Worker·Pages 프로젝트와 기존 도메인은 변경하지 않습니다.

### 배포 후 확인

`workers.dev` 주소에서 아래를 확인합니다.

- 첫 화면, 캠페인 프롤로그와 캠페인 진행
- 컴퓨터와 대전
- 같이하기 방 생성·참가·전투 시작
- 영상·음성 에셋 로딩

### 커스텀 도메인 연결

처음에는 `workers.dev` 주소를 사용하고, 확인이 끝난 뒤 Cloudflare 대시보드에서 연결합니다.

```text
Workers & Pages
→ seoul-999m-below
→ Settings
→ Domains & Routes
→ Add Custom Domain
```

기존 홈페이지와 충돌하지 않도록 루트 도메인보다 `play.example.com` 또는 `game.example.com` 같은 새 서브도메인을 권장합니다. 해당 도메인이 이미 Cloudflare에 연결돼 있으면 DNS와 HTTPS 인증서는 Cloudflare가 처리합니다.

### 주의

- `wrangler.jsonc`의 기존 Durable Object 마이그레이션 `v1-room-hub`은 배포 후 수정하거나 삭제하지 않습니다.
- `.env*`, Cloudflare API 토큰, 결제 키 등 비밀값은 커밋하지 않습니다.
