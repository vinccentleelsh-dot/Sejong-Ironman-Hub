# 배포 가이드 — 세종철인 훈련허브 (로컬 → 인터넷)

결정된 스택: **GitHub(저장소) → Vercel(호스팅) → Turso(DB)**, 도메인은 일단 Vercel 기본 주소.

## 왜 로컬/프로덕션 DB 어댑터가 분리되어 있나

`src/lib/db.ts`는 `TURSO_DATABASE_URL` 환경변수 유무로 어댑터를 분기한다.
- 없음(로컬) → `better-sqlite3` (기존 그대로, `dev.db` 파일)
- 있음(Vercel) → `@prisma/adapter-libsql` (Turso 원격 DB)

이렇게 나눈 이유: 이 개발 PC(Windows ARM64)에는 `@libsql/*` 네이티브 바인딩이 애초에
배포되지 않는다 (`win32-arm64-msvc`용 prebuild 없음 — 2026-08-28 npm registry 실측 확인).
로컬 개발까지 libsql로 통일하면 인터넷 연결·Turso 계정 없이는 `npm run dev`도 안 되므로
분리했다. Vercel의 빌드/실행 환경은 Linux x64라 거기선 네이티브 바인딩이 정상 존재한다.

## 사람이 직접 해야 하는 단계 (로그인/계정 소유가 필요해서 대신할 수 없음)

### 1. GitHub 저장소 생성
1. https://github.com/new 에서 새 저장소 생성 (이름 예: `sejong-triathlon-hub`, **Public 또는
   Private 아무거나, README/gitignore/license 체크 안 함** — 이미 로컬에 커밋된 히스토리가 있음)
2. 만들어진 저장소 URL을 알려주면 (또는 직접) 아래를 실행:
   ```bash
   git remote add origin https://github.com/<username>/sejong-triathlon-hub.git
   git push -u origin main
   ```
   `git push` 실행 시 Windows Git Credential Manager가 브라우저 로그인 창을 띄운다 —
   본인 GitHub 계정으로 직접 로그인하면 됨 (비밀번호가 나를 거치지 않음).

### 2. Turso 계정 + DB 생성
1. https://turso.tech → 가입/로그인 (GitHub 계정으로 바로 가능)
2. Turso CLI 설치 (PowerShell):
   ```powershell
   irm get.tur.so/install.ps1 | iex
   ```
3. 로그인 후 **로컬 dev.db 파일을 그대로 업로드해서 DB 생성** (이미 마이그레이션 다 적용되고
   실데이터 시딩된 파일이라 이게 제일 간단하고 확실함):
   ```bash
   turso auth login
   turso db create sejong-hub --from-file "C:\Users\choco\dev\sejong-triathlon-hub\prisma\dev.db"
   turso db show sejong-hub --url        # → TURSO_DATABASE_URL 값
   turso db tokens create sejong-hub     # → TURSO_AUTH_TOKEN 값
   ```
4. 이후 스키마 변경(새 마이그레이션)이 생기면, `prisma/migrations/<새 폴더>/migration.sql`을
   그대로 Turso에 적용:
   ```bash
   turso db shell sejong-hub < prisma/migrations/<새 폴더>/migration.sql
   ```
   (Prisma의 `migrate deploy`가 libsql 원격 URL을 직접 지원하는지 아직 검증 안 됐으므로,
   당분간은 이 수동 방식이 제일 안전함.)

### 3. Vercel 프로젝트 생성 + 배포
1. https://vercel.com → GitHub 계정으로 로그인 → "New Project" → 방금 만든 저장소 Import
2. **Environment Variables**에 아래 6개를 프로젝트 설정 화면에서 직접 입력 (내가 대신
   입력하지 않음 — 토큰/비밀번호는 본인이 직접 붙여넣는 게 원칙):

   | Key | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | 위 2-3단계에서 나온 값 |
   | `TURSO_AUTH_TOKEN` | 위 2-3단계에서 나온 값 |
   | `ADMIN_PASSWORD` | `dnsdudwls` |
   | `ADMIN_SESSION_SECRET` | 아래 새로 생성한 값 사용 |
   | `SEJONG_AUTH_PASSWORD` | `sejong2026` |
   | `SEJONG_AUTH_SESSION_SECRET` | 아래 새로 생성한 값 사용 |

   프로덕션용으로 새로 생성한 세션 시크릿 (로컬 `.env`의 `dev-only-change-me...` 값과는
   다른, 실제로 안전한 랜덤 값 — 그대로 복사해서 쓰면 됨):
   ```
   ADMIN_SESSION_SECRET=ac0a3766b49594620575dc6755be37ea70538ab94b5d02ff3373a08def4c07bf
   SEJONG_AUTH_SESSION_SECRET=012ea6d01bc7fe5b4ff0093e8e99c8b3beb046cf3963ca994d8c6d16205cd6ec
   ```
3. "Deploy" 클릭 → 빌드 끝나면 `https://<프로젝트명>.vercel.app` 주소로 접속 가능

## 내가 (자동으로) 이미 해둔 것
- git 저장소 초기화 + 첫 커밋
- Prisma 어댑터를 `TURSO_DATABASE_URL` 유무로 분기하도록 `src/lib/db.ts` 수정 (로컬 개발
  영향 없음 — `npm run dev` / `npm run build` 모두 재확인 완료)
- `@libsql/client`, `@prisma/adapter-libsql` 설치
- `.env.example` 추가

## 배포 후 알아둘 점
- `prisma/backups/competitions/` 로컬 파일 스냅샷(대회기록 삭제 안전망)은 Vercel의 임시
  파일시스템에서는 재시작마다 사라짐 — 실패해도 요청 자체는 막지 않도록 이미 try-catch로
  되어 있어서 에러는 안 나지만, 이 로컬 백업만 믿지는 말 것. 더 중요한 복구 수단인
  `CompetitionAuditLog` 테이블(변경 내역 + 삭제 시 스냅샷)은 Turso DB에 저장되므로 그대로
  살아있음.
- 로컬 개발용 `start-server.bat` / Windows 시작프로그램 자동 실행은 그대로 둬도 되고,
  실제 배포본이 생기면 로컬은 순수 개발 전용으로만 쓰면 됨 — 정리 여부는 필요할 때 결정.
