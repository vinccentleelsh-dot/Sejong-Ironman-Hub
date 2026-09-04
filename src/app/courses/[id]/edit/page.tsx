import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseDetail } from "@/lib/courses";
import CourseForm from "../../CourseForm";

export const dynamic = "force-dynamic";

// 수정도 공개 — 잘못 입력해도 감사로그(CourseAuditLog)로 복구할 수 있어서 굳이 잠그지
// 않기로 함(2026.09 재결정, 운영진 전용으로 한 번 잠갔다가 다시 풀었다).
export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
