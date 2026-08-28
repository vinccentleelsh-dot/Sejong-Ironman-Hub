// 종목별 대회 통계용 도넛 차트 — 서버 컴포넌트로 그대로 렌더링(상호작용은 네이티브 <title>
// 호버 툴팁만 사용하므로 "use client"가 필요 없음, 클라이언트 번들에 안 들어감).
// 색상은 dataviz 스킬 검증을 통과한 5색 순서(파랑/주황/아쿠아/노랑/마젠타)를 그대로 씀 —
// 임의 배색은 색약 대비 검증에서 떨어졌음(README 격 커밋 로그 참고).

export type DonutSlice = { label: string; value: number; color: string };

const SIZE = 140;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_PX = 3; // 세그먼트 사이 여백 (배경색이 비치는 틈 — marks-and-anatomy의 "surface gap")

export default function DonutChart({
  title,
  unit,
  data,
}: {
  title: string;
  unit: string; // "건" | "명"
  data: DonutSlice[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.filter((d) => d.value > 0);

  let cumulative = 0;
  const segments = visible.map((d) => {
    const rawLen = (d.value / total) * CIRCUMFERENCE;
    const len = Math.max(rawLen - (visible.length > 1 ? GAP_PX : 0), 0);
    const offset = -cumulative;
    cumulative += rawLen;
    return { ...d, len, offset, pct: (d.value / total) * 100 };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent self-start">{title}</p>
      {total === 0 ? (
        <p className="text-sm text-ink-faint py-8">데이터 없음</p>
      ) : (
        <>
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth={STROKE}
                />
                {segments.map((s) => (
                  <circle
                    key={s.label}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${s.len} ${CIRCUMFERENCE - s.len}`}
                    strokeDashoffset={s.offset}
                    strokeLinecap="butt"
                  >
                    <title>{`${s.label}: ${s.value.toLocaleString("ko-KR")}${unit} (${s.pct.toFixed(0)}%)`}</title>
                  </circle>
                ))}
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-display text-2xl text-ink [font-variant-numeric:tabular-nums]">{total}</span>
              <span className="text-[10px] text-ink-faint">{unit}</span>
            </div>
          </div>

          <ul className="w-full flex flex-col gap-1">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-ink-soft truncate">{s.label}</span>
                </span>
                <span className="font-mono-brand text-ink [font-variant-numeric:tabular-nums] whitespace-nowrap">
                  {s.value}
                  {unit} · {s.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
