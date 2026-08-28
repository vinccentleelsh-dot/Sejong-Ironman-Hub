import { prisma } from "@/lib/db";
import type { CompetitionRaceRow, ParticipantMatch } from "@/lib/competitions-shared";

// 대회 참가 계획 공유 (요구사항 5번) — 운영진이 관리하는 공유 대회 캘린더 (서버 전용 조회).
// 참가자는 이름 텍스트로 저장하고, 화면에 보여줄 때 기존 회원 이름과 대소문자 무관
// 일치하면 그 회원 프로필로 링크한다 (게스트·오탈자는 그냥 텍스트로 남음).
// 타입/색상 상수는 @/lib/competitions-shared 에 분리되어 있음 — 클라이언트 컴포넌트는
// 반드시 그쪽에서 import할 것 (이 파일은 prisma를 물고 있어 클라이언트 번들에 넣으면 깨짐).

function parseParticipants(
  raw: string | null,
  memberByLowerName: Map<string, string>
): { participants: ParticipantMatch[]; isPending: boolean } {
  if (!raw || raw.trim() === "") return { participants: [], isPending: true };
  if (raw.includes("입력 예정") || raw.includes("미정")) return { participants: [], isPending: true };
  const names = raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return {
    participants: names.map((name) => ({ name, memberId: memberByLowerName.get(name.toLowerCase()) ?? null })),
    isPending: false,
  };
}

export async function listAvailableCompetitionYears(): Promise<number[]> {
  const races = await prisma.competitionRace.findMany({ select: { startDate: true } });
  const years = new Set(races.map((r) => r.startDate.getUTCFullYear()));
  const current = new Date().getUTCFullYear();
  years.add(current); // 데이터가 아직 없어도 올해 탭은 항상 보이게
  return Array.from(years).sort((a, b) => b - a);
}

export async function getCompetitionRaces(year?: number): Promise<CompetitionRaceRow[]> {
  const [races, members] = await Promise.all([
    prisma.competitionRace.findMany({ orderBy: [{ startDate: "asc" }, { sortOrder: "asc" }] }),
    prisma.member.findMany({ select: { id: true, name: true } }),
  ]);

  const memberByLowerName = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));

  return races
    .filter((r) => year === undefined || r.startDate.getUTCFullYear() === year)
    .map((r) => {
      const { participants, isPending } = parseParticipants(r.participantsRaw, memberByLowerName);
      return {
        id: r.id,
        dateLabel: r.dateLabel,
        startDate: r.startDate.toISOString().slice(0, 10),
        year: r.startDate.getUTCFullYear(),
        month: r.startDate.getUTCMonth() + 1,
        category: r.category,
        raceName: r.raceName,
        courseDetail: r.courseDetail,
        swimKm: r.swimKm,
        bikeKm: r.bikeKm,
        runKm: r.runKm,
        totalKmDisplay: r.totalKmDisplay,
        elevationGainM: r.elevationGainM,
        participantsRaw: r.participantsRaw,
        participants,
        isPending,
      };
    });
}

// 개인 통계 페이지(요구사항 5·7번 연결) — 이 회원 이름이 참가자 목록에 들어간 대회 전체.
// 훈련 참석 이력과는 별개 섹션으로 보여준다.
export async function getMemberCompetitionHistory(memberName: string): Promise<CompetitionRaceRow[]> {
  const all = await getCompetitionRaces();
  const lower = memberName.toLowerCase();
  return all
    .filter((r) => r.participants.some((p) => p.name.toLowerCase() === lower))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1)); // 최근 대회부터
}
