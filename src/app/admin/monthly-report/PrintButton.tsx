"use client";

// 리포트 자체는 서버에서 다 그려서 내려보내고(정적 HTML), 이 버튼 하나만 클라이언트 JS가
// 필요해서(window.print()) 따로 뺐다 — 나머지 무거운 리포트 렌더링에는 JS를 안 태운다.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-2 hover:opacity-90"
    >
      🖨️ 인쇄 / PDF로 저장
    </button>
  );
}
