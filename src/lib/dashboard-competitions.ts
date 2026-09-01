import { getCompetitionRaces } from "@/lib/competitions";
import { RACE_CATEGORIES } from "@/lib/competitions-shared";
import { nowKst } from "@/lib/now";

// 오늘(KST) 날짜를 "YYYY-MM-DD" 문자열로 — CompetitionRaceRow.startDate와 같은 포맷이라
// 문자열 비교로 바로 "이미 지난 대회인지" 가릴 수 있다.
function todayDateStr(): string {
  const n = nowKst();
  const mm = String(n.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(n.getUTCDate()).padStart(2, "0");
  return `${n.getUTCFullYear()}-${mm}-${dd}`;
}

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
// 아직 열리지 않은(오늘 이후) 대회는 "참가 실적"이 아니므로 제외한다 — 2026.09 결정.
export async function getRaceParticipationLeaderboard(year: number): Promise<RaceParticipationRow[]> {
  const today = todayDateStr();
  const races = (await getCompetitionRaces(year)).filter((r) => !r.isPending && r.startDate <= today);

  const countByMember = new Map<string, { name: string; count: number }>();
  for (const race of races) {
    for (const p of race.participants) {
      if (!p.memberId) continue;
      const entry = countByMember.get(p.memberId) ?? { name: p.name, count: 0 };
      entry.count += 1;
      countByMember.set(p.memberId, entry);
    }
  }

  const sorted = Array.from(countByMember.entries())
    .map(([memberId, v]) => ({ memberId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // 동점자는 같은 순위 — 다음 등수는 인원수만큼 건너뛴다(표준 스포츠 순위 방식, 예: 1,2,2,4).
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.count !== sorted[i - 1].count) rank = i + 1;
    return { ...r, rank };
  });
}

// "대회 마일리지" — 종목별 km에 가중치를 곱해서 합산하는 점수제 (수영 20점/km, 자전거 1점/km,
// 달리기 3점/km — 2026.09 결정). 세철포인트(출석 기반, 운영자가 직접 입력)와는 완전히 별개
// 시스템이다.
//
// 종목별 km이 안 갈라지는 대회(예: 철인3종인데 세부 breakdown 없이 총거리만 있는 경우)는
// 어느 종목에 얼마나 가중치를 줘야 할지 알 수 없으므로, 억지로 배분하지 않고 정직하게
// 그 대회는 마일리지 계산에서 제외한다 (총거리 통계와는 이 점이 다르다 — 총거리는 총합에만
// 넣고 넘어갈 수 있지만, 마일리지는 종목별 가중치가 핵심이라 배분 불가 시 계산 자체가 불가능).
const MILEAGE_WEIGHT = { swim: 20, bike: 1, run: 3 } as const; // 2026.09 조정 — 수영 6→20

export type MileageRow = { memberId: string; name: string; points: number; rank: number };

export async function getMileageLeaderboard(year?: number): Promise<MileageRow[]> {
  const today = todayDateStr();
  const races = (await getCompetitionRaces(year)).filter((r) => !r.isPending && r.startDate <= today);

  const byMember = new Map<string, { name: string; points: number }>();
  for (const race of races) {
    const sKm = race.swimKm ?? 0;
    const bKm = race.bikeKm ?? 0;
    const rKm = race.runKm ?? 0;
    let racePoints = 0;

    if (sKm + bKm + rKm > 0) {
      racePoints = sKm * MILEAGE_WEIGHT.swim + bKm * MILEAGE_WEIGHT.bike + rKm * MILEAGE_WEIGHT.run;
    } else {
      const trimmed = (race.totalKmDisplay ?? "").trim();
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const parsed = Number(trimmed);
        const disc = CATEGORY_IMPLIED_DISCIPLINE[race.category];
        if (disc === "swim") racePoints = parsed * MILEAGE_WEIGHT.swim;
        else if (disc === "bike") racePoints = parsed * MILEAGE_WEIGHT.bike;
        else if (disc === "run") racePoints = parsed * MILEAGE_WEIGHT.run;
        // 철인3종처럼 혼합 종목인데 세부 분해가 없으면 racePoints는 0으로 남겨 제외한다
      }
      // 숫자로도 안 떨어지는 특수 표기는 애초에 racePoints=0 → 이 대회는 마일리지에 반영 안 됨
    }

    if (racePoints <= 0) continue;
    for (const p of race.participants) {
      if (!p.memberId) continue;
      const entry = byMember.get(p.memberId) ?? { name: p.name, points: 0 };
      entry.points += racePoints;
      byMember.set(p.memberId, entry);
    }
  }

  const sorted = Array.from(byMember.entries())
    .map(([memberId, v]) => ({ memberId, name: v.name, points: Math.round(v.points * 10) / 10 }))
    .sort((a, b) => b.points - a.points);

  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.points !== sorted[i - 1].points) rank = i + 1;
    return { ...r, rank };
  });
}

export async function getCompetitionDashboardStats(year: number): Promise<CompetitionDashboardStats> {
  const today = todayDateStr();
  // 아직 열리지 않은(오늘 이후) 대회는 "참가 실적" 통계에 넣지 않는다 — 아직 안 뛰었으므로.
  const races = (await getCompetitionRaces(year)).filter((r) => !r.isPending && r.startDate <= today);

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
