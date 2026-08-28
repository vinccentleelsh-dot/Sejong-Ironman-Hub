import { prisma } from "@/lib/db";
import { ATTENDANCE_STAT_CATEGORIES } from "@/lib/constants";

// "참석 인정 기준" — AttendanceRecord가 존재하고 points > 0이면 그 날 "참석"으로 집계한다.
// (요구사항 정의서 09번 결정 로그 참고: 엑셀 점수규정을 그대로 출석 기준으로 사용)
//
// "전체 참석자 수"는 연인원(출석 건수 총합) 기준이다 (결정 로그 참고).
//
// 아직 일어나지 않은 미래 세션은 참석자가 0명인 게 당연하므로, 평균/최다 등 통계에는
// "이미 지난 세션"만 포함한다 — 그렇지 않으면 미래의 빈 세션들이 평균을 왜곡한다.
//
// 참석인원 통계(참석자수·평균·최다·추이·월별평균·누적거리)는 정기훈련/공식행사만 집계한다.
// 대회(COMPETITION) 참가 기록은 세철포인트 계산에만 사용한다 — 대회 나간 게 "정모 출석"은
// 아니기 때문 (2026.08 결정, ATTENDANCE_STAT_CATEGORIES 참고). 세철포인트 랭킹은 항상
// 전체 카테고리(대회 포함) 기준.

const DAILY_TREND_COUNT = 10;

export type DashboardStats = {
  asOf: string; // "2026.08.26" 형식
  yearTotalAttendance: number; // 연간 전체 참석자 수 (연인원)
  yearAverageAttendance: number; // 연간 회당 평균 참석인원
  monthTotalAttendance: number; // 이번달 전체 참석자 수 (연인원)
  monthAverageAttendance: number; // 이번달 회당 평균 참석인원
  maxSingleDayAttendance: { count: number; date: string } | null; // 1회 최다인원
  dailyTrend: Array<{ date: string; count: number }>; // 최근 N개 훈련일 참석자 수
  monthlyAverages: Array<{ month: string; average: number }>; // 최근 5개월 월별 평균 참석인원
  pointsLeaderboard: Array<{ memberId: string; name: string; points: number }>; // 올해 세철포인트 Top5 (전체 카테고리)
  monthlyAttendanceLeaderboard: Array<{ memberId: string; name: string; count: number }>; // 이달의 참석 Top5 (정기훈련/공식행사만)
  distances: { swimKm: number; bikeKm: number; runKm: number; hasAnyData: boolean }; // 올해 누적 종목별 거리 (정기훈련/공식행사만)
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtAsOf(d: Date) {
  const y = d.getFullYear().toString().slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function isStatCategory(category: string) {
  return (ATTENDANCE_STAT_CATEGORIES as string[]).includes(category);
}

export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));

  // 올해 지난 세션 전체(카테고리 불문) — 세철포인트는 대회 포함 전체 카테고리로 계산하므로 필요
  const allSessions = await prisma.trainingSession.findMany({
    where: { date: { gte: yearStart, lt: nextYearStart, lte: now } },
    include: { attendances: { include: { member: true } } },
    orderBy: { date: "asc" },
  });

  // 참석인원 통계용 — 정기훈련/공식행사만
  const sessions = allSessions.filter((s) => isStatCategory(s.category));

  const yearTotalAttendance = sessions.reduce((sum, s) => sum + s.attendances.length, 0);
  const yearAverageAttendance = sessions.length > 0 ? yearTotalAttendance / sessions.length : 0;

  const monthSessions = sessions.filter((s) => s.date >= monthStart && s.date < nextMonthStart);
  const monthTotalAttendance = monthSessions.reduce((sum, s) => sum + s.attendances.length, 0);
  const monthAverageAttendance = monthSessions.length > 0 ? monthTotalAttendance / monthSessions.length : 0;

  let maxSingleDayAttendance: DashboardStats["maxSingleDayAttendance"] = null;
  for (const s of sessions) {
    if (!maxSingleDayAttendance || s.attendances.length > maxSingleDayAttendance.count) {
      maxSingleDayAttendance = { count: s.attendances.length, date: fmtDate(s.date) };
    }
  }

  const dailyTrend = sessions.slice(-DAILY_TREND_COUNT).map((s) => ({
    date: fmtDate(s.date),
    count: s.attendances.length,
  }));

  // 최근 5개월 월별 평균 참석인원
  const byMonth = new Map<string, { total: number; sessionCount: number }>();
  for (const s of sessions) {
    const key = `${s.date.getUTCFullYear()}-${String(s.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { total: 0, sessionCount: 0 };
    entry.total += s.attendances.length;
    entry.sessionCount += 1;
    byMonth.set(key, entry);
  }
  const monthlyAverages = Array.from(byMonth.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-5)
    .map(([key, v]) => ({ month: key, average: v.sessionCount > 0 ? v.total / v.sessionCount : 0 }));

  // 올해 세철포인트 Top5 — 전체 카테고리(대회 포함)
  const pointsByMember = new Map<string, { name: string; points: number }>();
  for (const s of allSessions) {
    for (const a of s.attendances) {
      const entry = pointsByMember.get(a.memberId) ?? { name: a.member.name, points: 0 };
      entry.points += a.points;
      pointsByMember.set(a.memberId, entry);
    }
  }
  const pointsLeaderboard = Array.from(pointsByMember.entries())
    .map(([memberId, v]) => ({ memberId, name: v.name, points: v.points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  // 이달의 참석 Top5 (참석 "횟수" 기준) — 정기훈련/공식행사만
  const attendanceCountByMember = new Map<string, { name: string; count: number }>();
  for (const s of monthSessions) {
    for (const a of s.attendances) {
      const entry = attendanceCountByMember.get(a.memberId) ?? { name: a.member.name, count: 0 };
      entry.count += 1;
      attendanceCountByMember.set(a.memberId, entry);
    }
  }
  const monthlyAttendanceLeaderboard = Array.from(attendanceCountByMember.entries())
    .map(([memberId, v]) => ({ memberId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 올해 누적 종목별 거리 — 정기훈련/공식행사만, 세션별 swim/bike/run km × 그날 참석 인원수만큼 자동 합산
  // (결정 로그: "참석자 전원이 그날 세션 거리를 그대로 소화한 것으로" 계산)
  let swimKm = 0;
  let bikeKm = 0;
  let runKm = 0;
  let hasAnyData = false;
  for (const s of sessions) {
    if (s.swimKm > 0 || s.bikeKm > 0 || s.runKm > 0) hasAnyData = true;
    const n = s.attendances.length;
    swimKm += s.swimKm * n;
    bikeKm += s.bikeKm * n;
    runKm += s.runKm * n;
  }

  return {
    asOf: fmtAsOf(now),
    yearTotalAttendance,
    yearAverageAttendance,
    monthTotalAttendance,
    monthAverageAttendance,
    maxSingleDayAttendance,
    dailyTrend,
    monthlyAverages,
    pointsLeaderboard,
    monthlyAttendanceLeaderboard,
    distances: { swimKm, bikeKm, runKm, hasAnyData },
  };
}
