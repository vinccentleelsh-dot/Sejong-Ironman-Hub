// 세철포인트 엑셀(Sheet1)에서 검증된 회원/세션/참석기록을 DB로 (다시) 이관.
// 데이터 출처 & 검증 방법은 prisma/import/sheet1-seed-data.json 생성 스크립트 참고.
// - memberCrossCheckMismatches: 0건 (엑셀 "합계" 열과 100% 일치 확인됨)
// - 리더/보급/종목/코스설명(Sheet2)은 이번 1차 이관에 포함하지 않음 → null로 시작,
//   훈련계획 입력 페이지(운영자용)에서 채워 넣는 것을 전제로 함.
// - "운영진" 로테이션 행은 스코프 제외 결정에 따라 처음부터 데이터셋에 없음.
//
// ⚠️ 이 스크립트는 매번 "완전 초기화 후 재이관"한다 — Member/TrainingSession/
// AttendanceRecord를 전부 지우고 엑셀 기준으로 다시 만든다. 아직은 이 세 테이블의
// 유일한 데이터 출처가 엑셀뿐이라 안전하지만, 앞으로 앱 안에서 세션 거리·리더 등을
// 직접 입력하기 시작하면 그 값들도 같이 날아간다 — 그때는 이 스크립트를 진짜 diff 기반
// 동기화로 바꿔야 한다. CompetitionRace(대회 참가 계획)는 참가자를 이름 텍스트로만 저장하고
// Member를 FK로 물지 않으므로, Member를 지워도 영향받지 않는다 — 안전.

import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, SessionCategory } from '../src/generated/prisma/client';
import seedData from './import/sheet1-seed-data.json';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

function classifyCategory(label: string): SessionCategory {
  if (label.includes('자율훈련')) return 'FREE_TRAINING';
  if (label.includes('공식행사')) return 'OFFICIAL_EVENT';
  if (label === '정기훈련') return 'REGULAR';
  return 'COMPETITION';
}

// "공식행사(해맞이행사)" → "해맞이행사"처럼, 카테고리 키워드로 감싸져 있으면 안의 실제 이름만
// 뽑아 title로 쓴다. 감싸지 않은 옛날 스타일 라벨("미야코지마", "장흥공식대회" 등)은 그대로 쓰고,
// "정기훈련"/"자율훈련"/"공식행사" 같은 맨 키워드뿐이면 title 없음(null)으로 둔다.
function extractTitle(label: string): string | null {
  const wrapped = label.match(/^(?:공식행사|대회|자율훈련|정기훈련)\((.+)\)$/);
  if (wrapped) return wrapped[1];
  if (label === '정기훈련' || label === '자율훈련' || label === '공식행사' || label === '대회') return null;
  return label;
}

async function main() {
  console.log('[seed] 기존 데이터 초기화 중...');
  await prisma.attendanceRecord.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.member.deleteMany();

  console.log(`[seed] 세션 ${seedData.sessionCount}개, 회원 ${seedData.memberCount}명 이관 시작`);

  // ---- 점수 규정 (엑셀 하단 "대회점수" 표 + 관측된 정기훈련/리더·보급 값) ----
  const pointRules: Array<{ label: string; points: number; note?: string }> = [
    { label: '정기훈련', points: 3, note: '일반 참석' },
    { label: '리더/보급', points: 5, note: '해당 훈련 리더 또는 보급 담당' },
    { label: '공식대회', points: 100 },
    { label: '풀코스', points: 50 },
    { label: '하프코스', points: 30 },
    { label: '올림픽코스', points: 20 },
  ];
  for (const rule of pointRules) {
    await prisma.pointRule.upsert({
      where: { label: rule.label },
      update: { points: rule.points, note: rule.note },
      create: rule,
    });
  }

  // ---- 세션 (col → TrainingSession.id) ----
  // swimKm/bikeKm/runKm/description/disciplines는 이번에 엑셀이 새로 갖추기 시작한 열
  // (훈련세부내용, Swim/Cycle/Run 거리 행) — 있으면 그대로 쓰고 없으면 기본값(0/null).
  const sessionIdByCol = new Map<number, string>();
  for (const s of seedData.sessions) {
    const category = classifyCategory(s.label);
    const session = await prisma.trainingSession.create({
      data: {
        date: new Date(`${s.date}T00:00:00.000Z`),
        category,
        title: extractTitle(s.label),
        description: s.description ?? null,
        disciplines: s.disciplines ?? null,
        swimKm: s.swimKm ?? 0,
        bikeKm: s.bikeKm ?? 0,
        runKm: s.runKm ?? 0,
      },
    });
    sessionIdByCol.set(s.col, session.id);
  }

  // ---- 회원 + 참석기록 ----
  for (const m of seedData.members) {
    const member = await prisma.member.create({
      data: { name: m.name, isActive: true },
    });
    for (const a of m.attendance) {
      const sessionId = sessionIdByCol.get(a.col);
      if (!sessionId) continue;
      await prisma.attendanceRecord.create({
        data: { memberId: member.id, sessionId, points: a.points },
      });
    }
  }

  const memberCount = await prisma.member.count();
  const sessionCount = await prisma.trainingSession.count();
  const attendanceCount = await prisma.attendanceRecord.count();
  console.log(`[seed] 완료 — Member ${memberCount} / TrainingSession ${sessionCount} / AttendanceRecord ${attendanceCount}`);
}

main()
  .catch((e) => {
    console.error('[seed] 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
