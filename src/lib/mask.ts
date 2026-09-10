// 공개 화면에 이름을 노출할 때 쓰는 공용 마스킹 — 서버에서 계산해서 실명 자체가 클라이언트에
// 안 닿게 한다(CSS 블러만 걸면 페이지 소스에 실명이 그대로 남는다). 대시보드(src/app/page.tsx)의
// 비인증 뷰, 월간 리포트(관리자 출력물, 외부 공유 목적) 등에서 공통으로 쓴다.
export function maskName(name: string): string {
  if (name.length <= 1) return "●";
  return name[0] + "●".repeat(name.length - 1);
}
