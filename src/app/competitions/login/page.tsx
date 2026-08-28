import Link from "next/link";
import { loginSejongAction } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function SejongAuthLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo = "/competitions" } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        action={loginSejongAction}
        className="w-full max-w-sm bg-paper-raised border border-line rounded-sm p-6 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] flex flex-col gap-4"
      >
        <div>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-1">세종철인 인증</p>
          <h1 className="font-display text-xl text-ink">대회기록 열람 인증</h1>
          <p className="text-sm text-ink-soft mt-1">
            대회 캘린더는 회원 전용이에요. 클럽 비밀번호를 입력하면 열람·등록·참가 신청까지 모두
            가능합니다.
          </p>
        </div>

        <input type="hidden" name="redirectTo" value={redirectTo} />

        <label className="flex flex-col gap-1.5">
          <span className="font-mono-brand text-[11px] text-ink-faint uppercase tracking-wide">비밀번호</span>
          <input
            type="password"
            name="password"
            autoFocus
            required
            className="border border-line rounded-sm px-3 py-2 bg-paper text-ink outline-none focus:border-accent"
          />
        </label>

        {error ? (
          <p className="text-sm text-pending bg-pending-soft border border-pending/30 rounded-sm px-3 py-2">
            비밀번호가 올바르지 않습니다.
          </p>
        ) : null}

        <button
          type="submit"
          className="bg-accent text-accent-ink font-medium rounded-sm py-2.5 hover:opacity-90 transition-opacity"
        >
          인증하기
        </button>

        <Link href="/" className="text-center text-sm text-ink-faint hover:text-ink-soft">
          ← 대시보드로 돌아가기
        </Link>
      </form>
    </div>
  );
}
