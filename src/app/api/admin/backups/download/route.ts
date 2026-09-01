import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isAdmin } from "@/lib/auth";
import { BLOB_PREFIX } from "@/app/api/cron/backup/route";

// private Blob에 저장된 자동 백업 파일을 운영자 인증 후에만 스트리밍해서 내려준다.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "운영자 권한이 필요합니다." }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");
  // 경로 탈출 방지 — 우리 백업 prefix로 시작하는 파일만 내려준다.
  if (!pathname || !pathname.startsWith(BLOB_PREFIX)) {
    return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 });
  }

  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const filename = pathname.slice(BLOB_PREFIX.length);
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[admin/backups/download] 다운로드 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
