import Link from "next/link";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/auth";
import { getVisitStats } from "@/lib/visit-stats";
import VisitTrendChart from "./VisitTrendChart";

export const dynamic = "force-dynamic";

const CARD = "bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-4";

function StatTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex-1 min-w-[130px] bg-paper-raised border border-line rounded-sm px-4 py-3 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
      <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-ink-faint mb-1.5">{label}</p>
      <p className="font-display text-2xl leading-none text-ink [font-variant-numeric:tabular-nums]">
        {value.toLocaleString("ko-KR")}
        <span className="text-sm font-body text-ink-soft ml-1">{unit}</span>
      </p>
    </div>
  );
}

export default async function AdminVisitorsPage() {
  if (!(await isSuperAdmin())) redirect("/admin/super-login?redirectTo=/admin/visitors");

  const stats = await getVisitStats();

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/admin/settings" className="hover:underline">
                관리자 페이지
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">📊 방문자 통계</h1>
            <p className="text-sm text-ink-soft mt-1">
              쿠키 기반 익명 방문자 수예요 — 이름·회원 정보와 연결되지 않아요.
            </p>
          </div>
          <Link href="/admin/settings" className="text-sm font-medium text-accent hover:underline">
            ← 관리자 페이지
          </Link>
        </header>

        <div className="flex gap-2.5 flex-wrap">
          <StatTile label="오늘 방문자" value={stats.todayVisitors} unit="명" />
          <StatTile label="오늘 조회수" value={stats.todayViews} unit="회" />
          <StatTile label="누적 방문자" value={stats.totalVisitors} unit="명" />
          <StatTile label="누적 조회수" value={stats.totalViews} unit="회" />
        </div>

        <div className={CARD}>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">일별 추이 · 최근 30일</p>
          <VisitTrendChart data={stats.daily.map((d) => ({ label: d.date.slice(5), visitors: d.visitors, views: d.views }))} />
        </div>

        <div className={CARD}>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">주별 추이 · 최근 12주</p>
          <VisitTrendChart data={stats.weekly} />
        </div>

        <div className={CARD}>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">월별 추이 · 최근 12개월</p>
          <VisitTrendChart data={stats.monthly} />
        </div>

        <p className="text-xs text-ink-faint">
          그래프의 점에 마우스를 올리면(모바일은 탭) 방문자·조회수가 함께 표시돼요. 방문자 수는
          같은 기간 안에 같은 사람이 여러 번 와도 1명으로 세는 "순 방문자"예요.
        </p>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/admin/settings" className="hover:underline">
            ← 관리자 페이지로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
