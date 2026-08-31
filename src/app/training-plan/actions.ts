"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { SessionCategory } from "@/generated/prisma/client";

function num(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length > 0 ? s : null;
}

function disciplinesFromForm(formData: FormData): string | null {
  const values = formData.getAll("disciplines").map(String);
  return values.length > 0 ? values.join(",") : null;
}

// 참석자 체크박스(memberIds) + 사람별 포인트(points_<memberId>) → 이 세션의 AttendanceRecord를
// 그대로 맞춘다. 새로 체크된 사람은 만들고, 체크 해제된 사람은 지우고, 계속 체크된 사람은
// 포인트를 새 값으로 맞춘다 — "여기서 입력하면 그대로 통계·엑셀에 반영"되어야 하므로.
// 포인트는 사람마다 다를 수 있다 (예: 같은 정기훈련이라도 그날 자원봉사 담당은 5점, 나머지는
// 3점 / 같은 대회라도 완주 코스가 사람마다 달라 20~50점으로 갈림 — 2026.09 결정).
async function syncAttendance(sessionId: string, formData: FormData) {
  const memberIds = formData.getAll("memberIds").map(String);

  const existing = await prisma.attendanceRecord.findMany({ where: { sessionId }, select: { memberId: true } });
  const existingIds = new Set(existing.map((a) => a.memberId));
  const newIds = new Set(memberIds);

  const toRemove = [...existingIds].filter((id) => !newIds.has(id));
  if (toRemove.length > 0) {
    await prisma.attendanceRecord.deleteMany({ where: { sessionId, memberId: { in: toRemove } } });
  }

  for (const memberId of memberIds) {
    const points = num(formData, `points_${memberId}`) || 3; // 폴백 — 사람별 입력칸 값이 없으면 3점
    await prisma.attendanceRecord.upsert({
      where: { memberId_sessionId: { memberId, sessionId } },
      update: { points },
      create: { memberId, sessionId, points },
    });
  }
}

export async function updateSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));

  await prisma.trainingSession.update({
    where: { id },
    data: {
      category: String(formData.get("category")) as SessionCategory,
      title: str(formData, "title"),
      description: str(formData, "description"),
      disciplines: disciplinesFromForm(formData),
      swimKm: num(formData, "swimKm"),
      bikeKm: num(formData, "bikeKm"),
      runKm: num(formData, "runKm"),
    },
  });

  await syncAttendance(id, formData);

  revalidatePath("/training-plan");
  revalidatePath("/");
}

export async function createSessionAction(formData: FormData) {
  await requireAdmin();
  const dateStr = String(formData.get("date"));
  if (!dateStr) throw new Error("날짜를 입력해주세요.");

  const session = await prisma.trainingSession.create({
    data: {
      date: new Date(`${dateStr}T00:00:00.000Z`),
      category: String(formData.get("category")) as SessionCategory,
      title: str(formData, "title"),
      description: str(formData, "description"),
      disciplines: disciplinesFromForm(formData),
      swimKm: num(formData, "swimKm"),
      bikeKm: num(formData, "bikeKm"),
      runKm: num(formData, "runKm"),
    },
  });

  await syncAttendance(session.id, formData);

  revalidatePath("/training-plan");
  revalidatePath("/");
}

export async function deleteSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.trainingSession.delete({ where: { id } });
  revalidatePath("/training-plan");
  revalidatePath("/");
}

export async function addMemberAction(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) throw new Error("이름을 입력해주세요.");

  await prisma.member.create({ data: { name, isActive: true, joinedAt: new Date() } });
  revalidatePath("/training-plan");
}

export async function setMemberActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const isActive = String(formData.get("isActive")) === "true";

  await prisma.member.update({
    where: { id },
    data: { isActive, leftAt: isActive ? null : new Date() },
  });
  revalidatePath("/training-plan");
}
