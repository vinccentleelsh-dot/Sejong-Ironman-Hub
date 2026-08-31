import Link from "next/link";
import { redirect } from "next/navigation";
import { isSejongAuthed } from "@/lib/auth";
import { getRaceParticipationLeaderboard } from "@/lib/dashboard-competitions";
import { nowKst } from "@/lib/now";

export const dynamic = "force-dynamic";

export default async function RaceParticipationPage() {
  if (!(await isSejongAuthed())) redirect("/competitions/login?redirectTo=/members/race-participation");

  const year = nowKst().getUTCFullYear();
  const ranking = await getRaceParticipationLeaderboard(year);

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
            <h1 className="font-display text-2xl text-ink">{year}년 대회 참가횟수</h1>
            <p className="text-sm text-ink-soft mt-1">올해 참가자 명단에 이름이 매칭된 회원 전원, 참가횟수 순입니다.</p>
          </div>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← 대시보드
          </Link>
        </header>

        <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-4">
          {ranking.length === 0 ? (
            <p className="text-sm text-ink-faint py-4 text-center">아직 참가 기록이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left">
                  <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint w-12">순위</th>
                  <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">이름</th>
                  <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint text-right">참가횟수</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.memberId} className="border-b border-line hover:bg-paper">
                    <td className="px-2 py-2 font-mono-brand text-ink-faint [font-variant-numeric:tabular-nums]">{r.rank}</td>
                    <td className="px-2 py-2">
                      <Link href={`/members/${r.memberId}`} className="text-ink font-medium hover:text-accent hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right font-mono-brand text-ink font-medium [font-variant-numeric:tabular-nums]">
                      {r.count}건
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/competitions" className="hover:underline">
            ← 대회 캘린더로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
