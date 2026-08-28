// 클라이언트 컴포넌트에서도 안전하게 쓸 수 있는 타입/상수만 모아둔 파일 —
// prisma(@/lib/db)를 import하지 않는다. 서버 전용 조회 로직은 @/lib/competitions 참고.
// ("use client" 파일이 서버 전용 모듈을 import하면 그 모듈 그래프 전체가 브라우저 번들에
// 끌려들어가 better-sqlite3의 `fs` 등 Node 내장 모듈 때문에 빌드가 깨진다.)

export type ParticipantMatch = { name: string; memberId: string | null };

export type CompetitionRaceRow = {
  id: string;
  dateLabel: string;
  startDate: string; // ISO yyyy-mm-dd
  year: number; // startDate에서 파생
  month: number; // 1-12, startDate에서 파생
  category: string;
  raceName: string;
  courseDetail: string | null;
  swimKm: number | null;
  bikeKm: number | null;
  runKm: number | null;
  totalKmDisplay: string | null;
  elevationGainM: number | null;
  participantsRaw: string | null;
  participants: ParticipantMatch[];
  isPending: boolean; // 참가자 미정 ("(참가자 입력 예정)" 등)
};

// 원본 엑셀 SUM 수식이 남긴 부동소수점 잔여값("160.90000000000001") 정리용 —
// 순수 숫자 표기일 때만 짧은 형태로 다시 포맷하고, "1.5(수영)+스카이런 2,917계단"처럼
// 설명 텍스트가 섞인 값은 원문 그대로 둔다.
export function formatTotalKm(display: string | null): string | null {
  if (!display) return display;
  const trimmed = display.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return String(n);
  }
  return display;
}

export const RACE_CATEGORIES = ["철인3종", "트레일러닝", "마라톤", "그란폰도", "수영"] as const;

export const RACE_CATEGORY_COLOR: Record<string, { text: string; bg: string }> = {
  철인3종: { text: "var(--accent)", bg: "var(--accent-soft)" },
  마라톤: { text: "var(--gold)", bg: "var(--gold-soft)" },
  트레일러닝: { text: "var(--cat-trail)", bg: "var(--cat-trail-soft)" },
  그란폰도: { text: "var(--cat-granfondo)", bg: "var(--cat-granfondo-soft)" },
  수영: { text: "var(--cat-swim)", bg: "var(--cat-swim-soft)" },
};
