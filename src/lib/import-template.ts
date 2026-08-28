import type { SessionCategory } from "@/generated/prisma/client";

// 연도별 훈련계획 업로드 — 고정 컬럼 순서 템플릿 (엑셀 업로드 · 구글시트 붙여넣기 공용)
// 헤더 텍스트 자체는 사람이 읽기 위한 것일 뿐, 실제 매핑은 "컬럼 위치(A~J)"로 고정한다 —
// 구글시트/엑셀마다 헤더 표기가 조금씩 달라져도 안정적으로 가져오기 위함.

export const IMPORT_COLUMNS = [
  "날짜(YYYY-MM-DD)",
  "분류",
  "대회/행사명",
  "종목(Swim,Bike,Run,Trail Run)",
  "설명",
  "Swim(km)",
  "Bike(km)",
  "Run(km)",
] as const;

export const CATEGORY_LABEL_TO_ENUM: Record<string, SessionCategory> = {
  정기훈련: "REGULAR",
  공식행사: "OFFICIAL_EVENT",
  대회: "COMPETITION",
  자율훈련: "FREE_TRAINING",
};

const DISCIPLINE_LABEL_TO_VALUE: Record<string, string> = {
  swim: "SWIM",
  bike: "BIKE",
  run: "RUN",
  "trail run": "TRAIL_RUN",
  trail_run: "TRAIL_RUN",
};

export type ParsedRow = {
  rowIndex: number; // 원본에서 몇 번째 줄인지 (미리보기 표시용)
  raw: string[];
  date: string | null; // ISO yyyy-mm-dd, 파싱 실패 시 null
  category: SessionCategory | null;
  title: string | null;
  disciplines: string | null;
  description: string | null;
  swimKm: number;
  bikeKm: number;
  runKm: number;
  errors: string[];
};

function excelSerialToISO(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split(".");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d+$/.test(trimmed)) return excelSerialToISO(parseInt(trimmed, 10));
  return null;
}

function num(raw: string | undefined): number {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function trimmedOrNull(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  return s.length > 0 ? s : null;
}

export function parseDisciplines(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const parts = s
    .split(/[,+]/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .map((p) => DISCIPLINE_LABEL_TO_VALUE[p])
    .filter((v): v is string => Boolean(v));
  return parts.length > 0 ? Array.from(new Set(parts)).join(",") : null;
}

export function parseRow(cells: string[], rowIndex: number): ParsedRow {
  const errors: string[] = [];

  const date = parseDateCell(cells[0] ?? "");
  if (!date) errors.push("날짜를 인식할 수 없습니다 (YYYY-MM-DD 형식 권장)");

  const categoryLabel = (cells[1] ?? "").trim();
  const category = CATEGORY_LABEL_TO_ENUM[categoryLabel] ?? null;
  if (!category) errors.push(`분류 "${categoryLabel}"를 알 수 없습니다 (정기훈련/공식행사/대회/자율훈련 중 하나)`);

  return {
    rowIndex,
    raw: cells,
    date,
    category,
    title: trimmedOrNull(cells[2]),
    disciplines: parseDisciplines(cells[3]),
    description: trimmedOrNull(cells[4]),
    swimKm: num(cells[5]),
    bikeKm: num(cells[6]),
    runKm: num(cells[7]),
    errors,
  };
}

// 붙여넣은 첫 줄이 헤더처럼 보이면(날짜 컬럼이 날짜로 안 읽히면) 건너뛴다.
export function looksLikeHeaderRow(cells: string[]): boolean {
  return parseDateCell(cells[0] ?? "") === null;
}
