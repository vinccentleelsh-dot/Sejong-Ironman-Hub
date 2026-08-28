// "2026_철인3종대회_일정.xlsx" 대회 캘린더를 CompetitionRace 테이블로 이관.
// 참가자 이름 32명 전원이 기존 회원 명단과 대소문자 무관 정확히 일치하는 것까지 확인됨
// (prisma/import/competitions-seed-data.json 생성 스크립트에서 교차검증).
//
// ⚠️ 이 스크립트도 seed.ts와 마찬가지로 완전 초기화 후 재이관한다 — 재실행해도 안전하도록
// CompetitionRace를 매번 비우고 다시 만든다.

import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import data from './import/competitions-seed-data.json';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`[seed-competitions] 대회 ${data.races.length}건 이관 시작`);

  await prisma.competitionRace.deleteMany();

  for (const r of data.races) {
    if (!r.startDate) {
      console.warn(`[seed-competitions] 날짜 파싱 실패, 건너뜀: row ${r.rowIndex} "${r.dateLabel}"`);
      continue;
    }
    await prisma.competitionRace.create({
      data: {
        dateLabel: r.dateLabel,
        startDate: new Date(`${r.startDate}T00:00:00.000Z`),
        category: r.category,
        raceName: r.raceName,
        courseDetail: r.courseDetail,
        swimKm: r.swimKm,
        bikeKm: r.bikeKm,
        runKm: r.runKm,
        totalKmDisplay: r.totalKmDisplay,
        participantsRaw: r.participantsRaw,
        sortOrder: r.rowIndex,
      },
    });
  }

  const count = await prisma.competitionRace.count();
  console.log(`[seed-competitions] 완료 — CompetitionRace ${count}건`);
}

main()
  .catch((e) => {
    console.error('[seed-competitions] 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
