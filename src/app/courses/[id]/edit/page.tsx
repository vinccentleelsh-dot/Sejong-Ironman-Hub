import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getCourseDetail } from "@/lib/courses";
import CourseForm from "../../CourseForm";

export const dynamic = "force-dynamic";

// 수정은 운영진(ADMIN) 전용 — 열람·등록은 공개지만, 남의 등록물을 실수/장난으로 망가뜨릴 수
// 있는 수정·삭제만 잠근다(2026.09 결정).
export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isAdmin())) redirect(`/admin/login?redirectTo=/courses/${id}/edit`);

  const detail = await getCourseDetail(id);
  if (!detail) notFound();

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href={`/courses/${id}`} className="hover:underline">
                {detail.meta.name}
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">✏️ 정보·CP표 편집</h1>
          </div>
          <Link href={`/courses/${id}`} className="text-sm font-medium text-accent hover:underline">
            ← 취소
          </Link>
        </header>

        <CourseForm existing={detail} />
      </div>
    </div>
  );
}
