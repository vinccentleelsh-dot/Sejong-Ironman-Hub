// 코스 아카이브 — 클라이언트/서버 양쪽에서 안전하게 쓰는 타입·상수만 모아둔 파일
// (@/lib/courses.ts는 prisma를 물고 있어 클라이언트 번들에 넣으면 깨짐 — competitions-shared.ts와
// 동일한 분리 원칙).

export type TrackData = {
  la: number[]; // 위도 (다운샘플링된 포인트)
  lo: number[]; // 경도
  d: number[]; // 누적 거리(km)
  e: number[]; // 고도(m, 스무딩됨)
  g: number[]; // 구간 경사(%)
  cg: number[]; // 누적 획득고도(m)
  t: number[] | null; // GPX 실측 경과시간(분) — 전 구간에 시간기록이 있을 때만
  timeAnomalies: number; // 30분 이상 점프로 보정한 구간 수
  s?: number[]; // 각 트랙포인트의 목표시간 비율(0~1) — attachEleAndS 이후 채워짐
};

export type CheckPoint = {
  code: string; // START, CP1, CP2, ..., FIN
  name: string;
  km: number;
  limMin: number; // 공식 제한시간(분) — 없으면 0
  ele: number | null;
  cot: string; // 컷오프 원문 표기 (예: "토 09:50")
  note: string;
  idx: number; // 트랙 배열에서 가장 가까운 인덱스
  cgain: number; // 그 지점까지의 누적 획득고도
  s: number; // 목표시간 비율(0~1)
};

export type Peak = {
  n: string; // 이름
  km: number;
  e: number; // 고도
};

export type CourseMeta = {
  name: string;
  sport: string;
  notes: string;
  startDTraw: string;
  totalKm: number;
  gainM: number;
  cpCount: number;
  hasCutoff: boolean;
  cpSource: "paste" | "gpx" | "auto";
  paceModel: string;
};

// 저장/재계산에 필요한 전체 상태 — 레퍼런스 구현체의 APP 전역변수와 동일한 모양.
// startDT는 항상 ISO 문자열로 들고 다닌다(이 코드베이스 컨벤션 — Date를 서버→클라이언트
// 컴포넌트 경계로 그대로 넘기지 않음, CompetitionRaceRow.startDate 등과 동일). 실제 계산에
// 쓸 때만 그때그때 new Date(...)로 되돌린다.
export type CourseAppState = {
  track: TrackData;
  cps: CheckPoint[];
  peaks: Peak[];
  startDT: string | null;
  meta: CourseMeta;
};

export const SPORTS: Array<{ id: string; label: string }> = [
  { id: "marathon", label: "🏃 마라톤" },
  { id: "ultra", label: "🏃‍♂️ 울트라마라톤" },
  { id: "trail", label: "⛰️ 트레일러닝" },
  { id: "tri", label: "🏊 철인3종" },
  { id: "cycle", label: "🚴 사이클/그란폰도" },
  { id: "etc", label: "🎽 기타" },
];

export function sportLabel(id: string): string {
  return SPORTS.find((s) => s.id === id)?.label ?? "🎽 기타";
}

// 저장/수정 요청 페이로드 — CourseDetail에서 id/createdAt/updatedAt 뺀 것 (서버가 채움)
export type CoursePayload = {
  track: TrackData;
  cps: CheckPoint[];
  peaks: Peak[];
  startDT: string | null;
  meta: CourseMeta;
};

export type CourseCardRow = {
  id: string;
  name: string;
  sport: string;
  totalKm: number;
  gainM: number;
  cpCount: number;
  hasCutoff: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO — createdAt과 다르면 "수정됨" 표시
  sparklineE: number[]; // 스파크라인용 고도 배열 (다운샘플된 track.e 그대로)
};

// DB/서버↔클라이언트 전송용 — 이 코드베이스 컨벤션대로 Date는 항상 ISO 문자열로 건넨다
// (CompetitionRaceRow.startDate 등과 동일 원칙). 클라이언트에서 실제 계산에 쓸 때만
// new Date(...)로 되돌린다.
export type CourseDetail = {
  id: string;
  track: TrackData;
  cps: CheckPoint[];
  peaks: Peak[];
  startDT: string | null; // ISO
  meta: CourseMeta;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
