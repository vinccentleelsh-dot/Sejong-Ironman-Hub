import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/admin/actions";
import SessionsTable from "./SessionsTable";
import MemberManagement from "./MemberManagement";

export const dynamic = "force-dynamic";

export default async function TrainingPlanPage() {
  const admin = await isAdmin();

  const [sessions, members] = await Promise.all([
    prisma.trainingSession.findMany({
      orderBy: { date: "asc" },
      include: { attendances: { include: { member: true } } },
    }),
    prisma.member.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { attendances: { select: { points: true } } },
    }),
  ]);

  const sessionRows = sessions.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    category: s.category,
    title: s.title,
    description: s.description,
    disciplines: s.disciplines,
    swimKm: s.swimKm,
    bikeKm: s.bikeKm,
    runKm: s.runKm,
    attendees: s.attendances
      .map((a) => ({ memberId: a.memberId, name: a.member.name, points: a.points }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
  }));

  const memberRows = members.map((m) => ({
    id: m.id,
    name: m.name,
    isActive: m.isActive,
    totalPoints: m.attendances.reduce((sum, a) => sum + a.points, 0),
  }));

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/" className="hover:underline">
                세종철인 훈련허브
              </Link>
            </p>
            {/* TODO: 2025년 데이터가 들어오면 연도 선택/탭을 추가하고 이 제목도 동적으로 바꿀 것 */}
            <h1 className="font-display text-2xl text-ink">2026년 훈련계획</h1>
            <p className="text-sm text-ink-soft mt-1">
              {admin ? "운영자 모드 — 세션 수정/추가, 회원 관리가 가능합니다." : "읽기 전용 — 운영자만 수정할 수 있습니다."}
            </p>
          </div>
          {admin ? (
            <div className="flex items-center gap-4">
              <Link
                href="/training-plan/import"
                className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1.5 hover:bg-accent-soft"
              >
                연도별 계획 업로드
              </Link>
              <Link
                href="/admin/export"
                className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1.5 hover:bg-accent-soft"
              >
                데이터 백업
              </Link>
              <Link
                href="/admin/settings"
                className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1.5 hover:bg-accent-soft"
              >
                관리자 페이지
              </Link>
              <form action={logoutAction}>
                <input type="hidden" name="redirectTo" value="/training-plan" />
                <button type="submit" className="text-sm text-ink-faint hover:text-ink-soft underline">
                  로그아웃
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/admin/login?redirectTo=/training-plan"
              className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1.5 hover:bg-accent-soft"
            >
              운영자 로그인
            </Link>
          )}
        </header>

        <SessionsTable sessions={sessionRows} members={memberRows} isAdmin={admin} />
        <MemberManagement members={memberRows} isAdmin={admin} />

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/" className="hover:underline">
            ← 대시보드로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
