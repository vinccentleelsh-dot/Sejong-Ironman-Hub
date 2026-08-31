import { getCompetitionRaces } from "@/lib/competitions";
import { RACE_CATEGORIES } from "@/lib/competitions-shared";

// 대시보드 맨 아래 "대회 통계" 섹션용 집계 — 대시보드의 나머지 위젯과 같이 "올해" 기준.
// "참가한 대회"만 센다(참가자 미정인 대회는 아직 실적이 아니므로 제외) — 요구사항 그대로.
//
// 거리 합산: 종목별(Swim/Bike/Run) 칸이 채워진 대회는 그 값 × 참가인원으로 더한다. 종목별 칸이
// 전부 비어있는데 "전체 거리" 칸만 순수 숫자로 있는 대회(마라톤/트레일러닝/그란폰도/수영처럼
// 원래 한 종목뿐이라 세분류가 필요 없는 대회 — 엑셀 원본의 표기 규칙과 동일)는, 그 카테고리가
// 뜻하는 단일 종목에 전체 거리를 귀속시킨다(마라톤·트레일러닝→달리기, 그란폰도→자전거,
// 수영→수영). 철인3종처럼 여러 종목이 섞여야 하는데 세부 내역이 없는 대회는 종목별 분해는
// 포기하고 총합에만 반영한다. "1.5(수영)+스카이런 2,917계단"처럼 숫자로 안 떨어지는 특수
// 표기는 억지로 계산하지 않고 정직하게 제외한다(가짜 정밀도보다 정직한 누락이 낫다는 원칙).

const CATEGORY_IMPLIED_DISCIPLINE: Record<string, "swim" | "bike" | "run" | null> = {
  수영: "swim",
  마라톤: "run",
  트레일러닝: "run",
  그란폰도: "bike",
  철인3종: null, // 여러 종목 혼합 — 총합에만 반영, 종목별 분해는 안 함
};

export type CompetitionDashboardStats = {
  raceCount: number; // 전체 참가대회수 (참가자 있는 대회만)
  totalParticipants: number; // 총 참가자 (연인원 — 같은 사람이 여러 대회 나가면 그만큼 카운트)
  distances: {
    swimKm: number;
    bikeKm: number;
    runKm: number;
    totalKm: number;
    hasAnyData: boolean;
    excludedCount: number; // 숫자로 못 바꿔서 정직하게 뺀 대회 수
  };
  categoryRaceCounts: Array<{ category: string; count: number }>;
  categoryParticipantCounts: Array<{ category: string; count: number }>;
};

export type RaceParticipationRow = { memberId: string; name: string; count: number; rank: number };

// "대회 참가횟수" 랭킹 — 올해(year) 기준으로 몇 개 대회에 참가했는지 인원별 집계.
// 이름이 회원 명단과 매칭 안 된 참가자(게스트·오탈자)는 프로필로 링크할 수 없어서 제외한다.
export async function getRaceParticipationLeaderboard(year: number): Promise<RaceParticipationRow[]> {
  const races = (await getCompetitionRaces(year)).filter((r) => !r.isPending);

  const countByMember = new Map<string, { name: string; count: number }>();
  for (const race of races) {
    for (const p of race.participants) {
      if (!p.memberId) continue;
      const entry = countByMember.get(p.memberId) ?? { name: p.name, count: 0 };
      entry.count += 1;
      countByMember.set(p.memberId, entry);
    }
  }

  return Array.from(countByMember.entries())
    .map(([memberId, v]) => ({ memberId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getCompetitionDashboardStats(year: number): Promise<CompetitionDashboardStats> {
  const races = (await getCompetitionRaces(year)).filter((r) => !r.isPending);

  let swimKm = 0;
  let bikeKm = 0;
  let runKm = 0;
  let totalKm = 0;
  let excludedCount = 0;
  let totalParticipants = 0;

  const raceCountByCat = new Map<string, number>();
  const participantCountByCat = new Map<string, number>();

  for (const r of races) {
    const n = r.participants.length;
    totalParticipants += n;
    raceCountByCat.set(r.category, (raceCountByCat.get(r.category) ?? 0) + 1);
    participantCountByCat.set(r.category, (participantCountByCat.get(r.category) ?? 0) + n);

    const sKm = r.swimKm ?? 0;
    const bKm = r.bikeKm ?? 0;
    const rKm = r.runKm ?? 0;
    const disciplineSum = sKm + bKm + rKm;

    if (disciplineSum > 0) {
      swimKm += sKm * n;
      bikeKm += bKm * n;
      runKm += rKm * n;
      totalKm += disciplineSum * n;
      continue;
    }

    // 종목별 칸이 비어있음 — 전체 거리 표기가 순수 숫자면 그걸로 대신한다.
    const trimmed = (r.totalKmDisplay ?? "").trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = Number(trimmed);
      totalKm += parsed * n;
      const disc = CATEGORY_IMPLIED_DISCIPLINE[r.category];
      if (disc === "swim") swimKm += parsed * n;
      else if (disc === "bike") bikeKm += parsed * n;
      else if (disc === "run") runKm += parsed * n;
      // 철인3종 등 혼합 종목이면 총합에만 반영 (세부 분해는 정보가 없어 정직하게 포기)
    } else if (trimmed) {
      excludedCount += 1; // "1.5(수영)+스카이런 2,917계단" 같은 특수 표기 — 계산에서 정직하게 제외
    }
  }

  const categoryRaceCounts = RACE_CATEGORIES.map((c) => ({ category: c, count: raceCountByCat.get(c) ?? 0 })).filter(
    (c) => c.count > 0
  );
  const categoryParticipantCounts = RACE_CATEGORIES.map((c) => ({
    category: c,
    count: participantCountByCat.get(c) ?? 0,
  })).filter((c) => c.count > 0);

  return {
    raceCount: races.length,
    totalParticipants,
    distances: { swimKm, bikeKm, runKm, totalKm, hasAnyData: totalKm > 0, excludedCount },
    categoryRaceCounts,
    categoryParticipantCounts,
  };
}
