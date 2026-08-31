"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function restoreRaceAction(formData: FormData) {
  await requireSuperAdmin();
  const logId = String(formData.get("logId"));

  const log = await prisma.competitionAuditLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("로그를 찾을 수 없습니다.");
  if (log.action !== "DELETE") throw new Error("삭제 기록만 복구할 수 있습니다.");
  if (log.restoredAt) throw new Error("이미 복구된 항목입니다.");

  const snapshot = JSON.parse(log.raceSnapshot);
  await prisma.competitionRace.create({
    data: {
      dateLabel: snapshot.dateLabel,
      startDate: new Date(snapshot.startDate),
      category: snapshot.category,
      raceName: snapshot.raceName,
      courseDetail: snapshot.courseDetail,
      swimKm: snapshot.swimKm,
      bikeKm: snapshot.bikeKm,
      runKm: snapshot.runKm,
      totalKmDisplay: snapshot.totalKmDisplay,
      elevationGainM: snapshot.elevationGainM ?? null,
      participantsRaw: snapshot.participantsRaw,
      sortOrder: snapshot.sortOrder,
    },
  });

  await prisma.competitionAuditLog.update({
    where: { id: logId },
    data: { restoredAt: new Date() },
  });

  revalidatePath("/admin/competitions-log");
  revalidatePath("/competitions");
}
