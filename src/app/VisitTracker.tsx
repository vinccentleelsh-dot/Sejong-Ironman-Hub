"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// 루트 레이아웃에 한 번 박아두는 방문 트래커 — App Router는 같은 레이아웃을 쓰는 페이지끼리
// 이동할 때 레이아웃을 다시 마운트하지 않으므로, usePathname()으로 경로가 바뀔 때마다(첫
// 로드 포함) /api/track-visit을 호출해야 페이지뷰마다 한 번씩 잡힌다.
export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {
      // 방문 통계 실패는 사용자에게 보일 이유가 없는 부가 기능 — 조용히 무시한다
      // (다른 기능의 "저장 실패는 절대 조용히 삼키지 않는다" 원칙과는 의도적으로 다름).
    });
  }, [pathname]);

  return null;
}
