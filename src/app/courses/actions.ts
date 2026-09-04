"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logCourseAction } from "@/lib/course-audit";
import type { CoursePayload } from "@/lib/course-shared";

// 코스 아카이브 — 개인정보가 없는 공개 자료라 열람·등록은 인증 없이 누구나 가능하다
// (2026.09 결정). 다만 수정·삭제는 실수/장난으로 남의 등록물이 망가질 수 있으니 운영진
// (ADMIN) 인증이 있어야만 가능하게 잠근다. 실패는 절대 조용히 삼키지 않는다 — 여기서 던진
// 에러를 호출부(클라이언트 컴포넌트)가 그대로 잡아서 사용자에게 눈에 보이는 배너로 알려야 한다.

function validatePayload(payload: CoursePayload) {
  if (!payload.meta.name || !payload.meta.name.trim()) {
    throw new Error("코스 이름을 입력해주세요.");
  }
  if (!payload.track || !Array.isArray(payload.track.d) || payload.track.d.length === 0) {
    throw new Error("트랙 데이터가 비어있습니다. GPX를 다시 확인해주세요.");
  }
  if (!Array.isArray(payload.cps) || payload.cps.length === 0) {
    throw new Error("체크포인트가 비어있습니다.");
  }
}

export async function createCourseAction(payload: CoursePayload): Promise<{ id: string }> {
  // 등록은 공개 기능 — 누구나 GPX를 올려서 코스 가이드를 추가할 수 있다.
  validatePayload(payload);

  const created = await prisma.course.create({
    data: {
      name: payload.meta.name.trim(),
      sport: payload.meta.sport,
      notes: payload.meta.notes || null,
      startDTRaw: payload.meta.startDTraw || null,
      startDT: payload.startDT ? new Date(payload.startDT) : null,
      totalKm: payload.meta.totalKm,
      gainM: payload.meta.gainM,
      cpCount: payload.meta.cpCount,
      hasCutoff: payload.meta.hasCutoff,
      cpSource: payload.meta.cpSource,
      paceModel: payload.meta.paceModel,
      trackJson: JSON.stringify(payload.track),
      cpsJson: JSON.stringify(payload.cps),
      peaksJson: JSON.stringify(payload.peaks),
    },
  });

  await logCourseAction("CREATE", created);
  revalidatePath("/courses");
  return { id: created.id };
}

export async function updateCourseAction(id: string, payload: CoursePayload): Promise<void> {
  await requireAdmin();
  validatePayload(payload);

  const updated = await prisma.course.update({
    where: { id },
    data: {
      name: payload.meta.name.trim(),
      sport: payload.meta.sport,
      notes: payload.meta.notes || null,
      startDTRaw: payload.meta.startDTraw || null,
      startDT: payload.startDT ? new Date(payload.startDT) : null,
      totalKm: payload.meta.totalKm,
      gainM: payload.meta.gainM,
      cpCount: payload.meta.cpCount,
      hasCutoff: payload.meta.hasCutoff,
      cpSource: payload.meta.cpSource,
      paceModel: payload.meta.paceModel,
      trackJson: JSON.stringify(payload.track),
      cpsJson: JSON.stringify(payload.cps),
      peaksJson: JSON.stringify(payload.peaks),
      // createdAt은 건드리지 않음(최초 등록일 유지) — updatedAt은 @updatedAt으로 자동 갱신
    },
  });

  await logCourseAction("UPDATE", updated);
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
}

export async function deleteCourseAction(id: string): Promise<void> {
  await requireAdmin();
  const deleted = await prisma.course.delete({ where: { id } });
  await logCourseAction("DELETE", deleted);
  revalidatePath("/courses");
}
