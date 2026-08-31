// Vercel 서버는 기본적으로 UTC로 도는데(TZ 환경변수는 Vercel의 예약어라 못 씀 — AWS Lambda
// 기반이라 그럼), 클럽은 한국(KST, UTC+9)이라 "지금이 몇 년 몇 월 며칠인가"를 구할 때마다
// 이 함수를 써야 한다. 9시간을 더한 뒤 반드시 getUTCFullYear/getUTCMonth/getUTCDate/getUTCDay
// (절대 getFullYear/getMonth/getDate/getDay 아님)로 읽으면, 서버가 어느 타임존에서 돌아가든
// 항상 한국 날짜가 나온다.
//
// 세션 날짜도 항상 UTC 자정 기준으로 저장되어 있어서(예: "2026-09-01" 입력 →
// new Date("2026-09-01T00:00:00.000Z")) 이렇게 맞춰야 "지금"과 "세션 날짜"가 같은 기준으로
// 비교된다 — 그냥 new Date()를 쓰면 한국시간 오전 9시가 되기 전까지는 하루/한 달 전으로
// 잘못 계산된다 (2026.09 실제로 겪은 버그: 9월 1일인데 대시보드가 8월로 나옴).
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nowKst(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}
