import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMemberProfile } from "@/lib/member-profile";
import { getMemberCompetitionHistory } from "@/lib/competitions";
import { getMileageLeaderboard } from "@/lib/dashboard-competitions";
import { isSejongAuthed } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/constants";
import { RACE_CATEGORY_COLOR, formatTotalKm } from "@/lib/competitions-shared";
import { nowKst } from "@/lib/now";
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

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isSejongAuthed())) redirect(`/competitions/login?redirectTo=/members/${id}`);

  const year = nowKst().getUTCFullYear();
  const profile = await getMemberProfile(id, year);
  if (!profile) notFound();

  const competitionHistory = await getMemberCompetitionHistory(profile.name);

  // 대회 참가 누적거리 — "대회 참가 이력"과 같은 범위(전체 기간)로, 종목별 km이 있는
  // 대회만 더한다 (거리가 안 갈라지는 대회는 정직하게 빼고 excludedCount로 알려준다).
  let compSwimKm = 0;
  let compBikeKm = 0;
  let compRunKm = 0;
  let compDistanceExcluded = 0;
  for (const race of competitionHistory) {
    const s = race.swimKm ?? 0;
    const b = race.bikeKm ?? 0;
    const r = race.runKm ?? 0;
    if (s + b + r > 0) {
      compSwimKm += s;
      compBikeKm += b;
      compRunKm += r;
    } else if ((race.totalKmDisplay ?? "").trim()) {
      compDistanceExcluded += 1;
    }
  }
  const compTotalKm = compSwimKm + compBikeKm + compRunKm;

  // 대회 마일리지 — 전체 기간 랭킹에서 이 회원 순위/점수를 찾는다 (대시보드의 "N년" 랭킹과는
  // 별개로, 이 페이지의 "대회 참가 이력"이 전체 기간이라 마일리지도 같은 범위로 맞췄다).
  const mileageAll = await getMileageLeaderboard();
  const myMileage = mileageAll.find((m) => m.memberId === id) ?? null;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/members" className="hover:underline">
                {year}년 전체 순위
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">
              {profile.name}
              {!profile.isActive && <span className="text-sm font-body text-ink-faint ml-2">(탈퇴)</span>}
            </h1>
          </div>
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← 대시보드
          </Link>
        </header>

        <div className="flex flex-wrap gap-3">
          <StatCard label={`${year}년 세철포인트`} value={fmtNum(profile.yearPoints)} unit="점" />
          <StatCard label="전체 순위" value={`${profile.yearRank}`} unit={`/ ${profile.totalActiveMembers}명`} />
          <StatCard label="참석 횟수 (정기훈련·공식행사)" value={fmtNum(profile.yearAttendanceCount)} unit="회" />
        </div>

        <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">
            {year}년 누적 거리
          </p>
          {profile.distances.hasAnyData ? (
            <div className="flex gap-6 font-mono-brand [font-variant-numeric:tabular-nums]">
              <span>Swim {fmtNum(profile.distances.swimKm, 1)}km</span>
              <span>Bike {fmtNum(profile.distances.bikeKm, 1)}km</span>
              <span>Run {fmtNum(profile.distances.runKm, 1)}km</span>
            </div>
          ) : (
            <p className="text-sm text-pending bg-pending-soft border border-pending/30 rounded-sm px-3 py-2">
              아직 참석한 세션에 거리 데이터가 입력되지 않았습니다.
            </p>
          )}
          <p className="text-xs text-ink-faint mt-2">
            * 참석한 날의 세션 거리를 그대로 소화한 것으로 계산 (개인 편차는 반영하지 않음)
          </p>
        </div>

        <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-3">
            참석 이력 · {year}년 {profile.history.length}건
          </p>
          {profile.history.length === 0 ? (
            <p className="text-sm text-ink-faint">아직 참석 기록이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {profile.history.map((h) => (
                <li key={h.sessionId} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono-brand text-ink-faint whitespace-nowrap">{h.date}</span>
                  <span className="text-ink-soft flex-1 px-3 truncate">
                    {CATEGORY_LABELS[h.category as SessionCategory]}
                    {h.title ? ` · ${h.title}` : ""}
                  </span>
                  <span className="font-mono-brand text-ink font-medium [font-variant-numeric:tabular-nums]">
                    +{h.points}점
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-3">
            대회 참가 이력 · {competitionHistory.length}건
          </p>
          {competitionHistory.length === 0 ? (
            <p className="text-sm text-ink-faint">참가 기록으로 잡힌 대회가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {competitionHistory.map((race) => {
                const c = RACE_CATEGORY_COLOR[race.category] ?? { text: "var(--ink-soft)", bg: "var(--line)" };
                return (
                  <li key={race.id} className="flex items-center justify-between py-2 text-sm gap-3">
                    <span className="font-mono-brand text-ink-faint whitespace-nowrap">{race.dateLabel}</span>
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap"
                      style={{ color: c.text, backgroundColor: c.bg }}
                    >
                      {race.category}
                    </span>
                    <span className="text-ink-soft flex-1 truncate">{race.raceName}</span>
                    <span className="font-mono-brand text-ink-faint text-xs whitespace-nowrap">
                      {formatTotalKm(race.totalKmDisplay) ? `${formatTotalKm(race.totalKmDisplay)}km` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">대회 참가 누적거리</p>
          {compTotalKm > 0 ? (
            <>
              <div className="flex gap-6 font-mono-brand [font-variant-numeric:tabular-nums]">
                <span className="font-medium text-ink">전체 {fmtNum(compTotalKm, 1)}km</span>
                <span className="text-ink-soft">Swim {fmtNum(compSwimKm, 1)}km</span>
                <span className="text-ink-soft">Bike {fmtNum(compBikeKm, 1)}km</span>
                <span className="text-ink-soft">Run {fmtNum(compRunKm, 1)}km</span>
              </div>
              {compDistanceExcluded > 0 && (
                <p className="text-[11px] text-ink-faint mt-2">
                  * 거리가 숫자로 안 떨어지는 대회 {compDistanceExcluded}건은 이 합계에서 제외했습니다.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-faint">아직 거리로 집계할 수 있는 대회 기록이 없습니다.</p>
          )}
        </div>

        <div className="bg-accent-soft border border-accent/30 rounded-sm p-4">
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">대회 마일리지</p>
          {myMileage ? (
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl text-ink [font-variant-numeric:tabular-nums]">
                {myMileage.points.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}
                <span className="text-sm font-body text-ink-soft ml-1">점</span>
              </span>
              <span className="text-sm text-ink-soft">
                전체 {myMileage.rank}위 (
                <Link href="/members/mileage" className="hover:text-accent hover:underline">
                  전체 마일리지 보기
                </Link>
                )
              </span>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">아직 마일리지로 계산할 수 있는 대회 기록이 없습니다.</p>
          )}
          <p className="text-xs text-ink-faint mt-2">
            수영 1km=20점, 자전거 1km=1점, 달리기 1km=3점으로 환산 (세철포인트와는 별개 시스템 — 종목별 거리가
            안 갈라지는 대회는 제외).
          </p>
        </div>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/members" className="hover:underline">
            ← 전체 순위로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
