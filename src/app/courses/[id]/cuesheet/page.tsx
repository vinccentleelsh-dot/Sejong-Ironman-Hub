import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourseDetail } from "@/lib/courses";
import CueSheetView from "./CueSheetView";

export const dynamic = "force-dynamic";

// 큐시트도 코스 아카이브의 일부 — 개인정보가 없는 공개 자료라 인증 없이 누구나 볼 수 있다.
export default async function CourseCueSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ goal?: string }>;
}) {
  const { id } = await params;

  const detail = await getCourseDetail(id);
  if (!detail) notFound();

  const { goal } = await searchParams;
  const parsedGoal = goal ? Number(goal) : NaN;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="print:hidden border-b-2 border-ink pb-4">
          <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
            <Link href="/courses" className="hover:underline">
              코스 아카이브
            </Link>
            {" / "}
            <Link href={`/courses/${detail.id}`} className="hover:underline">
              {detail.meta.name || "코스"}
            </Link>
            {" / 큐시트"}
          </p>
        </header>

        <CueSheetView
          appState={{
            track: detail.track,
            cps: detail.cps,
            peaks: detail.peaks,
            startDT: detail.startDT,
            meta: detail.meta,
          }}
          courseId={detail.id}
          initialGoalHours={Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : null}
        />
      </div>
    </div>
  );
}
