"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";

export async function restoreCourseAction(formData: FormData) {
  await requireSuperAdmin();
  const logId = String(formData.get("logId"));

  const log = await prisma.courseAuditLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("로그를 찾을 수 없습니다.");
  if (log.action !== "DELETE") throw new Error("삭제 기록만 복구할 수 있습니다.");
  if (log.restoredAt) throw new Error("이미 복구된 항목입니다.");

  const snapshot = JSON.parse(log.courseSnapshot);
  await prisma.course.create({
    data: {
      name: snapshot.name,
      sport: snapshot.sport,
      notes: snapshot.notes ?? null,
      startDTRaw: snapshot.startDTRaw ?? null,
      startDT: snapshot.startDT ? new Date(snapshot.startDT) : null,
      totalKm: snapshot.totalKm,
      gainM: snapshot.gainM,
      cpCount: snapshot.cpCount,
      hasCutoff: snapshot.hasCutoff,
      cpSource: snapshot.cpSource,
      paceModel: snapshot.paceModel,
      trackJson: snapshot.trackJson,
      cpsJson: snapshot.cpsJson,
      peaksJson: snapshot.peaksJson,
      // 원래 등록일까지 복원 — @default(now())를 무시하고 스냅샷 값을 그대로 넣는다
      createdAt: snapshot.createdAt ? new Date(snapshot.createdAt) : undefined,
    },
  });

  await prisma.courseAuditLog.update({
    where: { id: logId },
    data: { restoredAt: new Date() },
  });

  revalidatePath("/admin/course-log");
  revalidatePath("/courses");
}
