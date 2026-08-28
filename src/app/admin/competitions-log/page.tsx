import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { restoreRaceAction } from "./actions";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "등록",
  UPDATE: "수정",
  DELETE: "삭제",
  JOIN: "참가 추가",
  LEAVE: "참가 제외",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-good bg-good-soft",
  UPDATE: "text-accent bg-accent-soft",
  DELETE: "text-pending bg-pending-soft",
  JOIN: "text-accent bg-accent-soft",
  LEAVE: "text-ink-faint bg-line",
};

function fmtDateTime(d: Date) {
  return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function CompetitionsLogPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin/login?redirectTo=/admin/competitions-log");

  const logs = await prisma.competitionAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="border-b-2 border-ink pb-4">
          <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
            <Link href="/competitions" className="hover:underline">
              대회 참가 계획
            </Link>
          </p>
          <h1 className="font-display text-2xl text-ink">대회기록 변경 로그</h1>
          <p className="text-sm text-ink-soft mt-1">
            최근 200건. 누가 언제 뭘 바꿨는지, IP까지 기록돼요 (사설망에서는 정확하지 않을 수
            있어요). 삭제 건은 "복구"로 되살릴 수 있습니다.
          </p>
        </header>

        <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-line-strong text-left">
                <th className="px-3 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint whitespace-nowrap">시각</th>
                <th className="px-3 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">동작</th>
                <th className="px-3 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">대회명</th>
                <th className="px-3 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">IP</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                let raceName = "";
                try {
                  raceName = JSON.parse(log.raceSnapshot).raceName ?? "";
                } catch {
                  raceName = "";
                }
                return (
                  <tr key={log.id} className="border-b border-line">
                    <td className="px-3 py-2 font-mono-brand text-ink-faint whitespace-nowrap">
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? ""}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink">{raceName}</td>
                    <td className="px-3 py-2 font-mono-brand text-ink-faint text-xs whitespace-nowrap">
                      {log.ipAddress ?? "알 수 없음"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {log.action === "DELETE" &&
                        (log.restoredAt ? (
                          <span className="text-xs text-ink-faint">복구됨 ({fmtDateTime(log.restoredAt)})</span>
                        ) : (
                          <form action={restoreRaceAction}>
                            <input type="hidden" name="logId" value={log.id} />
                            <button type="submit" className="text-xs text-accent hover:underline">
                              복구
                            </button>
                          </form>
                        ))}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-faint">
                    아직 기록된 변경 이력이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/competitions" className="hover:underline">
            ← 대회 참가 계획으로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
