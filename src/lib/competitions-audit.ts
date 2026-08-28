import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getRequestMeta } from "@/lib/auth";

// 대회기록은 "세종철인 인증" 하나로 전 회원이 수정·삭제할 수 있으므로, 실수나 악의적 삭제에
// 대비해 두 겹으로 안전망을 둔다:
//  1) 모든 변경을 CompetitionAuditLog에 기록 (누가 언제 뭘 했는지 + IP, 삭제 건은 복구용 스냅샷 포함)
//  2) 변경이 있을 때마다 테이블 전체를 타임스탬프 찍힌 JSON 파일로 로컬에 떨궈둔다 (최근 50개만 보관)

const BACKUP_DIR = path.join(process.cwd(), "prisma", "backups", "competitions");
const MAX_BACKUPS = 50;

export type CompetitionAction = "CREATE" | "UPDATE" | "DELETE" | "JOIN" | "LEAVE";

export async function logCompetitionAction(action: CompetitionAction, race: Record<string, unknown>) {
  const { ipAddress, userAgent } = await getRequestMeta();
  await prisma.competitionAuditLog.create({
    data: {
      action,
      raceSnapshot: JSON.stringify(race),
      raceId: (race.id as string) ?? null,
      ipAddress,
      userAgent,
    },
  });
}

export async function backupCompetitionsSnapshot() {
  try {
    const races = await prisma.competitionRace.findMany({ orderBy: { sortOrder: "asc" } });
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const filename = `competitions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(races, null, 2));

    // 오래된 백업 정리 — 최근 50개만 남김
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort(); // 파일명이 ISO 타임스탬프라 문자열 정렬 = 시간순 정렬
    const excess = files.length - MAX_BACKUPS;
    if (excess > 0) {
      for (const f of files.slice(0, excess)) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
      }
    }
  } catch (e) {
    // 백업 실패는 실제 작업을 막으면 안 된다 — 로그만 남기고 조용히 넘어간다.
    console.error("[competitions-backup] 스냅샷 저장 실패:", e);
  }
}
