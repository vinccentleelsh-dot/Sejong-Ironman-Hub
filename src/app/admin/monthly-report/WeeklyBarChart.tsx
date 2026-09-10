// 이 달 세션별(보통 매주 토요일) 참석인원 막대그래프 — 대시보드/큐시트의 SVG 차트들과 같은
// 원칙: 순수 SVG + 네이티브 <title> 툴팁이라 JS가 필요 없다(서버 컴포넌트로 그대로 렌더 가능).
export default function WeeklyBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-faint">이 달 훈련 기록이 없습니다.</p>;
  }
  const w = 600;
  const h = 160;
  const padBottom = 22;
  const padTop = 24;
  const max = Math.max(...data.map((d) => d.count), 1);
  const n = data.length;
  const gap = 10;
  const barW = Math.min(64, (w - gap * (n + 1)) / n);
  const totalBarsW = barW * n + gap * (n - 1);
  const startX = (w - totalBarsW) / 2;
  const plotH = h - padTop - padBottom;
  const maxIdx = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
      {data.map((d, i) => {
        const x = startX + i * (barW + gap);
        const barH = (d.count / max) * plotH;
        const y = padTop + (plotH - barH);
        const isMax = i === maxIdx;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} rx={5} fill={isMax ? "var(--gold)" : "var(--accent)"}>
              <title>{`${d.date}: ${d.count}명`}</title>
            </rect>
            <text x={x + barW / 2} y={y - 6} fontSize="13" fontWeight={700} fill="var(--ink)" textAnchor="middle" fontFamily="var(--font-body)">
              {d.count}
            </text>
            <text
              x={x + barW / 2}
              y={h - 4}
              fontSize="10.5"
              fill="var(--ink-faint)"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {d.date.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
