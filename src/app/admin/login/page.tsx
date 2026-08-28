import { loginAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo = "/training-plan" } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm bg-paper-raised border border-line rounded-sm p-6 shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] flex flex-col gap-4"
      >
        <div>
          <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-1">Admin</p>
          <h1 className="font-display text-xl text-ink">운영자 로그인</h1>
          <p className="text-sm text-ink-soft mt-1">
            훈련계획·회원 정보를 수정하려면 운영자 비밀번호가 필요합니다.
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
          로그인
        </button>

        <a href={redirectTo} className="text-center text-sm text-ink-faint hover:text-ink-soft">
          ← 읽기 전용으로 돌아가기
        </a>
      </form>
    </div>
  );
}
