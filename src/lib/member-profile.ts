import { prisma } from "@/lib/db";
import { ATTENDANCE_STAT_CATEGORIES } from "@/lib/constants";

// 개인 통계 페이지 (요구사항 7번) — 회원 로그인이 없으므로 조회는 완전 공개.
// "올해" 랭킹·포인트는 메인 대시보드/Top5 위젯과 정의를 맞춘다 (참석 인정 기준 = 포인트>0,
// 미래 세션 제외). 참석 이력은 지금까지 기록된 전체를 보여준다.
//
// 세철포인트(points)는 전체 카테고리(대회 포함) 기준, "참석 횟수"·누적거리는 정기훈련/
// 공식행사만 집계한다 — 메인 대시보드와 동일 원칙 (ATTENDANCE_STAT_CATEGORIES 참고).

function isStatCategory(category: string) {
  return (ATTENDANCE_STAT_CATEGORIES as string[]).includes(category);
}

export type MemberRankingRow = {
  memberId: string;
  name: string;
  isActive: boolean;
  points: number;
  attendanceCount: number;
  rank: number;
};

export async function getMemberRanking(year: number, today: Date = new Date()): Promise<MemberRankingRow[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

  const members = await prisma.member.findMany({
    include: {
      attendances: {
        where: { session: { date: { gte: yearStart, lt: nextYearStart, lte: today } } },
        include: { session: { select: { category: true } } },
      },
    },
  });

  const rows = members
    .map((m) => ({
      memberId: m.id,
      name: m.name,
      isActive: m.isActive,
      points: m.attendances.reduce((sum, a) => sum + a.points, 0), // 전체 카테고리
      attendanceCount: m.attendances.filter((a) => isStatCategory(a.session.category)).length, // 정기훈련/공식행사만
    }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return rows;
}

export type MemberProfile = {
  id: string;
  name: string;
  isActive: boolean;
  year: number;
  yearPoints: number;
  yearRank: number;
  totalActiveMembers: number;
  yearAttendanceCount: number;
  distances: { swimKm: number; bikeKm: number; runKm: number; hasAnyData: boolean };
  history: Array<{ sessionId: string; date: string; category: string; title: string | null; points: number }>;
};

export async function getMemberProfile(
  memberId: string,
  year: number,
  today: Date = new Date()
): Promise<MemberProfile | null> {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  const ranking = await getMemberRanking(year, today);
  const mine = ranking.find((r) => r.memberId === memberId);

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

  const attendances = await prisma.attendanceRecord.findMany({
    where: {
      memberId,
      session: { date: { gte: yearStart, lt: nextYearStart, lte: today } },
    },
    include: { session: true },
    orderBy: { session: { date: "desc" } },
  });

  // 누적거리는 정기훈련/공식행사 세션만 (대회 참가는 세철포인트에만 반영 — 메인 대시보드와 동일 원칙)
  let swimKm = 0;
  let bikeKm = 0;
  let runKm = 0;
  let hasAnyData = false;
  for (const a of attendances) {
    const s = a.session;
    if (!isStatCategory(s.category)) continue;
    if (s.swimKm > 0 || s.bikeKm > 0 || s.runKm > 0) hasAnyData = true;
    // 그날 "참석"했다면(포인트>0인 이 레코드가 존재) 세션의 종목별 거리를 그대로 소화한 것으로 계산
    swimKm += s.swimKm;
    bikeKm += s.bikeKm;
    runKm += s.runKm;
  }

  return {
    id: member.id,
    name: member.name,
    isActive: member.isActive,
    year,
    yearPoints: mine?.points ?? 0,
    yearRank: mine?.rank ?? ranking.length + 1,
    totalActiveMembers: ranking.length,
    yearAttendanceCount: mine?.attendanceCount ?? 0,
    distances: { swimKm, bikeKm, runKm, hasAnyData },
    // 참석 이력은 대회 포함 전체 — 개인의 완전한 기록으로 보여준다 (포인트 획득 내역까지 포함)
    history: attendances.map((a) => ({
      sessionId: a.sessionId,
      date: a.session.date.toISOString().slice(0, 10),
      category: a.session.category,
      title: a.session.title,
      points: a.points,
    })),
  };
}
