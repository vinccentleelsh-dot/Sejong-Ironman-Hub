import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isSejongAuthed } from "@/lib/auth";
import { getCourseDetail } from "@/lib/courses";
import CueSheetView from "./CueSheetView";

export const dynamic = "force-dynamic";

export default async function CourseCueSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ goal?: string }>;
}) {
  const { id } = await params;
  if (!(await isSejongAuthed())) redirect(`/competitions/login?redirectTo=/courses/${id}/cuesheet`);

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
