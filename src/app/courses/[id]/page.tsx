import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getCourseDetail } from "@/lib/courses";
import CourseGuideView from "../CourseGuideView";

export const dynamic = "force-dynamic";

// 코스 아카이브 상세는 공개 자료 — 열람은 누구나, 수정·삭제 버튼만 운영진(ADMIN)에게 보인다.
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canManage = await isAdmin();

  const detail = await getCourseDetail(id);
  if (!detail) notFound();

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="border-b-2 border-ink pb-4">
          <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
            <Link href="/courses" className="hover:underline">
              코스 아카이브
            </Link>
          </p>
        </header>

        <CourseGuideView
          appState={{
            track: detail.track,
            cps: detail.cps,
            peaks: detail.peaks,
            startDT: detail.startDT,
            meta: detail.meta,
          }}
          mode="detail"
          courseId={detail.id}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
