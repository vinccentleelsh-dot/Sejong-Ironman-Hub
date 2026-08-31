import Link from "next/link";
import { getDashboardStats } from "@/lib/dashboard";
import { getCompetitionDashboardStats, getRaceParticipationLeaderboard } from "@/lib/dashboard-competitions";
import { getCompetitionRaces } from "@/lib/competitions";
import { RACE_CATEGORY_COLOR } from "@/lib/competitions-shared";
import { nowKst } from "@/lib/now";
import { isSejongAuthed } from "@/lib/auth";
import DonutChart from "./DonutChart";

const CATEGORY_CHART_COLOR: Record<string, string> = {
  철인3종: "var(--chart-tri)",
  마라톤: "var(--chart-marathon)",
  트레일러닝: "var(--chart-trail)",
  그란폰도: "var(--chart-granfondo)",
  수영: "var(--chart-swim)",
};

// 대시보드는 전체 공개로 유지하되, 참가자 이름은 세종철인 인증 전에는 가린다 (2026.09 결정).
// CSS로 블러만 걸면 페이지 소스에 실명이 그대로 남아 보호가 안 되므로, 인증 전에는 애초에
// 마스킹된 값만 서버에서 내려보낸다 — 실명은 인증됐을 때만 클라이언트에 도달한다.
function maskName(name: string): string {
  if (name.length <= 1) return "●";
  return name[0] + "●".repeat(name.length - 1);
}

// Windows 한글 경로 / App Router 캐싱 방어 원칙 (요구사항 정의서 10번) — 항상 최신 데이터로 렌더링
export const dynamic = "force-dynamic";

function fmtNum(n: number, digits = 0) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex-1 min-w-[120px] bg-paper-raised border border-line rounded-sm px-4 py-3 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
      <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-ink-faint mb-1.5">{label}</p>
      <p className="font-display text-2xl leading-none text-ink [font-variant-numeric:tabular-nums]">
        {value}
        {unit ? <span className="text-sm font-body text-ink-soft ml-1">{unit}</span> : null}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  moreHref,
  moreLabel,
  children,
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">{title}</p>
        {moreHref && (
          <Link href={moreHref} className="text-xs text-ink-faint hover:text-accent hover:underline">
            {moreLabel ?? "전체 순위 보기"} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function DailyTrendChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-faint">아직 지난 훈련일 데이터가 없습니다.</p>;
  }
  const w = 600;
  const h = 140;
  const padLeft = 28; // y축 숫자 라벨 자리
  const padBottom = 20; // x축 날짜 라벨 자리
  const plotW = w - padLeft;
  const plotH = h - padBottom;
  const max = Math.max(...data.map((d) => d.count), 1);
  // y축 눈금 — 0 / 중간 / 최대, "명" 단위 표시
  const yTicks = [0, Math.round(max / 2), max];
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const yFor = (count: number) => plotH - (count / max) * (plotH - 10) - 5;
  const points = data.map((d, i) => `${padLeft + i * stepX},${yFor(d.count)}`);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-36">
        {/* y축 그리드라인 + 라벨 ("명" 단위) */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padLeft}
              x2={w}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="var(--line)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={0} y={yFor(t) + 3} fontSize="9" fill="var(--ink-faint)" fontFamily="var(--font-mono)">
              {t}명
            </text>
          </g>
        ))}

        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <g key={d.date + i}>
            <circle cx={padLeft + i * stepX} cy={yFor(d.count)} r={2.5} fill="var(--accent)" />
            <text
              x={padLeft + i * stepX}
              y={h - 4}
              fontSize="9"
              fill="var(--ink-faint)"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {d.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <p className="font-mono-brand text-[10.5px] text-ink-faint mt-1">
        세로축 단위: 참석인원(명) · 가로축: 훈련일(MM-DD)
      </p>
    </div>
  );
}

