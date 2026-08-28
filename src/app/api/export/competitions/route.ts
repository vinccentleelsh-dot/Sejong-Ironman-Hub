import { NextResponse } from "next/server";
import { isAdmin, isSejongAuthed } from "@/lib/auth";
import { getCompetitionRaces } from "@/lib/competitions";
import { formatTotalKm } from "@/lib/competitions-shared";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  // 세종철인 인증(대회기록 페이지 접근 권한) 또는 운영자 권한, 둘 중 하나면 다운로드 가능
  if (!(await isSejongAuthed()) && !(await isAdmin())) {
    return NextResponse.json({ error: "세종철인 인증 또는 운영자 권한이 필요합니다." }, { status: 401 });
  }

  const races = await getCompetitionRaces();

  const rows = races.map((r) => [
    r.year,
    MONTH_LABEL(r.month),
    r.dateLabel,
    r.category,
    r.raceName,
    r.courseDetail ?? "",
    r.swimKm ?? "",
    r.bikeKm ?? "",
    r.runKm ?? "",
    formatTotalKm(r.totalKmDisplay) ?? "",
    r.elevationGainM ?? "",
    r.participants.length > 0 ? r.participants.map((p) => p.name).join(", ") : r.participantsRaw ?? "",
  ]);

  const csv = toCsv(
    ["연도", "월", "날짜", "분류", "대회명", "세부종목", "Swim(km)", "Bike(km)", "Run(km)", "전체(km)", "획득고도(m)", "참가자"],
    rows
  );
  const filename = `sejong-triathlon-competitions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function MONTH_LABEL(m: number) {
  return `${m}월`;
}
