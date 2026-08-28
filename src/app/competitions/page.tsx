import Link from "next/link";
import { redirect } from "next/navigation";
import { isSejongAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCompetitionRaces, listAvailableCompetitionYears } from "@/lib/competitions";
import { logoutSejongAction } from "./auth-actions";
import CompetitionsTable from "./CompetitionsTable";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const authed = await isSejongAuthed();
  if (!authed) redirect("/competitions/login?redirectTo=/competitions");

  const params = await searchParams;
  const years = await listAvailableCompetitionYears();
  const year = params.year && years.includes(Number(params.year)) ? Number(params.year) : years[0];

  const [races, members] = await Promise.all([
    getCompetitionRaces(year),
    prisma.member.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/" className="hover:underline">
                세종철인 훈련허브
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">대회 참가 계획</h1>
            <p className="text-sm text-ink-soft mt-1">
              누가 어떤 대회에 나가는지 서로 확인해요. 이름을 누르면 개인 통계로 이동합니다.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <form action={logoutSejongAction}>
              <input type="hidden" name="redirectTo" value="/competitions" />
              <button type="submit" className="text-sm text-ink-faint hover:text-ink-soft underline">
                인증 해제
              </button>
            </form>
            <Link href="/" className="text-sm font-medium text-accent hover:underline">
              ← 대시보드
            </Link>
          </div>
        </header>

        <div className="flex gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={`/competitions?year=${y}`}
              className={`text-sm font-medium px-3 py-1.5 rounded-sm border ${
                y === year ? "bg-accent text-accent-ink border-accent" : "border-line text-ink-soft hover:bg-paper-raised"
              }`}
            >
              {y}년
            </Link>
          ))}
        </div>

        <CompetitionsTable races={races} members={members} year={year} />

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          세종철인 훈련허브 · {year}년 대회 참가 계획
        </footer>
      </div>
    </div>
  );
}
