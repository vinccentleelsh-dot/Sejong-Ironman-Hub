import Link from "next/link";
import CourseForm from "../CourseForm";

export const dynamic = "force-dynamic";

// 코스 등록은 공개 기능 — 개인정보가 없는 공개 자료라 누구나 GPX를 올려 추가할 수 있다.
export default async function NewCoursePage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/courses" className="hover:underline">
                코스 아카이브
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">＋ 새 가이드</h1>
          </div>
          <Link href="/courses" className="text-sm font-medium text-accent hover:underline">
            ← 목록으로
          </Link>
        </header>

        <CourseForm />
      </div>
    </div>
  );
}
