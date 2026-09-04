import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/auth";

// 코스 아카이브는 등록은 공개, 수정·삭제는 운영진(ADMIN) 전용이지만(2026.09 결정), 그래도
// 실수로 지워질 수 있으니 competitions-audit.ts와 동일한 원칙으로 모든 변경을 기록한다 —
// 로컬 파일 스냅샷은 두지 않는다(Vercel에서 안 남는다는 걸 이미 확인했고, DB 감사로그가 더
// 확실한 복구 수단이라 굳이 이중으로 안 함). "관리자 페이지"(superadmin)에서만 조회·복구 가능.

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
