import { prisma } from "@/lib/db";
import { ATTENDANCE_STAT_CATEGORIES } from "@/lib/constants";
import { getCompetitionRaces } from "@/lib/competitions";
import { maskName } from "@/lib/mask";
import { nowKst } from "@/lib/now";

// 관리자 페이지 "월간 리포트 출력" — 예전에 수작업(Gemini/NotebookLM)으로 만들었던
// "세종철인 가을 훈련 일기" PDF와 같은 구성(훈련 현황 → 이달의 세철포인트 TOP5 →
// 이달 대회 출전 소식 → 다음달 대회 예고)을 매달 버튼 한 번으로 뽑을 수 있게 자동화한다.
// 외부(카톡방 등)에 공유하는 게 목적인 출력물이라, 대시보드 비인증 뷰와 같은 원칙으로
// 참가자 실명은 서버에서부터 마스킹해서 내려보낸다(2026.09 결정).

function isStatCategory(category: string) {
  return (ATTENDANCE_STAT_CATEGORIES as string[]).includes(category);
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// 동점자는 같은 순위 + Top N 커트라인에 걸린 동점자는 잘라내지 않고 전부 포함한다
// (예: 5위가 3명 공동이면 5명이 아니라 7명이 나올 수 있음 — 경쟁 순위 표준 방식).
function topNWithTies<T extends { value: number }>(sorted: T[], n: number): Array<T & { rank: number }> {
  let end = Math.min(n, sorted.length);
  if (end > 0) {
    const cutoff = sorted[end - 1].value;
    while (end < sorted.length && sorted[end].value === cutoff) end++;
  }
  const top = sorted.slice(0, end);
  let rank = 0;
  return top.map((r, i) => {
    if (i === 0 || r.value !== top[i - 1].value) rank = i + 1;
    return { ...r, rank };
  });
}

export type MonthlyReport = {
  year: number;
  month: number; // 1-12
  nextYear: number;
  nextMonth: number;
  generatedAt: string; // "YYYY.MM.DD" (KST)

  training: {
    sessionCount: number;
    totalAttendance: number; // 누적 참석 연인원
    averageAttendance: number; // 회당 평균 참석
    maxAttendance: { count: number; date: string } | null;
    weekly: Array<{ date: string; count: number }>; // 이 달 정기훈련/공식행사 세션별 참석인원
  };

  pointsTop: Array<{ memberId: string; name: string; points: number; rank: number }>; // 이달 세철포인트 TOP5(동점 포함)

  finishedRaces: Array<{
    id: string;
    raceName: string;
    category: string;
    dateLabel: string;
    startDate: string;
    participantCount: number;
    participantNames: string[]; // 마스킹됨
  }>;

  upcomingRaces: Array<{
    id: string;
    raceName: string;
    category: string;
    dateLabel: string;
    startDate: string;
    participantCount: number;
  }>;
  upcomingTotalParticipants: number;
};

export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));
  const nextMonthDate = new Date(Date.UTC(year, month, 1)); // month는 1-based라 그대로 다음달 1일
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth() + 1;

  const today = nowKst();
  const todayKey = fmtDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));

  // ---------------- 훈련 현황 ----------------
  const sessions = await prisma.trainingSession.findMany({
    where: { date: { gte: monthStart, lt: nextMonthStart } },
    include: { attendances: { include: { member: true } } },
    orderBy: { date: "asc" },
  });
  const statSessions = sessions.filter((s) => isStatCategory(s.category));

  const totalAttendance = statSessions.reduce((sum, s) => sum + s.attendances.length, 0);
  const averageAttendance = statSessions.length > 0 ? totalAttendance / statSessions.length : 0;

  let maxAttendance: MonthlyReport["training"]["maxAttendance"] = null;
  for (const s of statSessions) {
    if (!maxAttendance || s.attendances.length > maxAttendance.count) {
      maxAttendance = { count: s.attendances.length, date: fmtDate(s.date) };
    }
  }

  const weekly = statSessions.map((s) => ({ date: fmtDate(s.date), count: s.attendances.length }));

  // 이달 세철포인트 TOP5 — 항상 전체 카테고리(대회 포함) 기준, 대시보드와 동일 원칙
  const pointsByMember = new Map<string, { name: string; value: number }>();
  for (const s of sessions) {
    for (const a of s.attendances) {
      const entry = pointsByMember.get(a.memberId) ?? { name: a.member.name, value: 0 };
      entry.value += a.points;
      pointsByMember.set(a.memberId, entry);
    }
  }
  const sortedPoints = Array.from(pointsByMember.entries())
    .map(([memberId, v]) => ({ memberId, ...v }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const pointsTop = topNWithTies(sortedPoints, 5).map((r) => ({
    memberId: r.memberId,
    name: r.name,
    points: r.value,
    rank: r.rank,
  }));

  // ---------------- 이달 대회 출전 소식 (이미 열린 대회만) ----------------
  const thisYearRaces = await getCompetitionRaces(year);
  const monthKeyPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const finishedRaces = thisYearRaces
    .filter((r) => r.startDate.startsWith(monthKeyPrefix) && !r.isPending && r.startDate <= todayKey)
    .map((r) => ({
      id: r.id,
      raceName: r.raceName,
      category: r.category,
      dateLabel: r.dateLabel,
      startDate: r.startDate,
      participantCount: r.participants.length,
      participantNames: r.participants.map((p) => maskName(p.name)),
    }));

  // ---------------- 다음달 대회 예고 (연도 경계 — 12월이면 다음해 1월도 조회) ----------------
  const upcomingRacesSource = nextYear === year ? thisYearRaces : await getCompetitionRaces(nextYear);
  const nextMonthKeyPrefix = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  const upcomingRaces = upcomingRacesSource
    .filter((r) => r.startDate.startsWith(nextMonthKeyPrefix))
    .map((r) => ({
      id: r.id,
      raceName: r.raceName,
      category: r.category,
      dateLabel: r.dateLabel,
      startDate: r.startDate,
      participantCount: r.participants.length,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const upcomingTotalParticipants = upcomingRaces.reduce((sum, r) => sum + r.participantCount, 0);

  return {
    year,
    month,
    nextYear,
    nextMonth,
    generatedAt: `${today.getUTCFullYear()}.${String(today.getUTCMonth() + 1).padStart(2, "0")}.${String(
      today.getUTCDate()
    ).padStart(2, "0")}`,
    training: { sessionCount: statSessions.length, totalAttendance, averageAttendance, maxAttendance, weekly },
    pointsTop,
    finishedRaces,
    upcomingRaces,
    upcomingTotalParticipants,
  };
}
