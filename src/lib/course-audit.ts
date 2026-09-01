import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/auth";

// 코스 아카이브도 "세종철인 인증" 하나로 전 회원이 등록·수정·삭제할 수 있으므로,
// competitions-audit.ts와 동일한 원칙으로 모든 변경을 기록한다 — 로컬 파일 스냅샷은 두지
// 않는다(Vercel에서 안 남는다는 걸 이미 확인했고, DB 감사로그가 더 확실한 복구 수단이라
// 굳이 이중으로 안 함). "관리자 페이지"(superadmin)에서만 조회·복구 가능.

export type CourseAction = "CREATE" | "UPDATE" | "DELETE";

export async function logCourseAction(action: CourseAction, course: Record<string, unknown>) {
  const { ipAddress, userAgent } = await getRequestMeta();
  await prisma.courseAuditLog.create({
    data: {
      action,
      courseSnapshot: JSON.stringify(course),
      courseId: (course.id as string) ?? null,
      ipAddress,
      userAgent,
    },
  });
}
