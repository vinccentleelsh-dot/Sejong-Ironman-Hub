import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "운영자 권한이 필요합니다." }, { status: 401 });
  }

  const [members, sessions, attendances, pointRules, competitionRaces] = await Promise.all([
    prisma.member.findMany(),
    prisma.trainingSession.findMany(),
    prisma.attendanceRecord.findMany(),
    prisma.pointRule.findMany(),
    prisma.competitionRace.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    source: "세종철인 훈련허브",
    members,
    sessions,
    attendances,
    pointRules,
    competitionRaces,
  };

  const filename = `sejong-triathlon-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
