import { prisma } from "@/lib/db";
import { nowKst } from "@/lib/now";

// 관리자 페이지 "방문자 통계" 집계 — VisitLog(페이지뷰 1건당 1행, visitorId=익명 쿠키값)를
// 메모리에서 집계한다. 이 동호회 사이트 규모(회원 수백 명)에서는 1년치 로그를 SQL GROUP BY
// 없이 JS 배열로 처리해도 부담이 없고, 로컬 better-sqlite3/Turso libsql 어댑터 차이를 신경
// 안 써도 돼서 더 안전하다(이 코드베이스에서 반복적으로 겪은 패턴).

function dateKeyForOffset(daysAgo: number): string {
  const n = nowKst();
  const base = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - daysAgo));
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${base.getUTCFullYear()}-${mm}-${dd}`;
}

export type DailyPoint = { date: string; views: number; visitors: number };
export type BucketPoint = { label: string; views: number; visitors: number };

export type VisitStats = {
  todayViews: number;
  todayVisitors: number;
  totalViews: number;
  totalVisitors: number;
  daily: DailyPoint[]; // 최근 30일, 오래된 순
  weekly: BucketPoint[]; // 최근 12주(7일 단위), 오래된 순
  monthly: BucketPoint[]; // 최근 12개월(달력월), 오래된 순
};

export async function getVisitStats(): Promise<VisitStats> {
  const today = dateKeyForOffset(0);
  const windowStart = dateKeyForOffset(370); // 월별 추이 12개월 + 여유

  const [totalViews, distinctVisitors, rows] = await Promise.all([
    prisma.visitLog.count(),
    prisma.visitLog.groupBy({ by: ["visitorId"] }),
    prisma.visitLog.findMany({
      where: { dateKey: { gte: windowStart } },
      select: { visitorId: true, dateKey: true },
    }),
  ]);

  const viewsByDay = new Map<string, number>();
  const visitorsByDay = new Map<string, Set<string>>();
  for (const r of rows) {
    viewsByDay.set(r.dateKey, (viewsByDay.get(r.dateKey) ?? 0) + 1);
    if (!visitorsByDay.has(r.dateKey)) visitorsByDay.set(r.dateKey, new Set());
    visitorsByDay.get(r.dateKey)!.add(r.visitorId);
  }

  // 일별 — 최근 30일, 없는 날은 0으로 채운다
  const daily: DailyPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = dateKeyForOffset(i);
    daily.push({ date: key, views: viewsByDay.get(key) ?? 0, visitors: visitorsByDay.get(key)?.size ?? 0 });
  }

  // 주별 — 최근 12주, 7일씩 묶음(달력 주 아님 — 오늘 기준 역산). 방문자 수는 그 주 7일치
  // Set을 합쳐서 "그 주의 진짜 순 방문자수"로 계산한다(일별 순방문자 합이 아님 — 같은
  // 사람이 같은 주에 여러 번 왔으면 1명으로만 센다).
  const weekly: BucketPoint[] = [];
  for (let w = 11; w >= 0; w--) {
    const startOffset = w * 7 + 6;
    const endOffset = w * 7;
    let views = 0;
    const visitorSet = new Set<string>();
    for (let d = endOffset; d <= startOffset; d++) {
      const key = dateKeyForOffset(d);
      views += viewsByDay.get(key) ?? 0;
      const s = visitorsByDay.get(key);
      if (s) for (const v of s) visitorSet.add(v);
    }
    const startKey = dateKeyForOffset(startOffset).slice(5).replace("-", "/");
    const endKey = dateKeyForOffset(endOffset).slice(5).replace("-", "/");
    weekly.push({ label: `${startKey}~${endKey}`, views, visitors: visitorSet.size });
  }

  // 월별 — 최근 12개월(달력월). dateKey 접두사("YYYY-MM")로 묶는다.
  const monthBuckets = new Map<string, { views: number; visitors: Set<string> }>();
  for (const [key, count] of viewsByDay) {
    const month = key.slice(0, 7);
    if (!monthBuckets.has(month)) monthBuckets.set(month, { views: 0, visitors: new Set() });
    monthBuckets.get(month)!.views += count;
  }
  for (const [key, set] of visitorsByDay) {
    const month = key.slice(0, 7);
    if (!monthBuckets.has(month)) monthBuckets.set(month, { views: 0, visitors: new Set() });
    for (const v of set) monthBuckets.get(month)!.visitors.add(v);
  }
  const monthly: BucketPoint[] = [];
  const n = nowKst();
  for (let m = 11; m >= 0; m--) {
    const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - m, 1));
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.get(monthKey);
    monthly.push({ label: monthKey, views: bucket?.views ?? 0, visitors: bucket?.visitors.size ?? 0 });
  }

  return {
    todayViews: viewsByDay.get(today) ?? 0,
    todayVisitors: visitorsByDay.get(today)?.size ?? 0,
    totalViews,
    totalVisitors: distinctVisitors.length,
    daily,
    weekly,
    monthly,
  };
}
