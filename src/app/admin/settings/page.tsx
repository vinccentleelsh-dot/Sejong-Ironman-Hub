import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { changeAdminPasswordAction, changeSejongPasswordAction, upsertPointRuleAction, deletePointRuleAction } from "./actions";
import { ChangePasswordForm, PointRuleTable } from "./SettingsForms";

export const dynamic = "force-dynamic";

const CARD = "bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-4";

export default async function AdminSettingsPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin/login?redirectTo=/admin/settings");

  const pointRules = await prisma.pointRule.findMany({ orderBy: { points: "asc" } });

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="flex items-center justify-between border-b-2 border-ink pb-4">
          <div>
            <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
              <Link href="/training-plan" className="hover:underline">
                세종철인 훈련허브
              </Link>
            </p>
            <h1 className="font-display text-2xl text-ink">관리자 페이지</h1>
            <p className="text-sm text-ink-soft mt-1">
              비밀번호 변경, 세철포인트 규정 — 운영진만 접근할 수 있는 페이지예요.
            </p>
          </div>
          <Link href="/training-plan" className="text-sm font-medium text-accent hover:underline">
            ← 훈련계획
          </Link>
        </header>

        <div className={`${CARD} flex flex-col gap-4`}>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">비밀번호 변경</p>
          <ChangePasswordForm
            title="운영진 비밀번호"
            description="훈련계획 수정, 이 관리자 페이지 접근에 사용됩니다."
            action={changeAdminPasswordAction}
          />
          <div className="border-t border-line" />
          <ChangePasswordForm
            title='"세종철인 인증" 비밀번호'
            description="대회기록 등록·수정, 개인 기록·전체 순위 열람에 사용됩니다."
            action={changeSejongPasswordAction}
          />
        </div>

        <div className={CARD}>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-1">세철포인트 규정</p>
          <p className="text-xs text-ink-faint mb-3">
            실제 포인트는 훈련계획 페이지에서 참석자마다 직접 입력해요. 이 표는 참고용 기준표이고,
            규정이 바뀌면 여기서 고쳐두면 됩니다.
          </p>
          <PointRuleTable rules={pointRules} upsertAction={upsertPointRuleAction} deleteAction={deletePointRuleAction} />
        </div>

        <div className={CARD}>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">변경 로그 · IP 추적</p>
          <p className="text-sm text-ink-soft mb-3">
            대회기록 등록/수정/삭제 이력과 IP를 확인할 수 있어요 (운영진 로그인이 필요해서
            이미 관리자만 볼 수 있는 페이지예요).
          </p>
          <Link href="/admin/competitions-log" className="text-sm font-medium text-accent hover:underline">
            로그 보기 →
          </Link>
        </div>

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/training-plan" className="hover:underline">
            ← 훈련계획으로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