function Leaderboard({
  items,
  valueLabel,
  authed,
}: {
  items: Array<{ memberId: string; name: string; value: number }>;
  valueLabel: string;
  authed: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-faint">데이터 없음</p>;
  }
  return (
    <ol className="space-y-1.5">
      {items.map((it, i) => (
        <li key={it.memberId} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span className="font-mono-brand text-[11px] text-ink-faint w-4">{i + 1}</span>
            {authed ? (
              <Link href={`/members/${it.memberId}`} className="text-ink font-medium hover:text-accent hover:underline">
                {it.name}
              </Link>
            ) : (
              <span className="text-ink-faint font-medium blur-[3px] select-none" aria-label="비공개 (세종철인 인증 필요)">
                {maskName(it.name)}
              </span>
            )}
          </span>
          <span className="font-mono-brand text-ink-soft [font-variant-numeric:tabular-nums]">
            {fmtNum(it.value)}
            {valueLabel}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function DashboardPage() {
  const authed = await isSejongAuthed();
  const now = nowKst();
  const stats = await getDashboardStats(now);
  const raceStats = await getCompetitionDashboardStats(now.getUTCFullYear());
  const raceParticipationLeaderboard = await getRaceParticipationLeaderboard(now.getUTCFullYear());
  const thisMonthRaces = (await getCompetitionRaces(now.getUTCFullYear())).filter((r) => r.month === now.getUTCMonth() + 1);

  const trainingTotalKm = stats.distances.swimKm + stats.distances.bikeKm + stats.distances.runKm;
  const courseDistances = stats.courseDistances;
  const grandTotal = {
    swimKm: stats.distances.swimKm + raceStats.distances.swimKm,
    bikeKm: stats.distances.bikeKm + raceStats.distances.bikeKm,
    runKm: stats.distances.runKm + raceStats.distances.runKm,
    // 종목별 합이 아니라 두 출처의 "전체" 값을 그대로 더한 것 — 대회 쪽은 철인3종처럼
    // 세부 종목 분해가 안 되는 대회가 있어서, 종목별 합만으로는 실제보다 작게 나올 수 있음.
    totalKm: trainingTotalKm + raceStats.distances.totalKm,
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              Sejong Triathlon Club
            </p>
            <h1 className="font-display text-2xl text-ink">세종철인 훈련허브</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/archive" className="text-sm font-medium text-accent hover:underline">
              지난 기록
            </Link>
            <Link href="/competitions" className="text-sm font-medium text-accent hover:underline">
              대회 계획
            </Link>
            <Link href="/training-plan" className="text-sm font-medium text-accent hover:underline">
              훈련 계획
            </Link>
            <Link href="/courses" className="text-sm font-medium text-accent hover:underline">
              코스 아카이브
            </Link>
            <p className="font-mono-brand text-xs text-ink-faint">{stats.asOf}일 현재 기준</p>
          </div>
        </header>

        {/* Row 1 — 상단 통계 카드 */}
        <div className="flex flex-wrap gap-3">
          <StatCard label="연간 전체 참석자 수" value={fmtNum(stats.yearTotalAttendance)} unit="명" />
          <StatCard label="연간 평균 참석인원" value={fmtNum(stats.yearAverageAttendance, 1)} unit="명" />
          <StatCard label="이번달 전체 참석자 수" value={fmtNum(stats.monthTotalAttendance)} unit="명" />
          <StatCard label="이번달 평균 참석인원" value={fmtNum(stats.monthAverageAttendance, 1)} unit="명" />
          <StatCard
            label="1회 최다인원"
            value={stats.maxSingleDayAttendance ? fmtNum(stats.maxSingleDayAttendance.count) : "–"}
            unit={stats.maxSingleDayAttendance ? "명" : undefined}
          />
        </div>
        <p className="text-xs text-ink-faint -mt-2">
          * 참석 통계는 정기훈련·공식행사만 집계 (대회 참가 기록은 세철포인트에만 반영)
        </p>

        {/* Row 2 — 일별 참석인원 추이 */}
        <SectionCard title="일별 참석인원 추이 · 최근 10개 훈련일 (정기훈련·공식행사)">
          <DailyTrendChart data={stats.dailyTrend} />
        </SectionCard>

        {/* Row 3 — 3분할 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SectionCard title="월별 평균 참석인원 · 최근 5개월">
            {stats.monthlyAverages.length === 0 ? (
              <p className="text-sm text-ink-faint">데이터 없음</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.monthlyAverages.map((m) => (
                  <li key={m.month} className="flex items-center justify-between text-sm">
                    <span className="font-mono-brand text-ink-soft">{m.month}</span>
                    <span className="text-ink font-medium [font-variant-numeric:tabular-nums]">
                      {fmtNum(m.average, 1)}명
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="올해 세철포인트 Top 5" moreHref="/members">
            <Leaderboard
              items={stats.pointsLeaderboard.map((p) => ({ memberId: p.memberId, name: p.name, value: p.points }))}
              valueLabel="점"
            authed={authed}
            />
          </SectionCard>
          <SectionCard title="이달의 참석 Top 5" moreHref="/members/monthly" moreLabel="이달의 순위 보기">
            <Leaderboard
              items={stats.monthlyAttendanceLeaderboard.map((p) => ({ memberId: p.memberId, name: p.name, value: p.count }))}
              valueLabel="회"
              authed={authed}
            />
          </SectionCard>
        </div>

        {/* Row 4 — 올해 누적 종목별 거리 */}
        <SectionCard title="올해 누적 거리 (클럽 전체 · 정기훈련·공식행사)">
          {stats.distances.hasAnyData ? (
            <>
              <div className="flex gap-6 font-mono-brand [font-variant-numeric:tabular-nums]">
                <span>Swim {fmtNum(stats.distances.swimKm, 1)}km</span>
                <span>Bike {fmtNum(stats.distances.bikeKm, 1)}km</span>
                <span>Run {fmtNum(stats.distances.runKm, 1)}km</span>
              </div>
              <p className="text-xs text-ink-faint mt-1.5">
                * 세션 거리 × 그날 출석 인원수를 모두 더한 값 (참석자 전원이 그날 세션 거리를 그대로
                소화했다고 가정한 연인원 기준 합계)
              </p>

              <div className="flex gap-6 font-mono-brand [font-variant-numeric:tabular-nums] mt-4 pt-4 border-t border-line">
                <span>Swim {fmtNum(courseDistances.swimKm, 1)}km</span>
                <span>Bike {fmtNum(courseDistances.bikeKm, 1)}km</span>
                <span>Run {fmtNum(courseDistances.runKm, 1)}km</span>
              </div>
              <p className="text-xs text-ink-faint mt-1.5">
                * 위와 달리 출석 인원수는 곱하지 않고, 세션 코스 거리 자체만 한 번씩 더한 값
                (인원수 무관 · 순수 코스 거리 총합)
              </p>
            </>
          ) : (
            <p className="text-sm text-pending bg-pending-soft border border-pending/30 rounded-sm px-3 py-2">
              아직 세션별 거리 데이터가 입력되지 않았습니다 — 훈련계획 입력 페이지에서 세션마다 종목별 거리를
              등록하면 여기 자동으로 반영됩니다.
            </p>
          )}
        </SectionCard>

        {/* Row 4.5 — 이달의 대회계획 */}
        <SectionCard title={`이달의 대회계획 · ${now.getUTCMonth() + 1}월`} moreHref="/competitions" moreLabel="대회 캘린더 보기">
          {thisMonthRaces.length === 0 ? (
            <p className="text-sm text-ink-faint">이번 달 예정된 대회가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {thisMonthRaces.map((race) => {
                const c = RACE_CATEGORY_COLOR[race.category] ?? { text: "var(--ink-soft)", bg: "var(--line)" };
                return (
                  <li key={race.id} className="py-2 text-sm flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-brand text-ink-faint whitespace-nowrap">{race.dateLabel}</span>
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap"
                        style={{ color: c.text, backgroundColor: c.bg }}
                      >
                        {race.category}
                      </span>
                      <span className="text-ink font-medium">{race.raceName}</span>
                    </div>
                    <p className="text-xs text-ink-faint">
                      {race.isPending
                        ? "참가자 미정"
                        : race.participants.length > 0
                        ? race.participants.map((p, i) => (
                            <span key={p.name + i}>
                              {i > 0 && ", "}
                              {!authed ? (
                                <span className="blur-[3px] select-none" aria-label="비공개 (세종철인 인증 필요)">
                                  {maskName(p.name)}
                                </span>
                              ) : p.memberId ? (
                                <Link href={`/members/${p.memberId}`} className="text-ink-soft hover:text-accent hover:underline">
                                  {p.name}
                                </Link>
                              ) : (
                                p.name
                              )}
                            </span>
                          ))
                        : "참가자 없음"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* Row 5 — 대회 통계 */}
        <SectionCard title={`${now.getUTCFullYear()}년 대회 통계`} moreHref="/competitions" moreLabel="대회 캘린더 보기">
          <div className="flex flex-wrap gap-3 mb-4">
            <StatCard label="전체 참가대회수" value={fmtNum(raceStats.raceCount)} unit="건" />
            <StatCard label="총 참가자" value={fmtNum(raceStats.totalParticipants)} unit="명" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="bg-paper border border-line rounded-sm p-3">
              <p className="text-xs text-ink-faint mb-1.5">세종철인이 대회에 참가하여 달린 거리 (대회 참가자 전원 합산)</p>
              {raceStats.distances.hasAnyData ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono-brand text-sm [font-variant-numeric:tabular-nums]">
                  <span>전체 {fmtNum(raceStats.distances.totalKm, 1)}km</span>
                  <span className="text-ink-soft">Swim {fmtNum(raceStats.distances.swimKm, 1)}km</span>
                  <span className="text-ink-soft">Bike {fmtNum(raceStats.distances.bikeKm, 1)}km</span>
                  <span className="text-ink-soft">Run {fmtNum(raceStats.distances.runKm, 1)}km</span>
                </div>
              ) : (
                <p className="text-xs text-ink-faint">아직 입력된 거리가 없습니다.</p>
              )}
            </div>
            <div className="bg-accent-soft border border-accent/30 rounded-sm p-3">
              <p className="text-xs text-accent mb-1.5">세종철인이 달린 총 거리 (훈련 + 대회 참가 전원 합산)</p>
              {grandTotal.totalKm > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono-brand text-sm [font-variant-numeric:tabular-nums]">
                  <span className="font-medium text-ink">전체 {fmtNum(grandTotal.totalKm, 1)}km</span>
                  <span className="text-ink-soft">Swim {fmtNum(grandTotal.swimKm, 1)}km</span>
                  <span className="text-ink-soft">Bike {fmtNum(grandTotal.bikeKm, 1)}km</span>
                  <span className="text-ink-soft">Run {fmtNum(grandTotal.runKm, 1)}km</span>
                </div>
              ) : (
                <p className="text-xs text-ink-faint">아직 입력된 거리가 없습니다.</p>
              )}
            </div>
          </div>
          {raceStats.distances.excludedCount > 0 && (
            <p className="text-[11px] text-ink-faint mb-4">
              * 거리가 숫자로 딱 떨어지지 않는 대회 {raceStats.distances.excludedCount}건은 거리 합산에서
              제외했습니다 (참가대회수·참가자 수에는 포함).
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
            <DonutChart
              title="종목별 참가 대회수"
              unit="건"
              data={raceStats.categoryRaceCounts.map((c) => ({
                label: c.category,
                value: c.count,
                color: CATEGORY_CHART_COLOR[c.category] ?? "var(--ink-faint)",
              }))}
            />
            <DonutChart
              title="종목별 참가자 수"
              unit="명"
              data={raceStats.categoryParticipantCounts.map((c) => ({
                label: c.category,
                value: c.count,
                color: CATEGORY_CHART_COLOR[c.category] ?? "var(--ink-faint)",
              }))}
            />
          </div>
        </SectionCard>

        {/* Row 5.5 — 대회 참가횟수 Top5 */}
        <SectionCard
          title={`${now.getUTCFullYear()}년 대회 참가횟수 Top 5`}
          moreHref="/members/race-participation"
          moreLabel="전체 참가횟수 보기"
        >
          <Leaderboard
            items={raceParticipationLeaderboard.slice(0, 5).map((p) => ({ memberId: p.memberId, name: p.name, value: p.count }))}
            valueLabel="건"
            authed={authed}
          />
        </SectionCard>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          세종철인 훈련허브 · 세철포인트 기준 자동 집계
        </footer>
      </div>
    </div>
  );
}
