import Link from "next/link";
import { listAvailableYears, getYearSummary, getMonthSummary } from "@/lib/archive";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { SessionCategory } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function fmtNum(n: number, digits = 0) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex-1 min-w-[110px] bg-paper-raised border border-line rounded-sm px-4 py-3 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
      <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-ink-faint mb-1.5">{label}</p>
      <p className="font-display text-2xl leading-none text-ink [font-variant-numeric:tabular-nums]">
        {value}
        {unit ? <span className="text-sm font-body text-ink-soft ml-1">{unit}</span> : null}
      </p>
    </div>
  );
}

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월",
];

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const years = await listAvailableYears();

  if (years.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-ink-faint">아직 축적된 훈련 데이터가 없습니다.</p>
      </div>
    );
  }

  const year = params.year && years.includes(Number(params.year)) ? Number(params.year) : years[0];
  const month = params.month ? Number(params.month) : null;
  const validMonth = month && month >= 1 && month <= 12 ? month : null;

  const yearSummary = await getYearSummary(year);
  const monthSummary = validMonth ? await getMonthSummary(year, validMonth) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/" className="hover:underline">
                세종철인 훈련허브
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">연/월 히스토리</h1>
          </div>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← 대시보드
          </Link>
        </header>

        {/* 연도 선택 */}
        <div className="flex gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={`/archive?year=${y}`}
              className={`text-sm font-medium px-3 py-1.5 rounded-sm border ${
                y === year ? "bg-accent text-accent-ink border-accent" : "border-line text-ink-soft hover:bg-paper-raised"
              }`}
            >
              {y}년
            </Link>
          ))}
        </div>

        {/* 연도 요약 */}
        <div className="flex flex-wrap gap-3">
          <StatCard label={`${year}년 전체 참석자 수`} value={fmtNum(yearSummary.totalAttendance)} unit="명" />
          <StatCard label="회당 평균 참석" value={fmtNum(yearSummary.averageAttendance, 1)} unit="명" />
          <StatCard label="진행된 세션" value={fmtNum(yearSummary.sessionCount)} unit="회" />
          <StatCard
            label="1회 최다인원"
            value={yearSummary.maxSingleDayAttendance ? fmtNum(yearSummary.maxSingleDayAttendance.count) : "–"}
            unit={yearSummary.maxSingleDayAttendance ? "명" : undefined}
          />
        </div>

        {/* 월별 그리드 */}
        <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-3">
            {year}년 월별 참석 현황
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {yearSummary.months.map((m) => (
              <Link
                key={m.month}
                href={`/archive?year=${year}&month=${m.month}`}
                className={`rounded-sm border px-3 py-2.5 text-center transition-colors ${
                  validMonth === m.month
                    ? "bg-accent text-accent-ink border-accent"
                    : m.hasSessions
                    ? "border-line hover:bg-accent-soft"
                    : "border-line text-ink-faint"
                }`}
              >
                <p className="text-sm font-medium">{MONTH_LABELS[m.month - 1]}</p>
                {m.hasSessions ? (
                  <p className={`text-xs mt-0.5 font-mono-brand [font-variant-numeric:tabular-nums] ${validMonth === m.month ? "" : "text-ink-soft"}`}>
                    {m.sessionCount}회 · 평균 {fmtNum(m.averageAttendance, 1)}명
                  </p>
                ) : (
                  <p className="text-xs mt-0.5 font-mono-brand">—</p>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* 연간 세철포인트 Top10 */}
        <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-3">
            {year}년 세철포인트 Top 10
          </p>
          {yearSummary.pointsLeaderboard.length === 0 ? (
            <p className="text-sm text-ink-faint">데이터 없음</p>
          ) : (
            <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {yearSummary.pointsLeaderboard.map((p, i) => (
                <li key={p.memberId} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-mono-brand text-[11px] text-ink-faint w-4">{i + 1}</span>
                    <Link href={`/members/${p.memberId}`} className="text-ink font-medium hover:text-accent hover:underline">
                      {p.name}
                    </Link>
                  </span>
                  <span className="font-mono-brand text-ink-soft [font-variant-numeric:tabular-nums]">{p.points}점</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 월 상세 */}
        {monthSummary && (
          <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">
                {year}년 {MONTH_LABELS[monthSummary.month - 1]} 상세
              </p>
              <Link href={`/archive?year=${year}`} className="text-xs text-ink-faint hover:text-ink-soft">
                월 선택 해제 ✕
              </Link>
            </div>

            {monthSummary.sessionCount === 0 ? (
              <p className="text-sm text-ink-faint">
                아직 지난 세션이 없습니다 {monthSummary.month > new Date().getUTCMonth() + 1 || year > new Date().getUTCFullYear() ? "(미래 달)" : ""}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 mb-4">
                  <StatCard label="전체 참석자 수" value={fmtNum(monthSummary.totalAttendance)} unit="명" />
                  <StatCard label="회당 평균 참석" value={fmtNum(monthSummary.averageAttendance, 1)} unit="명" />
                  <StatCard label="세션 수" value={fmtNum(monthSummary.sessionCount)} unit="회" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-ink-faint mb-1.5">이 달의 참석 Top5</p>
                    <ol className="space-y-1">
                      {monthSummary.attendanceLeaderboard.map((p, i) => (
                        <li key={p.memberId} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="font-mono-brand text-[11px] text-ink-faint mr-2">{i + 1}</span>
                            <Link href={`/members/${p.memberId}`} className="text-ink hover:text-accent hover:underline">
                              {p.name}
                            </Link>
                          </span>
                          <span className="font-mono-brand text-ink-soft">{p.count}회</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint mb-1.5">이 달의 세철포인트 Top5</p>
                    <ol className="space-y-1">
                      {monthSummary.pointsLeaderboard.map((p, i) => (
                        <li key={p.memberId} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="font-mono-brand text-[11px] text-ink-faint mr-2">{i + 1}</span>
                            <Link href={`/members/${p.memberId}`} className="text-ink hover:text-accent hover:underline">
                              {p.name}
                            </Link>
                          </span>
                          <span className="font-mono-brand text-ink-soft">{p.points}점</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-line-strong text-left">
                        <th className="px-2 py-1.5 font-mono-brand text-[10.5px] uppercase text-ink-faint">날짜</th>
                        <th className="px-2 py-1.5 font-mono-brand text-[10.5px] uppercase text-ink-faint">분류</th>
                        <th className="px-2 py-1.5 font-mono-brand text-[10.5px] uppercase text-ink-faint">참석</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthSummary.sessions.map((s) => (
                        <tr key={s.id} className="border-b border-line align-top">
                          <td className="px-2 py-1.5 font-mono-brand text-ink-soft whitespace-nowrap">{s.date}</td>
                          <td className="px-2 py-1.5 text-ink-soft">
                            {CATEGORY_LABELS[s.category as SessionCategory]}
                            {s.title ? ` · ${s.title}` : ""}
                          </td>
                          <td className="px-2 py-1.5">
                            {s.attendees.length > 0 ? (
                              <details className="group">
                                <summary className="cursor-pointer list-none font-mono-brand text-ink font-medium [font-variant-numeric:tabular-nums] hover:text-accent">
                                  {s.attendeeCount}명 <span className="text-[10px] text-ink-faint group-open:hidden">▸ 명단 보기</span>
                                </summary>
                                <p className="text-xs text-ink-faint mt-1 leading-relaxed">
                                  {s.attendees.map((a, i) => (
                                    <span key={a.memberId}>
                                      {i > 0 && ", "}
                                      <Link href={`/members/${a.memberId}`} className="hover:text-accent hover:underline">
                                        {a.name}
                                      </Link>
                                    </span>
                                  ))}
                                </p>
                              </details>
                            ) : (
                              <span className="font-mono-brand text-ink-faint">0명</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          세종철인 훈련허브 · 연/월 히스토리
        </footer>
      </div>
    </div>
  );
}
