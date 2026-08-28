import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

// 원본 엑셀("2026 세철 포인트" 시트)과 같은 모양 — 회원 × 날짜별 포인트 매트릭스로 내보낸다.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "운영자 권한이 필요합니다." }, { status: 401 });
  }

  const sessions = await prisma.trainingSession.findMany({ orderBy: { date: "asc" } });
  const members = await prisma.member.findMany({
    include: { attendances: true },
    orderBy: { name: "asc" },
  });

  const withTotals = members.map((m) => {
    const pointsBySession = new Map(m.attendances.map((a) => [a.sessionId, a.points]));
    const total = m.attendances.reduce((sum, a) => sum + a.points, 0);
    return { member: m, pointsBySession, total };
  });
  withTotals.sort((a, b) => b.total - a.total);

  const dateHeaders = sessions.map((s) => s.date.toISOString().slice(0, 10));
  const header = ["이름", "상태", "합계", "순위", ...dateHeaders];

  const rows = withTotals.map((w, i) => [
    w.member.name,
    w.member.isActive ? "활성" : "탈퇴",
    w.total,
    i + 1,
    ...sessions.map((s) => w.pointsBySession.get(s.id) ?? ""),
  ]);

  const csv = toCsv(header, rows);
  const filename = `sejong-triathlon-points-grid-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
