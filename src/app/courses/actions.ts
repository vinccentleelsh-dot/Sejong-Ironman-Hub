"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSejongAuth } from "@/lib/auth";
import type { CoursePayload } from "@/lib/course-shared";

// 코스 아카이브 — "세종철인 인증" 하나로 전 회원이 등록·수정·삭제 가능 (/competitions와 동일
// 원칙: 이 앱엔 개인별 로그인이 없음). 실패는 절대 조용히 삼키지 않는다 — 여기서 던진 에러를
// 호출부(클라이언트 컴포넌트)가 그대로 잡아서 사용자에게 눈에 보이는 배너로 알려야 한다.

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
  await requireSejongAuth();
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

  revalidatePath("/courses");
  return { id: created.id };
}

export async function updateCourseAction(id: string, payload: CoursePayload): Promise<void> {
  await requireSejongAuth();
  validatePayload(payload);

  await prisma.course.update({
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

  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
}

export async function deleteCourseAction(id: string): Promise<void> {
  await requireSejongAuth();
  await prisma.course.delete({ where: { id } });
  revalidatePath("/courses");
}
