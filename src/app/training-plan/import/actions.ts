"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseRow, looksLikeHeaderRow, type ParsedRow } from "@/lib/import-template";

export async function parsePastedTextAction(formData: FormData): Promise<ParsedRow[]> {
  await requireAdmin();
  const text = String(formData.get("pastedText") ?? "");
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const startIdx = looksLikeHeaderRow(lines[0].split("\t")) ? 1 : 0;
  return lines.slice(startIdx).map((line, i) => parseRow(line.split("\t"), startIdx + i + 1));
}

export async function parseFileAction(formData: FormData): Promise<ParsedRow[]> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("파일을 선택해주세요.");

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("시트를 찾을 수 없습니다.");

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      let value = cell.value;
      if (value && typeof value === "object" && "text" in value) value = (value as { text: string }).text;
      if (value instanceof Date) {
        cells.push(value.toISOString().slice(0, 10));
      } else {
        cells.push(value === null || value === undefined ? "" : String(value));
      }
    }
    if (cells.every((c) => c.trim() === "")) return; // 빈 줄 스킵
    if (rowNumber === 1 && looksLikeHeaderRow(cells)) return; // 헤더 줄 스킵
    rows.push(parseRow(cells, rowNumber));
  });

  return rows;
}

export async function commitImportAction(rows: ParsedRow[]): Promise<{ created: number; updated: number }> {
  await requireAdmin();

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.date || !row.category) continue; // 유효하지 않은 행은 건너뜀 (미리보기에서 이미 걸러진 것을 전제)

    const date = new Date(`${row.date}T00:00:00.000Z`);
    const existing = await prisma.trainingSession.findFirst({
      where: { date, category: row.category },
    });

    const data = {
      date,
      category: row.category,
      title: row.title,
      disciplines: row.disciplines,
      description: row.description,
      swimKm: row.swimKm,
      bikeKm: row.bikeKm,
      runKm: row.runKm,
    };

    if (existing) {
      await prisma.trainingSession.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.trainingSession.create({ data });
      created += 1;
    }
  }

  revalidatePath("/training-plan");
  revalidatePath("/");
  return { created, updated };
}
