import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { CATEGORY_LABELS, formatDisciplines } from "@/lib/constants";
import type { SessionCategory } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "운영자 권한이 필요합니다." }, { status: 401 });
  }

  const sessions = await prisma.trainingSession.findMany({
    include: { attendances: { include: { member: true }, orderBy: { member: { name: "asc" } } } },
    orderBy: { date: "asc" },
  });

  const rows = sessions.map((s) => [
    s.date.toISOString().slice(0, 10),
    CATEGORY_LABELS[s.category as SessionCategory],
    s.title ?? "",
    formatDisciplines(s.disciplines),
    s.swimKm,
    s.bikeKm,
    s.runKm,
    s.swimKm + s.bikeKm + s.runKm,
    s.attendances.length,
    s.attendances.map((a) => a.member.name).join(", "),
    s.description ?? "",
  ]);

  const csv = toCsv(
    ["날짜", "분류", "대회/행사명", "종목", "Swim(km)", "Bike(km)", "Run(km)", "합계(km)", "참석인원", "참석자", "설명"],
    rows
  );
  const filename = `sejong-triathlon-sessions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
