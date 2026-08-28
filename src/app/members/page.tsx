import Link from "next/link";
import { redirect } from "next/navigation";
import { isSejongAuthed } from "@/lib/auth";
import { getMemberRanking } from "@/lib/member-profile";

export const dynamic = "force-dynamic";

export default async function MembersRankingPage() {
  if (!(await isSejongAuthed())) redirect("/competitions/login?redirectTo=/members");

  const year = new Date().getFullYear();
  const ranking = await getMemberRanking(year);
  const active = ranking.filter((r) => r.isActive);
  const inactive = ranking.filter((r) => !r.isActive);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/" className="hover:underline">
                세종철인 훈련허브
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">{year}년 전체 순위</h1>
            <p className="text-sm text-ink-soft mt-1">이름을 눌러 개인 통계를 볼 수 있어요.</p>
          </div>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← 대시보드
          </Link>
        </header>

        <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left">
                <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint w-12">순위</th>
                <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">이름</th>
                <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint text-right">참석(훈련)</th>
                <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint text-right">세철포인트</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.memberId} className="border-b border-line hover:bg-paper">
                  <td className="px-2 py-2 font-mono-brand text-ink-faint [font-variant-numeric:tabular-nums]">{r.rank}</td>
                  <td className="px-2 py-2">
                    <Link href={`/members/${r.memberId}`} className="text-ink font-medium hover:text-accent hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right font-mono-brand text-ink-soft [font-variant-numeric:tabular-nums]">
                    {r.attendanceCount}회
                  </td>
                  <td className="px-2 py-2 text-right font-mono-brand text-ink font-medium [font-variant-numeric:tabular-nums]">
                    {r.points}점
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {inactive.length > 0 && (
          <details className="bg-paper-raised border border-line rounded-sm p-4">
            <summary className="font-mono-brand text-[10.5px] tracking-wide uppercase text-ink-faint cursor-pointer">
              탈퇴 회원 {inactive.length}명
            </summary>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {inactive.map((r) => (
                <li key={r.memberId}>
                  <Link href={`/members/${r.memberId}`} className="text-sm text-ink-faint hover:text-accent hover:underline">
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          세종철인 훈련허브 · {year}년 전체 순위
        </footer>
      </div>
    </div>
  );
}
