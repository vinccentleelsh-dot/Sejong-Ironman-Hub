// 아주 단순한 CSV 인코더 — 쉼표/따옴표/줄바꿈이 든 값만 큰따옴표로 감싼다.
export function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(toCsvValue).join(",");
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
  const bom = "﻿";
  return bom + [toCsvRow(header), ...rows.map(toCsvRow)].join("\r\n") + "\r\n";
}
