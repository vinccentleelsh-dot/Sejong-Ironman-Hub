import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import ImportPanel from "./ImportPanel";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/admin/login?redirectTo=/training-plan/import");

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
        <header className="border-b-2 border-ink pb-4">
          <p className="font-mono-brand text-[11px] tracking-wide uppercase text-accent mb-1">
            <Link href="/training-plan" className="hover:underline">
              훈련계획
            </Link>
          </p>
          <h1 className="font-display text-2xl text-ink">연도별 계획 업로드</h1>
          <p className="text-sm text-ink-soft mt-1">
            새 연도 훈련계획을 엑셀 업로드 또는 구글시트 복사·붙여넣기로 한 번에 들여옵니다.
          </p>
        </header>

        <ImportPanel />

        <footer className="text-center text-xs text-ink-faint font-mono-brand pt-4 pb-8">
          <Link href="/training-plan" className="hover:underline">
            ← 훈련계획으로 돌아가기
          </Link>
        </footer>
      </div>
    </div>
  );
}
