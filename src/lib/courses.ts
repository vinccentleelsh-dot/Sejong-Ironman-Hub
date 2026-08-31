import { prisma } from "@/lib/db";
import type { CourseCardRow, CourseDetail, TrackData, CheckPoint, Peak, CourseMeta } from "@/lib/course-shared";

// 코스 아카이브 — 서버 전용 조회 (prisma를 물고 있어 클라이언트 번들에 넣으면 깨짐 —
// competitions.ts와 동일한 분리 원칙, 클라이언트는 course-shared.ts만 import할 것).

export async function getCourseCards(): Promise<CourseCardRow[]> {
  const rows = await prisma.course.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => {
    let sparklineE: number[] = [];
    try {
      const track = JSON.parse(r.trackJson) as TrackData;
      sparklineE = track.e;
    } catch {
      sparklineE = [];
    }
    return {
      id: r.id,
      name: r.name,
      sport: r.sport,
      totalKm: r.totalKm,
      gainM: r.gainM,
      cpCount: r.cpCount,
      hasCutoff: r.hasCutoff,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      sparklineE,
    };
  });
}

export async function getCourseDetail(id: string): Promise<CourseDetail | null> {
  const r = await prisma.course.findUnique({ where: { id } });
  if (!r) return null;

  const track = JSON.parse(r.trackJson) as TrackData;
  const cps = JSON.parse(r.cpsJson) as CheckPoint[];
  const peaks = JSON.parse(r.peaksJson) as Peak[];
  const meta: CourseMeta = {
    name: r.name,
    sport: r.sport,
    notes: r.notes ?? "",
    startDTraw: r.startDTRaw ?? "",
    totalKm: r.totalKm,
    gainM: r.gainM,
    cpCount: r.cpCount,
    hasCutoff: r.hasCutoff,
    cpSource: r.cpSource as CourseMeta["cpSource"],
    paceModel: r.paceModel,
  };

  return {
    id: r.id,
    track,
    cps,
    peaks,
    startDT: r.startDT ? r.startDT.toISOString() : null,
    meta,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
