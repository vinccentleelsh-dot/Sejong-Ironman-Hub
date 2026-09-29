import { NextResponse } from "next/server";
import { getCourseDetail } from "@/lib/courses";
import { buildGpxXml } from "@/lib/course-calc";

export const dynamic = "force-dynamic";

// 코스 아카이브는 열람·다운로드 전부 공개다(2026.09 결정, 다른 코스 아카이브 API와 동일) —
// 예전에 이 라우트만 세종철인 인증 게이트가 남아있던 걸 여기서 같이 정리한다.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCourseDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
  }

  const xml = buildGpxXml(detail.meta.name, detail.track, detail.cps);
  const safeName = detail.meta.name.trim() || "course";
  const encoded = encodeURIComponent(`${safeName}.gpx`);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/gpx+xml; charset=utf-8",
      // 한글 파일명은 filename*(RFC 5987)로, 구형 클라이언트용 폴백은 filename=
      "Content-Disposition": `attachment; filename="course.gpx"; filename*=UTF-8''${encoded}`,
    },
  });
}
