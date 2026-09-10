import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { nowKst } from "@/lib/now";

// 방문자 통계용 페이지뷰 로그 — VisitTracker.tsx(전역 클라이언트 컴포넌트)가 페이지 진입마다
// 한 번씩 호출한다. 쿠키에 심는 visitor_id는 이름·이메일 등과 전혀 연결되지 않는 랜덤 uuid
// 하나뿐이라 "이 브라우저가 오늘 왔었는지"만 구분할 수 있고 누구인지는 알 수 없다.
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "visitor_id";

function todayKey(): string {
  const n = nowKst();
  const mm = String(n.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(n.getUTCDate()).padStart(2, "0");
  return `${n.getUTCFullYear()}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === "string" && body.path.trim() ? body.path.trim().slice(0, 200) : "/";

    const store = await cookies();
    let visitorId = store.get(VISITOR_COOKIE)?.value;
    if (!visitorId) {
      visitorId = randomUUID();
      store.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1년 — 같은 사람의 재방문을 알아보기 위함(개인정보 아님)
      });
    }

    await prisma.visitLog.create({
      data: { visitorId, path, dateKey: todayKey() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 방문 로그는 부가 통계일 뿐이라 실패해도 사용자 경험에 영향을 주면 안 된다 — 콘솔에만
    // 남기고 조용히 200을 돌려준다(VisitTracker 쪽에서 재시도 로직을 만들 이유도 없음).
    console.error("방문 로그 기록 실패:", err);
    return NextResponse.json({ ok: false });
  }
}
