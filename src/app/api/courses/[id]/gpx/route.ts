import { NextResponse } from "next/server";
import { isSejongAuthed } from "@/lib/auth";
import { getCourseDetail } from "@/lib/courses";
import { buildGpxXml } from "@/lib/course-calc";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSejongAuthed())) {
    return NextResponse.json({ error: "세종철인 인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const detail = await getCourseDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "코스를 찾을 수 없습니다." }, { status: 404 });
  }

  const xml = buildGpxXml(detail.meta.name, detail.track);
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
