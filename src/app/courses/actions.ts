"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logCourseAction } from "@/lib/course-audit";
import type { CoursePayload } from "@/lib/course-shared";

// 코스 아카이브 — 개인정보가 없는 공개 자료라 열람·등록·수정·삭제 전부 인증 없이 누구나
// 가능하다 (2026.09 결정 → 운영진 전용으로 한 번 잠갔다가, "잘못 입력하는 경우가 종종
// 있는데 감사로그로 복구되니까 오히려 다시 열어도 된다"는 판단으로 재개방). 실수로 지워지는
// 것에 대한 안전망은 감사로그(CourseAuditLog) + 관리자 페이지 복구로 확보한다. 실패는 절대
// 조용히 삼키지 않는다 — 여기서 던진 에러를 호출부(클라이언트 컴포넌트)가 그대로 잡아서
// 사용자에게 눈에 보이는 배너로 알려야 한다.

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
  const deleted = await prisma.course.delete({ where: { id } });
  await logCourseAction("DELETE", deleted);
  revalidatePath("/courses");
}
