import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Windows 환경(특히 한글 경로) + Next.js App Router 캐싱 이슈에 대비해, API/페이지 쪽에서는
// 항상 `export const dynamic = 'force-dynamic'`을 유지한다 (Endura Hub에서 겪었던 이슈와 동일한
// 방어 원칙 — 요구사항 정의서 10번 참고).

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
