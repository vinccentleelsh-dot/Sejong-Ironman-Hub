import { prisma } from "@/lib/db";
import { ATTENDANCE_STAT_CATEGORIES } from "@/lib/constants";

// 연/월 히스토리 아카이브 — 메인 대시보드(올해/이번달 "실시간" 기준)와 달리, 특정 연도·월을
// 고정해서 그 기간만 조회한다. 단, 아직 오지 않은 세션은 참석자가 0명인 게 당연하므로
// 실제 오늘 날짜 이후는 항상 제외한다 (메인 대시보드와 동일한 원칙).
//
// 참석인원 통계(참석자수·평균·최다·월별추이·세션목록)는 정기훈련/공식행사만 집계한다.
// 대회(COMPETITION) 참가 기록은 세철포인트 계산에만 사용한다 (메인 대시보드와 동일 원칙,
// ATTENDANCE_STAT_CATEGORIES 참고). 세철포인트 랭킹은 항상 전체 카테고리 기준.

function isStatCategory(category: string) {
  return (ATTENDANCE_STAT_CATEGORIES as string[]).includes(category);
}

export type MonthBreakdown = {
  month: number; // 1-12
  hasSessions: boolean;
  sessionCount: number;
  totalAttendance: number;
  averageAttendance: number;
};

export type YearSummary = {
  year: number;
  sessionCount: number;
  totalAttendance: number;
  averageAttendance: number;
  maxSingleDayAttendance: { count: number; date: string } | null;
  pointsLeaderboard: Array<{ name: string; points: number }>;
  months: MonthBreakdown[];
};

export type MonthSessionRow = {
  id: string;
  date: string;
  category: string;
  title: string | null;
  attendeeCount: number;
};

export type MonthSummary = {
  year: number;
  month: number;
  sessionCount: number;
  totalAttendance: number;
  averageAttendance: number;
  attendanceLeaderboard: Array<{ name: string; count: number }>;
  pointsLeaderboard: Array<{ name: string; points: number }>;
  sessions: MonthSessionRow[];
};

export async function listAvailableYears(): Promise<number[]> {
  const sessions = await prisma.trainingSession.findMany({ select: { date: true } });
  const years = new Set(sessions.map((s) => s.date.getUTCFullYear()));
  return Array.from(years).sort((a, b) => b - a); // 최신 연도 먼저
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getYearSummary(year: number, today: Date = new Date()): Promise<YearSummary> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

  const allSessions = await prisma.trainingSession.findMany({
    where: { date: { gte: yearStart, lt: nextYearStart, lte: today } },
    include: { attendances: { include: { member: true } } },
    orderBy: { date: "asc" },
  });
  const sessions = allSessions.filter((s) => isStatCategory(s.category));

  const totalAttendance = sessions.reduce((sum, s) => sum + s.attendances.length, 0);
  const averageAttendance = sessions.length > 0 ? totalAttendance / sessions.length : 0;

  let maxSingleDayAttendance: YearSummary["maxSingleDayAttendance"] = null;
  for (const s of sessions) {
    if (!maxSingleDayAttendance || s.attendances.length > maxSingleDayAttendance.count) {
      maxSingleDayAttendance = { count: s.attendances.length, date: fmtDate(s.date) };
    }
  }

  // 세철포인트는 전체 카테고리(대회 포함) 기준
  const pointsByMember = new Map<string, number>();
  for (const s of allSessions) {
    for (const a of s.attendances) {
      pointsByMember.set(a.member.name, (pointsByMember.get(a.member.name) ?? 0) + a.points);
    }
  }
  const pointsLeaderboard = Array.from(pointsByMember.entries())
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const months: MonthBreakdown[] = [];
  for (let m = 1; m <= 12; m++) {
    const inMonth = sessions.filter((s) => s.date.getUTCMonth() + 1 === m);
    const monthTotal = inMonth.reduce((sum, s) => sum + s.attendances.length, 0);
    months.push({
      month: m,
      hasSessions: inMonth.length > 0,
      sessionCount: inMonth.length,
      totalAttendance: monthTotal,
      averageAttendance: inMonth.length > 0 ? monthTotal / inMonth.length : 0,
    });
  }

  return {
    year,
    sessionCount: sessions.length,
    totalAttendance,
    averageAttendance,
    maxSingleDayAttendance,
    pointsLeaderboard,
    months,
  };
}

export async function getMonthSummary(
  year: number,
  month: number,
  today: Date = new Date()
): Promise<MonthSummary> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));

  const allSessions = await prisma.trainingSession.findMany({
    where: { date: { gte: monthStart, lt: nextMonthStart, lte: today } },
    include: { attendances: { include: { member: true } } },
    orderBy: { date: "asc" },
  });
  const sessions = allSessions.filter((s) => isStatCategory(s.category));

  const totalAttendance = sessions.reduce((sum, s) => sum + s.attendances.length, 0);
  const averageAttendance = sessions.length > 0 ? totalAttendance / sessions.length : 0;

  const attendanceCount = new Map<string, number>();
  for (const s of sessions) {
    for (const a of s.attendances) {
      attendanceCount.set(a.member.name, (attendanceCount.get(a.member.name) ?? 0) + 1);
    }
  }
  const attendanceLeaderboard = Array.from(attendanceCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 세철포인트는 전체 카테고리(대회 포함) 기준
  const pointsSum = new Map<string, number>();
  for (const s of allSessions) {
    for (const a of s.attendances) {
      pointsSum.set(a.member.name, (pointsSum.get(a.member.name) ?? 0) + a.points);
    }
  }
  const pointsLeaderboard = Array.from(pointsSum.entries())
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return {
    year,
    month,
    sessionCount: sessions.length,
    totalAttendance,
    averageAttendance,
    attendanceLeaderboard,
    pointsLeaderboard,
    sessions: sessions.map((s) => ({
      id: s.id,
      date: fmtDate(s.date),
      category: s.category,
      title: s.title,
      attendeeCount: s.attendances.length,
    })),
  };
}
