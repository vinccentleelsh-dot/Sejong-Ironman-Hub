import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function ExportCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="block bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] hover:border-accent transition-colors"
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-xs text-ink-soft mt-1">{description}</p>
      <p className="text-xs text-accent mt-2">⬇ 다운로드</p>
    </a>
  );
}

export default async function ExportPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin/login?redirectTo=/admin/export");

  const [memberCount, sessionCount, attendanceCount, raceCount] = await Promise.all([
    prisma.member.count(),
    prisma.trainingSession.count(),
    prisma.attendanceRecord.count(),
    prisma.competitionRace.count(),
  ]);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="border-b-2 border-ink pb-4">
          <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
            <Link href="/training-plan" className="hover:underline">
              훈련계획
            </Link>
          </p>
          <h1 className="font-display text-2xl text-ink">데이터 백업 · 다운로드</h1>
          <p className="text-sm text-ink-soft mt-1">
            현재 회원 {memberCount}명 · 세션 {sessionCount}개 · 참석기록 {attendanceCount}건 · 대회기록{" "}
            {raceCount}건이 저장되어 있습니다.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportCard
            href="/api/export/backup"
            title="전체 백업 (JSON)"
            description="회원·세션·참석기록·점수규정·대회계획을 통째로 내려받습니다. 유실 대비용 원본 보관."
          />
          <ExportCard
            href="/api/export/points-grid"
            title="세철포인트 매트릭스 (CSV)"
            description="원래 쓰시던 엑셀과 같은 모양 — 회원 × 날짜별 포인트 표. 엑셀/구글시트에서 바로 열림."
          />
          <ExportCard
            href="/api/export/sessions"
            title="훈련계획 (CSV)"
            description="세션별 날짜·분류·종목·리더/보급·거리·참석인원."
          />
          <ExportCard
            href="/api/export/members"
            title="회원 명단 (CSV)"
            description="이름·활성상태·누적포인트·참석횟수·가입/탈퇴일."
          />
          <ExportCard
            href="/api/export/competitions"
            title="대회기록 (CSV)"
            description="날짜·분류·대회명·거리·획득고도·참가자. 세종철인 인증 없이도 운영자 권한으로 내려받을 수 있음."
          />
        </div>

        <Link
          href="/admin/competitions-log"
          className="block bg-paper-raised border border-line rounded-sm p-4 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] hover:border-accent transition-colors"
        >
          <p className="text-sm font-medium text-ink">대회기록 변경 로그 보기</p>
          <p className="text-xs text-ink-soft mt-1">
            누가 언제 뭘 등록·수정·삭제했는지 확인하고, 삭제된 대회를 복구할 수 있습니다.
          </p>
        </Link>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/training-plan" className="hover:underline">
            ← 훈련계획으로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
