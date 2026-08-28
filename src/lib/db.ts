import type { PrismaClient as PrismaClientType } from "@/generated/prisma/client";
import { PrismaClient } from "@/generated/prisma/client";

// Windows 환경(특히 한글 경로) + Next.js App Router 캐싱 이슈에 대비해, API/페이지 쪽에서는
// 항상 `export const dynamic = 'force-dynamic'`을 유지한다 (Endura Hub에서 겪었던 이슈와 동일한
// 방어 원칙 — 요구사항 정의서 10번 참고).

// 어댑터 분기 — TURSO_DATABASE_URL이 있으면(=Vercel 프로덕션) libsql로 Turso 원격 DB에 붙는다.
// 없으면(=로컬 개발) better-sqlite3로 로컬 파일에 붙는다.
//
// 왜 로컬에서도 libsql 하나로 통일하지 않았나: 이 개발 환경(Windows ARM64)에는 libsql의 네이티브
// 바인딩이 애초에 배포되지 않는다 — `@libsql/*` optionalDependencies 목록에 win32-x64-msvc는
// 있어도 win32-arm64-msvc는 없음 (npm view로 실측 확인, 2026-08-28). 로컬 개발까지 원격 Turso에
// 의존시키면 인터넷 연결 없이는 `npm run dev`조차 안 되므로, 로컬은 기존 better-sqlite3를 그대로
// 유지하고 프로덕션(Vercel, Linux x64 — 바인딩 있음)에서만 libsql을 쓴다.
function createPrismaClient(): PrismaClientType {
  if (process.env.TURSO_DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return new PrismaClient({ adapter });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
