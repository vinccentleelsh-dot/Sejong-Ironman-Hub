import Link from "next/link";
import { getCourseCards } from "@/lib/courses";
import CourseLibrary from "./CourseLibrary";

export const dynamic = "force-dynamic";

// 코스 아카이브는 개인정보가 없는 공개 자료라 열람·등록·수정·삭제 전부 인증이 필요 없다
// (2026.09 재결정 — 운영진 전용으로 한 번 잠갔다가, 잘못 입력해도 감사로그로 복구되니
// 다시 풀었다).
export default async function CoursesLibraryPage() {
  const courses = await getCourseCards();

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4 flex-wrap gap-3">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/" className="hover:underline">
                세종철인 훈련허브
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">🧭 코스 아카이브</h1>
            <p className="text-sm text-ink-soft mt-1">GPX를 올리면 코스 가이드가 되고, 계속 쌓입니다.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/courses/new"
              className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-2 hover:opacity-90"
            >
              ＋ 새 가이드
            </Link>
            <Link href="/" className="text-sm font-medium text-accent hover:underline">
              ← 대시보드
            </Link>
          </div>
        </header>

        <CourseLibrary courses={courses} />
      </div>
    </div>
  );
}
