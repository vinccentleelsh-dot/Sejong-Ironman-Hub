import Link from "next/link";

// 모든 페이지 상단에 공통으로 뜨는 바로가기 — 대시보드에만 있던 걸 전체 페이지로 확장
// (2026.09 결정). 루트 레이아웃에 넣어서 관리자 화면까지 포함한 모든 페이지에 뜬다.
const NAV_ITEMS = [
  { href: "/archive", label: "지난 기록" },
  { href: "/competitions", label: "대회 계획" },
  { href: "/training-plan", label: "훈련 계획" },
  { href: "/courses", label: "코스 아카이브" },
];

export default function TopNav() {
  return (
    <div className="bg-paper-raised border-b border-line">
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-4 overflow-x-auto">
        <Link href="/" className="text-xs font-mono-brand uppercase tracking-wide text-accent hover:underline whitespace-nowrap">
          세종철인 훈련허브
        </Link>
        <span className="text-line" aria-hidden>
          |
        </span>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-xs font-medium text-ink-soft hover:text-accent whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
