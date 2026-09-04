"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CourseCardRow } from "@/lib/course-shared";
import { SPORTS, sportLabel } from "@/lib/course-shared";
import { deleteCourseAction } from "./actions";

// 스파크라인(SVG polyline) — 참고 구현체의 sparklinePath를 그대로 포팅
function sparklinePath(eArr: number[], w: number, h: number): string {
  if (!eArr || eArr.length < 2) return "";
  const n = Math.min(eArr.length, 80);
  const step = eArr.length / n;
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(eArr[Math.min(eArr.length - 1, Math.floor(i * step))]);
  const eMin = Math.min(...vals),
    eMax = Math.max(...vals);
  return vals
    .map((e, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - ((e - eMin) / Math.max(1, eMax - eMin)) * h * 0.86 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// km 범위 슬라이더 — 두 개의 range input을 겹쳐서 양쪽 손잡이로 최소/최대를 각각 잡는
// 흔한 트릭. 트랙은 pointer-events:none, 손잡이(::-webkit-slider-thumb 등)만 클릭 가능하게
// globals.css에서 처리한다.
function KmRangeSlider({
  bounds,
  value,
  onChange,
}: {
  bounds: { min: number; max: number };
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const span = Math.max(1, bounds.max - bounds.min);
  const loPct = ((lo - bounds.min) / span) * 100;
  const hiPct = ((hi - bounds.min) / span) * 100;
  const narrowed = lo !== bounds.min || hi !== bounds.max;
  return (
    <div className="flex flex-col gap-1.5 min-w-[220px] flex-1 bg-paper border border-line rounded-sm px-3 py-2">
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>📏 거리(km)로 좁혀보기</span>
        <span className="flex items-center gap-2">
          <span className="font-mono-brand text-ink font-medium [font-variant-numeric:tabular-nums]">
            {lo}km ~ {hi}km
          </span>
          {narrowed && (
            <button
              type="button"
              onClick={() => onChange([bounds.min, bounds.max])}
              className="text-accent hover:underline"
            >
              초기화
            </button>
          )}
        </span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-line" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-accent"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          className="km-range-thumb absolute inset-0 w-full"
          aria-label="최소 거리(km)"
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          className="km-range-thumb absolute inset-0 w-full"
          aria-label="최대 거리(km)"
        />
      </div>
    </div>
  );
}

export default function CourseLibrary({ courses }: { courses: CourseCardRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  // km 범위 필터 — 운동 종목을 하나 고른 상태에서만 활성화된다(코스가 많아질수록 "이
  // 종목 중에서 30~60km만" 같은 좁히기가 필요하다는 요청). [min, max] 또는 아직 안 정한
  // 상태(null, "전체"거나 그 종목 코스가 없을 때).
  const [kmRange, setKmRange] = useState<[number, number] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kmBounds = useMemo(() => {
    if (sportFilter === "all") return null;
    const kms = courses.filter((c) => c.sport === sportFilter).map((c) => c.totalKm);
    if (kms.length === 0) return null;
    return { min: Math.floor(Math.min(...kms)), max: Math.ceil(Math.max(...kms)) };
  }, [courses, sportFilter]);

  function selectSport(id: string) {
    setSportFilter(id);
    if (id === "all") {
      setKmRange(null);
      return;
    }
    const kms = courses.filter((c) => c.sport === id).map((c) => c.totalKm);
    setKmRange(kms.length ? [Math.floor(Math.min(...kms)), Math.ceil(Math.max(...kms))] : null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (sportFilter !== "all" && c.sport !== sportFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (sportFilter !== "all" && kmRange && (c.totalKm < kmRange[0] || c.totalKm > kmRange[1])) return false;
      return true;
    });
  }, [courses, query, sportFilter, kmRange]);

  async function handleDelete(e: React.MouseEvent, c: CourseCardRow) {
    e.stopPropagation();
    if (!window.confirm(`"${c.name}" 가이드를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeletingId(c.id);
    setError(null);
    try {
      await deleteCourseAction(c.id);
    } catch (err) {
      setError(`❌ 삭제에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5 flex-wrap items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="코스 이름으로 검색…"
          className="flex-1 min-w-[180px] border border-line rounded-sm bg-paper-raised text-ink text-sm px-3 py-2"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => selectSport("all")}
            className={`text-xs font-medium rounded-full border px-3 py-1.5 ${
              sportFilter === "all" ? "bg-accent text-accent-ink border-accent" : "bg-line border-line text-ink hover:bg-paper-raised"
            }`}
          >
            전체
          </button>
          {SPORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSport(s.id)}
              className={`text-xs font-medium rounded-full border px-3 py-1.5 ${
                sportFilter === s.id ? "bg-accent text-accent-ink border-accent" : "bg-line border-line text-ink hover:bg-paper-raised"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* km 범위 필터 — 운동 종목을 하나 고르면(=sportFilter !== "all") 그때만 나타난다 */}
      {sportFilter !== "all" && kmBounds && kmRange && kmBounds.min < kmBounds.max && (
        <KmRangeSlider bounds={kmBounds} value={kmRange} onChange={setKmRange} />
      )}

      {error && <p className="text-sm text-pending bg-pending-soft border border-pending/30 rounded-sm px-3 py-2">{error}</p>}

      {courses.length === 0 ? (
        <div className="bg-paper-raised border border-dashed border-line rounded-sm px-5 py-11 text-center text-ink-faint">
          <b className="block text-ink text-base mb-1.5">아직 쌓인 코스 가이드가 없어요</b>
          GPX 파일 하나로 지도·고도표·목표시간 계산까지 자동으로 만들어 드려요.
          <br />
          위의 ＋ 새 가이드를 눌러 첫 코스를 추가해보세요.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-paper-raised border border-line rounded-sm px-5 py-8 text-center text-ink-faint text-sm">
          검색·필터 조건에 맞는 코스가 없어요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((c) => {
            const path = sparklinePath(c.sparklineE, 280, 64);
            const dateStr = new Date(c.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
            const edited = c.updatedAt !== c.createdAt;
            const editedStr = edited
              ? ` · 수정 ${new Date(c.updatedAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}`
              : "";
            return (
              <div
                key={c.id}
                onClick={() => router.push(`/courses/${c.id}`)}
                className="bg-paper-raised border border-line rounded-sm overflow-hidden cursor-pointer shadow-[0_1px_2px_rgba(20,34,32,.06)] hover:shadow-[0_6px_16px_rgba(20,34,32,.1)] hover:-translate-y-0.5 transition-all"
              >
                <svg viewBox="0 0 280 64" preserveAspectRatio="none" className="block w-full h-16 bg-paper">
                  <polyline points={`0,64 ${path} 280,64`} fill="var(--accent-soft)" stroke="none" />
                  <polyline points={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
                </svg>
                <div className="px-3.5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-accent bg-accent-soft rounded-sm px-1.5 py-0.5">
                      {sportLabel(c.sport)}
                    </span>
                    <button
                      type="button"
                      disabled={deletingId === c.id}
                      onClick={(e) => handleDelete(e, c)}
                      title="삭제"
                      className="text-ink-faint hover:text-pending text-sm px-1 disabled:opacity-50"
                    >
                      {deletingId === c.id ? "…" : "🗑️"}
                    </button>
                  </div>
                  <h3 className="text-ink font-bold text-sm mb-1 leading-snug">{c.name}</h3>
                  <p className="text-ink-faint text-[11px] mb-2">
                    등록 {dateStr}
                    {editedStr}
                    {c.hasCutoff ? " · 공식 컷오프 반영" : ""}
                  </p>
                  <div className="flex gap-3.5 text-xs">
                    <div>
                      <b className="block font-mono-brand text-sm [font-variant-numeric:tabular-nums]">{c.totalKm.toFixed(1)}km</b>
                      <span className="text-[10px] text-ink-faint uppercase">거리</span>
                    </div>
                    <div>
                      <b className="block font-mono-brand text-sm [font-variant-numeric:tabular-nums]">+{c.gainM.toLocaleString()}m</b>
                      <span className="text-[10px] text-ink-faint uppercase">누적상승</span>
                    </div>
                    <div>
                      <b className="block font-mono-brand text-sm [font-variant-numeric:tabular-nums]">{c.cpCount}개</b>
                      <span className="text-[10px] text-ink-faint uppercase">CP</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
