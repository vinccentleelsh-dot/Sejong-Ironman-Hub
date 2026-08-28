import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { ATTENDANCE_STAT_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

function isStatCategory(category: string) {
  return (ATTENDANCE_STAT_CATEGORIES as string[]).includes(category);
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "운영자 권한이 필요합니다." }, { status: 401 });
  }

  const members = await prisma.member.findMany({
    include: { attendances: { include: { session: { select: { category: true } } } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const rows = members.map((m) => [
    m.name,
    m.isActive ? "활성" : "탈퇴",
    m.attendances.reduce((sum, a) => sum + a.points, 0), // 전체 카테고리(대회 포함)
    m.attendances.filter((a) => isStatCategory(a.session.category)).length, // 정기훈련·공식행사만
    m.joinedAt ? m.joinedAt.toISOString().slice(0, 10) : "",
    m.leftAt ? m.leftAt.toISOString().slice(0, 10) : "",
  ]);

  const csv = toCsv(["이름", "상태", "누적 세철포인트", "참석 횟수(정기훈련·공식행사, 연인원)", "가입일", "탈퇴일"], rows);
  const filename = `sejong-triathlon-members-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
