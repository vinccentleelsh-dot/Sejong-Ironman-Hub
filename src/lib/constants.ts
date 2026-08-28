import type { SessionCategory } from "@/generated/prisma/client";

export const CATEGORY_LABELS: Record<SessionCategory, string> = {
  REGULAR: "정기훈련",
  OFFICIAL_EVENT: "공식행사",
  COMPETITION: "대회",
  FREE_TRAINING: "자율훈련",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as Array<[SessionCategory, string]>;

// "출석/참석 통계"(참석인원수·평균·최다인원·일별추이·월별평균·누적거리)에 넣을 분류.
// 대회(COMPETITION)는 여기서 빠진다 — 대회 참가 기록은 세철포인트 계산에만 쓰고,
// "몇 명이 훈련에 나왔나" 통계에는 넣지 않는다 (2026.08 결정). 세철포인트 랭킹은
// 이 필터와 무관하게 항상 전체 카테고리(대회 포함)로 계산한다.
export const ATTENDANCE_STAT_CATEGORIES: SessionCategory[] = ["REGULAR", "OFFICIAL_EVENT"];

export const DISCIPLINE_OPTIONS = [
  { value: "SWIM", label: "수영" },
  { value: "BIKE", label: "사이클" },
  { value: "RUN", label: "런" },
  { value: "TRAIL_RUN", label: "트레일런" },
] as const;

export function disciplineLabel(value: string) {
  return DISCIPLINE_OPTIONS.find((d) => d.value === value)?.label ?? value;
}

// "2종(수영,사이클)"처럼 몇 종목을 했는지 + 목록을 같이 보여준다 (요구사항: 종목 수 + 종목명 둘 다 한눈에)
export function formatDisciplines(disciplines: string | null) {
  if (!disciplines) return "—";
  const list = disciplines.split(",").filter(Boolean);
  if (list.length === 0) return "—";
  return `${list.length}종(${list.map(disciplineLabel).join(",")})`;
}
