import type { SessionCategory, MembershipStatus } from "@/generated/prisma/client";

// 정회원/훈련회원/신입회원/탈퇴회원 (2026.09 결정 — 연도별로 정회원 명단이 달라지는 걸
// 표현하기 위해 활성/탈퇴 이진값에서 세분화). WITHDRAWN만 isActive=false와 동기화된다.
export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  REGULAR: "정회원",
  TRAINING: "훈련회원",
  NEW: "신입회원",
  WITHDRAWN: "탈퇴회원",
};

export const MEMBERSHIP_STATUS_OPTIONS = Object.entries(MEMBERSHIP_STATUS_LABELS) as Array<
  [MembershipStatus, string]
>;

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

// 참석자 기본 포인트 — 정기훈련/공식행사/자율훈련은 3점 균일, 대회는 완주 코스마다 점수가
// 제각각이라(올림픽 20/하프 30/풀 50 등) 자동으로 정할 수 없으므로 0으로 두고 운영자가
// 개별 입력한다. SessionsTable(수동 참석 체크)과 훈련계획 엑셀 업로드(자동 참석자 반영)가
// 이 기준을 공유한다.
export function defaultAttendancePoints(category: SessionCategory) {
  return category === "COMPETITION" ? 0 : 3;
}
