import { NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";
import { prisma } from "@/lib/db";

// 매주 자동 DB 백업 — Vercel Cron이 vercel.json 스케줄대로 이 라우트를 호출하면, 전체
// 데이터를 JSON으로 묶어 Vercel Blob에 올린다. Vercel 서버리스 함수는 파일시스템이
// 휘발성이라(재시작마다 사라짐) "로컬에 저장"이 불가능해서, 외부 저장소(Blob)가 꼭 필요하다.
//
// access: "private" — 회원 이름이 들어간 파일이라 URL만 알아도 열리는 public 대신, 인증된
// 요청(OIDC/BLOB_READ_WRITE_TOKEN)으로만 읽을 수 있는 private 스토어를 쓴다. 실제 다운로드는
// 운영자 인증이 걸린 /admin/export 페이지 → /api/admin/backups/download 라우트를 통해서만
// 가능하다 (2026.09 결정 — Private Storage 정식 출시에 맞춰 public에서 전환).
//
// AppSetting(운영자/세종철인/관리자 비밀번호 해시)은 일부러 백업에서 뺐다 — 복구 시나리오에서
// 굳이 해시를 여기저기 중복 보관할 이유가 없고, 필요하면 관리자 페이지에서 다시 설정하면 됨.
//
// 보관 정책: 최근 12개(약 3개월치, 매주 백업 기준)만 남기고 오래된 건 자동 삭제.
export const RETENTION_COUNT = 12;
export const BLOB_PREFIX = "db-backups/";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron은 요청에 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 실어 보낸다 —
  // 이걸로 "진짜 Vercel 크론이 호출한 것"만 통과시킨다 (URL만 알면 아무나 실행/과금 유발하는 것 방지).
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [members, sessions, attendances, races, competitionLogs, pointRules, courses, courseLogs] = await Promise.all([
      prisma.member.findMany(),
      prisma.trainingSession.findMany(),
      prisma.attendanceRecord.findMany(),
      prisma.competitionRace.findMany(),
      prisma.competitionAuditLog.findMany(),
      prisma.pointRule.findMany(),
      prisma.course.findMany(),
      prisma.courseAuditLog.findMany(),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      Member: members,
      TrainingSession: sessions,
      AttendanceRecord: attendances,
      CompetitionRace: races,
      CompetitionAuditLog: competitionLogs,
      PointRule: pointRules,
      Course: courses,
      CourseAuditLog: courseLogs,
    };

    const filename = `${BLOB_PREFIX}sejong-hub-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
    const blob = await put(filename, JSON.stringify(backup, null, 2), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    });

    // 오래된 백업 정리 — 최근 N개만 남김
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    const sorted = blobs.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)); // 최신 먼저
    const excess = sorted.slice(RETENTION_COUNT);
    if (excess.length > 0) {
      await del(excess.map((b) => b.url));
    }

    return NextResponse.json({ ok: true, url: blob.url, kept: Math.min(sorted.length, RETENTION_COUNT), deleted: excess.length });
  } catch (err) {
    // 백업 실패는 반드시 로그로 남긴다 (조용한 실패 금지 원칙) — Vercel 로그에서 확인 가능.
    console.error("[cron/backup] 백업 실패:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
