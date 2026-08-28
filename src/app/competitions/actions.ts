"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSejongAuth } from "@/lib/auth";
import { logCompetitionAction, backupCompetitionsSnapshot } from "@/lib/competitions-audit";

// 대회기록(요구사항 5·7·8번) — "세종철인 인증" 하나로 열람·등록·수정·삭제·참가를 전 회원에게
// 열어주는 대신, 모든 변경은 감사로그 + 스냅샷 백업을 남긴다 (실수·악의적 삭제 대비).

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length > 0 ? s : null;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length === 0) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fieldsFromForm(formData: FormData) {
  return {
    dateLabel: String(formData.get("dateLabel") ?? ""),
    startDate: new Date(`${String(formData.get("startDate"))}T00:00:00.000Z`),
    category: String(formData.get("category") ?? ""),
    raceName: String(formData.get("raceName") ?? ""),
    courseDetail: str(formData, "courseDetail"),
    swimKm: num(formData, "swimKm"),
    bikeKm: num(formData, "bikeKm"),
    runKm: num(formData, "runKm"),
    totalKmDisplay: str(formData, "totalKmDisplay"),
    elevationGainM: num(formData, "elevationGainM"),
    participantsRaw: str(formData, "participantsRaw"),
  };
}

export async function createRaceAction(formData: FormData) {
  await requireSejongAuth();
  const fields = fieldsFromForm(formData);
  if (!fields.dateLabel || !fields.category || !fields.raceName) {
    throw new Error("날짜/분류/대회명은 필수입니다.");
  }

  const maxSort = await prisma.competitionRace.aggregate({ _max: { sortOrder: true } });
  const race = await prisma.competitionRace.create({
    data: { ...fields, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
  });

  await logCompetitionAction("CREATE", race);
  await backupCompetitionsSnapshot();
  revalidatePath("/competitions");
}

export async function updateRaceAction(formData: FormData) {
  await requireSejongAuth();
  const id = String(formData.get("id"));
  const fields = fieldsFromForm(formData);

  const race = await prisma.competitionRace.update({ where: { id }, data: fields });

  await logCompetitionAction("UPDATE", race);
  await backupCompetitionsSnapshot();
  revalidatePath("/competitions");
}

export async function deleteRaceAction(formData: FormData) {
  await requireSejongAuth();
  const id = String(formData.get("id"));

  const race = await prisma.competitionRace.delete({ where: { id } });

  await logCompetitionAction("DELETE", race); // 삭제된 전체 내용을 스냅샷으로 남김 — 복구 가능
  await backupCompetitionsSnapshot();
  revalidatePath("/competitions");
}

function parseNames(raw: string | null): string[] {
  if (!raw || raw.includes("입력 예정") || raw.includes("미정")) return [];
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export async function joinRaceAction(formData: FormData) {
  await requireSejongAuth();
  const raceId = String(formData.get("raceId"));
  const memberName = String(formData.get("memberName") ?? "").trim();
  if (!memberName) throw new Error("이름을 선택해주세요.");

  const existing = await prisma.competitionRace.findUnique({ where: { id: raceId } });
  if (!existing) throw new Error("대회를 찾을 수 없습니다.");

  const names = parseNames(existing.participantsRaw);
  if (!names.some((n) => n.toLowerCase() === memberName.toLowerCase())) {
    names.push(memberName);
  }

  const race = await prisma.competitionRace.update({
    where: { id: raceId },
    data: { participantsRaw: names.join(", ") },
  });

  await logCompetitionAction("JOIN", race);
  await backupCompetitionsSnapshot();
  revalidatePath("/competitions");
}

export async function leaveRaceAction(formData: FormData) {
  await requireSejongAuth();
  const raceId = String(formData.get("raceId"));
  const memberName = String(formData.get("memberName") ?? "").trim();

  const existing = await prisma.competitionRace.findUnique({ where: { id: raceId } });
  if (!existing) throw new Error("대회를 찾을 수 없습니다.");

  const names = parseNames(existing.participantsRaw).filter((n) => n.toLowerCase() !== memberName.toLowerCase());

  const race = await prisma.competitionRace.update({
    where: { id: raceId },
    data: { participantsRaw: names.length > 0 ? names.join(", ") : null },
  });

  await logCompetitionAction("LEAVE", race);
  await backupCompetitionsSnapshot();
  revalidatePath("/competitions");
}
