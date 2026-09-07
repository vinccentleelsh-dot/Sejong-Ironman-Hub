"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseRow, looksLikeHeaderRow, type ParsedRow } from "@/lib/import-template";
import { defaultAttendancePoints } from "@/lib/constants";

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
    for (let c = 1; c <= 9; c++) {
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

export async function commitImportAction(
  rows: ParsedRow[]
): Promise<{ created: number; updated: number; attendanceCreated: number; unmatchedNames: string[] }> {
  await requireAdmin();

  const members = await prisma.member.findMany({ select: { id: true, name: true } });
  const memberIdByLowerName = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));

  let created = 0;
  let updated = 0;
  let attendanceCreated = 0;
  const unmatchedNames = new Set<string>();

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

    let sessionId: string;
    if (existing) {
      await prisma.trainingSession.update({ where: { id: existing.id }, data });
      sessionId = existing.id;
      updated += 1;
    } else {
      const session = await prisma.trainingSession.create({ data });
      sessionId = session.id;
      created += 1;
    }

    // 참석자 — 이미 이 세션에 참석 기록이 있는 사람은 손대지 않는다(운영자가 이미 개별
    // 포인트를 조정했을 수 있으므로). 새로 매칭되는 사람만 기본 포인트로 추가한다.
    if (row.participantNames.length > 0) {
      for (const name of row.participantNames) {
        const memberId = memberIdByLowerName.get(name.toLowerCase());
        if (!memberId) {
          unmatchedNames.add(name);
          continue;
        }
        const already = await prisma.attendanceRecord.findUnique({
          where: { memberId_sessionId: { memberId, sessionId } },
        });
        if (already) continue;
        await prisma.attendanceRecord.create({
          data: { memberId, sessionId, points: defaultAttendancePoints(row.category) },
        });
        attendanceCreated += 1;
      }
    }
  }

  revalidatePath("/training-plan");
  revalidatePath("/");
  return { created, updated, attendanceCreated, unmatchedNames: Array.from(unmatchedNames).sort() };
}
