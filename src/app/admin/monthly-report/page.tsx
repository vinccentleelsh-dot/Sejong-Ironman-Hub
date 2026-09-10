import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getMonthlyReport } from "@/lib/monthly-report";
import { RACE_CATEGORY_COLOR } from "@/lib/competitions-shared";
import PrintButton from "./PrintButton";
import WeeklyBarChart from "./WeeklyBarChart";

export const dynamic = "force-dynamic";

const CARD = "bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-6 print:break-after-page";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-accent text-accent-ink text-xs font-bold rounded-full px-3 py-1 mb-3">
      {children}
    </span>
  );
}

function CategoryTag({ category }: { category: string }) {
  const c = RACE_CATEGORY_COLOR[category] ?? { text: "var(--ink-soft)", bg: "var(--line)" };
  return (
    <span
      className="inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap"
      style={{ color: c.text, backgroundColor: c.bg }}
    >
      {category}
    </span>
  );
}

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-paper rounded-sm px-3 py-3 text-center">
      <b className="block font-display text-2xl text-ink [font-variant-numeric:tabular-nums]">
        {value}
        {unit ? <span className="text-sm text-ink-soft ml-0.5">{unit}</span> : null}
      </b>
    </div>
  );
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function AdminMonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login?redirectTo=/admin/monthly-report");

  const now = new Date();
  const defaultYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const defaultMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth(); // 지난달(전월) 기본값

  const sp = await searchParams;
  const year = Number(sp.year) || defaultYear;
  const month = Number(sp.month) || defaultMonth;

  const report = await getMonthlyReport(year, month);

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getUTCFullYear() - 2 + i);

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5 report-print">
        <header className="print:hidden flex items-center justify-between border-b-2 border-ink pb-4 flex-wrap gap-3">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/admin/settings" className="hover:underline">
                관리자 페이지
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">📰 월간 리포트 출력</h1>
            <p className="text-sm text-ink-soft mt-1">훈련 현황·이달의 세철포인트·대회 소식을 한 장으로 뽑아요.</p>
          </div>
          <Link href="/admin/settings" className="text-sm font-medium text-accent hover:underline">
            ← 관리자 페이지
          </Link>
        </header>

        <form method="get" className="print:hidden bg-paper border border-line rounded-sm p-4 flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            연도
            <select name="year" defaultValue={year} className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm">
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            월
            <select name="month" defaultValue={month} className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-2 hover:opacity-90">
            리포트 보기
          </button>
          <PrintButton />
        </form>

        {/* ---------------- 표지 ---------------- */}
        <div className={CARD}>
          <Badge>{report.year}년 {report.month}월</Badge>
          <h2 className="font-display text-3xl text-ink leading-tight mb-2">
            {report.month}월 결산 &<br />
            <span className="text-accent">{report.nextMonth}월</span> 대회 예고
          </h2>
          <p className="text-sm text-ink-soft">함께 흘린 땀, 함께 나눈 이야기 — 세종철인 훈련허브가 전해드리는 이달의 기록입니다.</p>
          <p className="text-xs text-ink-faint mt-4">🔗 sejong-ironman-hub.vercel.app · 생성일 {report.generatedAt}</p>
        </div>

        {/* ---------------- 훈련 현황 ---------------- */}
        <div className={CARD}>
          <Badge>📊 {report.month}월 훈련 현황</Badge>
          <h3 className="font-display text-xl text-ink mb-4">함께 흘린 땀, {report.month}월의 기록</h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div>
              <StatTile label="세션" value={String(report.training.sessionCount)} unit="회" />
              <p className="text-center text-[10px] text-ink-faint mt-1">{report.month}월 정기훈련</p>
            </div>
            <div>
              <StatTile label="연인원" value={String(report.training.totalAttendance)} unit="명" />
              <p className="text-center text-[10px] text-ink-faint mt-1">누적 참석 연인원</p>
            </div>
            <div>
              <StatTile label="평균" value={report.training.averageAttendance.toFixed(1)} unit="명" />
              <p className="text-center text-[10px] text-ink-faint mt-1">회당 평균 참석</p>
            </div>
            <div>
              <StatTile
                label="최다"
                value={report.training.maxAttendance ? String(report.training.maxAttendance.count) : "—"}
                unit="명"
              />
              <p className="text-center text-[10px] text-ink-faint mt-1">
                최다 참석{report.training.maxAttendance ? ` (${report.training.maxAttendance.date.slice(5)})` : ""}
              </p>
            </div>
          </div>
          <WeeklyBarChart data={report.training.weekly} />
        </div>

        {/* ---------------- 이달의 세철포인트 TOP5 ---------------- */}
        <div className={CARD}>
          <Badge>🏆 {report.month}월 세철포인트 TOP5</Badge>
          <h3 className="font-display text-xl text-ink mb-4">이달의 출석왕은?</h3>
          {report.pointsTop.length === 0 ? (
            <p className="text-sm text-ink-faint">이 달엔 세철포인트 기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.pointsTop.map((r) => (
                <li
                  key={r.memberId}
                  className="flex items-center gap-3 rounded-sm px-3 py-2.5"
                  style={{ background: r.rank === 1 ? "var(--gold-soft)" : "var(--paper)" }}
                >
                  <span className="w-8 text-center font-mono-brand font-bold text-ink-soft">
                    {r.rank <= 3 ? RANK_MEDAL[r.rank] : `공동${r.rank}`}
                  </span>
                  <span className="flex-1 text-ink font-medium">{r.name}</span>
                  <span className="font-mono-brand font-bold text-accent [font-variant-numeric:tabular-nums]">{r.points}P</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---------------- 이달 대회 출전 소식 ---------------- */}
        <div className={CARD}>
          <Badge>🎉 {report.month}월 대회 출전 소식</Badge>
          {report.finishedRaces.length === 0 ? (
            <>
              <h3 className="font-display text-xl text-ink mb-2">이 달은 대회 출전 기록이 없어요</h3>
              <p className="text-sm text-ink-faint">다음 달엔 어떤 소식이 있을지 아래에서 확인해보세요.</p>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl text-ink mb-4">
                {report.finishedRaces.length}개 대회에서 세종철인이 함께했어요!
              </h3>
              <ul className="flex flex-col gap-2">
                {report.finishedRaces.map((r) => (
                  <li key={r.id} className="bg-paper rounded-sm px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-ink font-medium">{r.raceName}</span>
                      <span className="text-xs text-ink-faint font-mono-brand">{r.dateLabel}</span>
                      <CategoryTag category={r.category} />
                    </div>
                    <div className="text-right">
                      <span className="font-mono-brand font-bold text-accent">{r.participantCount}명</span>
                      <span className="text-xs text-ink-faint"> 출전</span>
                      {r.participantNames.length > 0 && (
                        <p className="text-xs text-ink-faint mt-0.5">{r.participantNames.join(", ")}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ---------------- 다음달 대회 예고 ---------------- */}
        <div className={CARD}>
          <Badge>📢 {report.nextMonth}월 대회 예고</Badge>
          {report.upcomingRaces.length === 0 ? (
            <h3 className="font-display text-xl text-ink">{report.nextMonth}월엔 아직 예정된 대회가 없어요</h3>
          ) : (
            <>
              <h3 className="font-display text-xl text-ink mb-4">
                {report.nextMonth}월, 세종철인은 {report.upcomingRaces.length}개 대회에 도전!
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {report.upcomingRaces.map((r) => (
                  <div key={r.id} className="bg-paper rounded-sm px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-ink font-medium text-sm truncate">{r.raceName}</p>
                      <p className="text-[11px] text-ink-faint font-mono-brand">
                        {r.dateLabel} · <CategoryTag category={r.category} />
                      </p>
                    </div>
                    <span className="font-mono-brand font-bold text-ink shrink-0">{r.participantCount}명</span>
                  </div>
                ))}
              </div>
              <div className="bg-accent text-accent-ink rounded-sm px-3 py-2.5 flex items-center justify-between font-bold">
                <span>{report.nextMonth}월 총 참가 연인원</span>
                <span className="font-mono-brand">{report.upcomingTotalParticipants}명</span>
              </div>
            </>
          )}
        </div>

        {/* ---------------- 클로징 ---------------- */}
        <div className={`${CARD} print:!break-after-auto`}>
          <Badge>💬 함께 달려요</Badge>
          <h3 className="font-display text-2xl text-ink mb-2">
            {report.nextMonth}월에도 <span className="text-accent">세종철인</span>과 함께
          </h3>
          <p className="text-sm text-ink-soft mb-3">
            더 자세한 훈련·대회 기록은 세종철인 훈련허브에서 확인하실 수 있습니다.
            <br />
            지난 기록, 훈련/대회 계획, 코스 아카이브를 한곳에서 만나보세요!
          </p>
          <p className="text-xs text-ink-faint bg-paper rounded-sm px-3 py-2 mb-3">
            🔒 대회기록 열람 안내 — 대회 캘린더는 회원 전용입니다. 클럽 비밀번호를 입력하면 열람·등록·참가 신청까지 모두 가능합니다.
          </p>
          <p className="font-mono-brand text-sm text-accent">🔗 sejong-ironman-hub.vercel.app</p>
        </div>

        <p className="print:hidden text-xs text-ink-faint">
          * 참가자 이름은 공유용 출력물이라 실명 대신 마스킹해서 표시돼요(예: 김●●). 인쇄 대화상자에서
          "PDF로 저장"을 선택하면 예전 PDF와 같은 방식으로 파일로 받을 수 있어요.
        </p>
      </div>
    </div>
  );
}
