// 일별/주별/월별 추이 공용 차트 — 대시보드의 DailyTrendChart(src/app/page.tsx)와 동일한 방식:
// 순수 SVG + 네이티브 <title> 툴팁이라 별도 JS/클라이언트 컴포넌트가 필요 없다. 방문자수(순
// 방문자, 굵은 선)를 주로 보여주고 조회수는 hover 툴팁에서만 같이 알려준다.
export type TrendPoint = { label: string; visitors: number; views: number };

export default function VisitTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-faint">아직 데이터가 없습니다.</p>;
  }
  const w = 600;
  const h = 140;
  const padLeft = 28;
  const padBottom = 20;
  const plotW = w - padLeft;
  const plotH = h - padBottom;
  const max = Math.max(...data.map((d) => d.visitors), 1);
  const yTicks = [0, Math.round(max / 2), max];
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const yFor = (v: number) => plotH - (v / max) * (plotH - 10) - 5;
  const points = data.map((d, i) => `${padLeft + i * stepX},${yFor(d.visitors)}`);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-36">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padLeft} x2={w} y1={yFor(t)} y2={yFor(t)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={0} y={yFor(t) + 3} fontSize="9" fill="var(--ink-faint)" fontFamily="var(--font-mono)">
            {t}명
          </text>
        </g>
      ))}

      <polyline points={points.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />

      {data.map((d, i) => (
        <g key={d.label + i}>
          <circle cx={padLeft + i * stepX} cy={yFor(d.visitors)} r={8} fill="transparent">
            <title>{`${d.label}: 방문자 ${d.visitors}명 · 조회 ${d.views}회`}</title>
          </circle>
          <circle cx={padLeft + i * stepX} cy={yFor(d.visitors)} r={2.5} fill="var(--accent)" />
          {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 8) === 0) && (
            <text x={padLeft + i * stepX} y={h - 4} fontSize="9" fill="var(--ink-faint)" textAnchor="middle" fontFamily="var(--font-mono)">
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
