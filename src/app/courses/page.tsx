import Link from "next/link";
import { redirect } from "next/navigation";
import { isSejongAuthed } from "@/lib/auth";
import { getCourseCards } from "@/lib/courses";
import CourseLibrary from "./CourseLibrary";

export const dynamic = "force-dynamic";

export default async function CoursesLibraryPage() {
  const authed = await isSejongAuthed();
  if (!authed) redirect("/competitions/login?redirectTo=/courses");

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

        <CourseLibrary courses={courses} canEdit={authed} />
      </div>
    </div>
  );
}
