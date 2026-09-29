"use client";

import { useState } from "react";
import Link from "next/link";
import type { CourseAppState, CourseDetail } from "@/lib/course-shared";
import { SPORTS } from "@/lib/course-shared";
import {
  parseGPX,
  buildTrack,
  parseCPText,
  waypointsToCPs,
  autoGenerateCPs,
  attachEleAndS,
  buildSArray,
  parsePeakText,
  parseStartDT,
  haversine,
  type GpxParsed,
} from "@/lib/course-calc";
import type { TrackData } from "@/lib/course-shared";
import CourseGuideView from "./CourseGuideView";

// 신규 생성 / 기존 편집 공용 폼 — 참고 구현체의 generate() 로직을 그대로 포팅.
// 편집 모드(existing 있음)에서는 GPX를 다시 올리지 않고 저장된 트랙 데이터를 재사용한다.

function cpsToText(cps: CourseDetail["cps"]): string {
  return cps.map((c) => [c.name, c.km.toFixed(2), c.limMin || 0, c.ele ?? "", c.cot || "", c.note || ""].join(",")).join("\n");
}

// ---------------- CP 칸 입력(기본 모드) — "파닥 CP 플래너" 참고 ----------------
// 수기로 한 줄씩 타이핑하는 대신 CP명/거리/컷오프/보급품을 각각 칸에 입력한다.
// parseCPText(course-calc.ts)의 5~6열 형식으로 직렬화해서 기존 파싱 파이프라인을
// 그대로 재사용한다(name,km,컷오프,,,비고 — ele/cot원문은 비워서 자동계산에 맡김).
type CpRow = { name: string; km: string; cutoff: string; supplies: string[]; extra: string };
const SUPPLY_OPTIONS = ["물", "음료", "간식", "식사", "의료", "화장실", "드롭백"];

function emptyCpRow(): CpRow {
  return { name: "", km: "", cutoff: "", supplies: [], extra: "" };
}

function serializeCpRows(rows: CpRow[]): string {
  const clean = (s: string) => s.replace(/,/g, " ").trim();
  return rows
    .filter((r) => r.name.trim() || r.km.trim())
    .map((r) => {
      const note = clean([...r.supplies, r.extra].filter(Boolean).join(" · "));
      return [clean(r.name), r.km.trim(), clean(r.cutoff), "", "", note].join(",");
    })
    .join("\n");
}

function CpRowEditor({ rows, onChange }: { rows: CpRow[]; onChange: React.Dispatch<React.SetStateAction<CpRow[]>> }) {
  // 항상 함수형 업데이트(onChange(prev => ...))로만 갱신한다 — 클로저가 붙잡은 rows
  // 스냅샷으로 계산하면, 리렌더가 끼어들기 전에 연속으로 여러 변경이 몰릴 때(예: 버튼을
  // 빠르게 두 번 누르는 경우) 뒤의 변경이 앞의 변경을 덮어써버리는 문제가 생긴다.
  function update(i: number, patch: Partial<CpRow>) {
    onChange((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleSupply(i: number, tag: string) {
    onChange((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const has = r.supplies.includes(tag);
        return { ...r, supplies: has ? r.supplies.filter((t) => t !== tag) : [...r.supplies, tag] };
      })
    );
  }
  function sortByKm() {
    onChange((prev) =>
      [...prev].sort((a, b) => {
        const ka = parseFloat(a.km),
          kb = parseFloat(b.km);
        if (isNaN(ka) && isNaN(kb)) return 0;
        if (isNaN(ka)) return 1;
        if (isNaN(kb)) return -1;
        return ka - kb;
      })
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="text-xs text-ink-faint py-2">
          아직 CP가 없어요. 아래 &quot;+ CP 추가&quot;로 지점을 하나씩 넣어보세요 — 비워두면 GPX 총거리를 8등분해서
          자동으로 만들어요.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="border border-line rounded-sm p-2.5 flex flex-col gap-2 bg-paper">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 text-[11px] text-ink-faint flex-1 min-w-[100px]">
              CP명
              <input
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={i === 0 ? "예: 출발" : "예: 급수대1"}
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-ink text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-faint w-24">
              거리(km)
              <input
                type="number"
                step="0.1"
                value={r.km}
                onChange={(e) => update(i, { km: e.target.value })}
                placeholder="0.0"
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-ink text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-faint w-28">
              컷오프 <span className="normal-case font-normal">(선택)</span>
              <input
                value={r.cutoff}
                onChange={(e) => update(i, { cutoff: e.target.value })}
                placeholder="1:40, 8h"
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-ink text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              title="이 CP 삭제"
              className="text-ink-faint hover:text-pending text-sm px-2 py-1.5"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-ink-faint">보급품</span>
            {SUPPLY_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleSupply(i, tag)}
                className={`text-xs rounded-full border px-2.5 py-1 ${
                  r.supplies.includes(tag)
                    ? "bg-accent text-accent-ink border-accent"
                    : "bg-paper-raised border-line text-ink-soft hover:bg-paper"
                }`}
              >
                {tag}
              </button>
            ))}
            <input
              value={r.extra}
              onChange={(e) => update(i, { extra: e.target.value })}
              placeholder="기타 메모"
              className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-ink text-xs flex-1 min-w-[100px]"
            />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange((prev) => [...prev, emptyCpRow()])}
          className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1.5 hover:bg-accent-soft"
        >
          + CP 추가
        </button>
        {rows.length > 1 && (
          <button
            type="button"
            onClick={sortByKm}
            className="text-sm text-ink-faint border border-line rounded-sm px-3 py-1.5 hover:bg-paper"
          >
            거리순 정렬
          </button>
        )}
      </div>
    </div>
  );
}
function peaksToText(peaks: CourseDetail["peaks"]): string {
  return peaks.map((p) => `${p.n},${p.km.toFixed(2)}`).join("\n");
}

// 기존 startDTraw("2026-09-18 14:00")를 달력/시계 입력칸에 다시 채우기 위한 분리
function splitStartDTraw(raw: string): { date: string; time: string } {
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})[\sT]+(\d{1,2}:\d{2})$/);
  if (!m) return { date: "", time: "" };
  const [h, mm] = m[2].split(":");
  return { date: m[1], time: `${h.padStart(2, "0")}:${mm}` };
}

export default function CourseForm({ existing }: { existing?: CourseDetail }) {
  const editing = !!existing;

  const [courseName, setCourseName] = useState(existing?.meta.name ?? "");
  const [sport, setSport] = useState(existing?.meta.sport ?? "marathon");
  const initSplit = splitStartDTraw(existing?.meta.startDTraw ?? "");
  const [startDateVal, setStartDateVal] = useState(initSplit.date);
  const [startTimeVal, setStartTimeVal] = useState(initSplit.time);
  // parseStartDT(course-calc.ts)가 그대로 인식하는 형식("YYYY-MM-DD HH:MM")으로 합친다 —
  // 달력/시계로만 고르면 이 문자열이 자동으로 완성되고, 별도 텍스트 입력은 필요 없다.
  const startDTraw = startDateVal ? `${startDateVal} ${startTimeVal || "00:00"}` : "";
  const [notes, setNotes] = useState(existing?.meta.notes ?? "");
  // CP 입력 — 기본은 칸 입력(cpRows), 파닥 CP 플래너 참고. 다만 기존 코스 편집 시에는
  // 기존 CP표(컷오프 원문·고도 등 칸 입력이 못 담는 값 포함)를 그대로 보존하기 위해
  // "표 붙여넣기" 모드로 시작한다 — 칸 입력으로 바꾸면 그 정보는 다시 안 채워진다.
  const [cpMode, setCpMode] = useState<"rows" | "paste">(existing ? "paste" : "rows");
  const [cpRows, setCpRows] = useState<CpRow[]>([]);
  const [cpText, setCpText] = useState(existing ? cpsToText(existing.cps) : "");
  const [peakText, setPeakText] = useState(existing ? peaksToText(existing.peaks) : "");

  const [gpxInfo, setGpxInfo] = useState("파일을 선택하면 트랙포인트 개수와 대략적 거리가 여기 표시됩니다.");
  const [gpxData, setGpxData] = useState<GpxParsed | null>(null);
  const [gpxError, setGpxError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const [generated, setGenerated] = useState<CourseAppState | null>(null);

  async function handleGpxFile(file: File | null) {
    setGpxData(null);
    setGpxError(null);
    if (!file) {
      setGpxInfo("파일을 선택하면 트랙포인트 개수와 대략적 거리가 여기 표시됩니다.");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseGPX(text);
      let dist = 0;
      for (let i = 1; i < parsed.pts.length; i++) {
        dist += haversine(parsed.pts[i - 1].lat, parsed.pts[i - 1].lon, parsed.pts[i].lat, parsed.pts[i].lon);
      }
      const wpInfo = parsed.waypoints.length > 0 ? `, CP 이름 ${parsed.waypoints.length}개 발견 ✨` : "";
      setGpxInfo(`✅ ${file.name} — 트랙포인트 ${parsed.pts.length.toLocaleString()}개, 약 ${(dist / 1000).toFixed(1)}km${wpInfo}`);
      setGpxData(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGpxInfo(`❌ 이 파일을 GPX로 읽을 수 없습니다: ${msg}`);
      setGpxError(msg);
    }
  }

  async function handleGenerate() {
    setGenStatus({ kind: "ok", text: "⏳ 처리 중..." });
    setGenerating(true);
    try {
      const name = courseName.trim();
      if (!name) throw new Error("코스 이름을 입력해주세요.");

      let track: TrackData;
      let waypoints: GpxParsed["waypoints"] = [];
      if (editing) {
        track = existing!.track; // GPX 재업로드 없이 저장된 트랙 데이터 재사용
      } else {
        if (!gpxData) throw new Error("GPX 파일을 선택해주세요.");
        track = buildTrack(gpxData.pts, gpxData.hasTime, 900);
        waypoints = gpxData.waypoints;
      }

      // 칸 입력 모드면 행들을 기존 파싱 파이프라인이 읽는 텍스트 형식으로 직렬화 —
      // "표 붙여넣기" 모드면 그 텍스트를 그대로 쓴다.
      const effectiveCpText = cpMode === "rows" ? serializeCpRows(cpRows) : cpText;

      let cps, cpSource: "paste" | "gpx" | "auto";
      if (effectiveCpText.trim()) {
        cps = parseCPText(effectiveCpText, track.d);
        cpSource = "paste";
        if (cps.length === 0) {
          if (waypoints.length > 0) {
            cps = waypointsToCPs(waypoints, track);
            cpSource = "gpx";
          } else {
            cps = autoGenerateCPs(track, 8);
            cpSource = "auto";
          }
        }
      } else if (waypoints.length > 0) {
        cps = waypointsToCPs(waypoints, track);
        cpSource = "gpx";
      } else {
        cps = autoGenerateCPs(track, 8);
        cpSource = "auto";
      }

      const hasLim = (cps[cps.length - 1].limMin || 0) > 0;
      cps = attachEleAndS(cps, track);
      track = { ...track, s: buildSArray(track, cps, hasLim) };
      const paceModel = hasLim ? "컷오프 기준" : track.t ? "GPX 실측시간 기준" : "거리+고도 가중치 기준";
      const peaks = parsePeakText(peakText, track);
      const startDT = parseStartDT(startDTraw);

      const gainM = track.cg[track.cg.length - 1];
      const totalKm = track.d[track.d.length - 1];

      const app: CourseAppState = {
        track,
        cps,
        peaks,
        startDT: startDT ? startDT.toISOString() : null,
        meta: {
          name,
          sport,
          notes: notes.trim(),
          startDTraw,
          totalKm,
          gainM,
          cpCount: cps.length,
          hasCutoff: hasLim,
          cpSource,
          paceModel,
        },
      };

      const srcLabel =
        cpSource === "paste" ? "붙여넣은 표" : cpSource === "gpx" ? `GPX 안의 CP 이름(${cps.length}개)` : "GPX 거리 균등분할(표 없음)";
      const anomalyNote = track.timeAnomalies > 0 ? ` ⚠️ GPX 시간기록에 이상 구간 ${track.timeAnomalies}곳 발견(30분으로 보정함).` : "";
      const startDTWarn = startDTraw.trim() && !startDT ? " ⚠️ 출발일시를 인식하지 못해 경과시간으로만 표시됩니다." : "";
      const summary = `${editing ? "✏️ 변경사항이 반영된" : "✅"} 미리보기${
        editing ? "입니다" : "가 생성되었습니다"
      }. CP 출처: ${srcLabel} · 페이스 모델: ${paceModel}${anomalyNote}${startDTWarn}`;

      setGenStatus({ kind: anomalyNote || startDTWarn ? "warn" : "ok", text: summary });
      setGenerated(app);
    } catch (err) {
      setGenStatus({ kind: "err", text: `❌ 오류: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setGenerating(false);
    }
  }

  if (generated) {
    return (
      <div className="flex flex-col gap-4">
        {genStatus && (
          <p
            className={`text-sm border rounded-sm px-3 py-2 ${
              genStatus.kind === "ok"
                ? "bg-good-soft border-good/30 text-ink"
                : genStatus.kind === "warn"
                ? "bg-gold-soft border-gold/30 text-ink"
                : "bg-pending-soft border-pending/30 text-ink"
            }`}
          >
            {genStatus.text}
          </p>
        )}
        <CourseGuideView appState={generated} mode={editing ? "edit" : "new"} courseId={editing ? existing!.id : null} />
        <button
          type="button"
          onClick={() => setGenerated(null)}
          className="self-start text-sm text-ink-faint hover:text-ink-soft underline"
        >
          ← 정보 다시 입력하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!editing && (
        <div className="bg-paper-raised border border-line rounded-sm p-4">
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="bg-accent text-accent-ink w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold">
              1
            </span>
            GPX 파일
          </h2>
          <input
            type="file"
            accept=".gpx"
            onChange={(e) => handleGpxFile(e.target.files?.[0] ?? null)}
            className="w-full border border-line rounded-sm bg-paper text-ink text-sm px-2.5 py-2"
          />
          <p className={`text-xs mt-1.5 leading-relaxed ${gpxError ? "text-pending" : "text-ink-faint"}`}>{gpxInfo}</p>
        </div>
      )}
      {editing && (
        <p className="text-sm bg-accent-soft border border-accent/30 text-ink rounded-sm px-3 py-2">
          ✏️ 이 코스를 편집하고 있습니다 — GPX는 그대로 두고 정보·CP표·봉우리만 다시 계산합니다.
        </p>
      )}

      <div className="bg-paper-raised border border-line rounded-sm p-4">
        <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <span className="bg-accent text-accent-ink w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold">
            2
          </span>
          대회·코스 정보
        </h2>
        <label className="block text-xs font-medium text-ink-faint mb-1.5">
          코스 이름 <span className="text-accent">*</span>
        </label>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="예: OO트레일레이스 100K"
          className="w-full border border-line rounded-sm bg-paper text-ink text-sm px-2.5 py-2"
        />
        <label className="block text-xs font-medium text-ink-faint mt-3 mb-1.5">종목</label>
        <div className="flex gap-1.5 flex-wrap">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSport(s.id)}
              className={`text-sm rounded-full border px-3 py-1.5 ${
                sport === s.id ? "bg-accent text-accent-ink border-accent" : "bg-paper border-line text-ink hover:bg-paper-raised"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-ink-faint mb-1.5">출발 일시 (선택)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDateVal}
                onChange={(e) => setStartDateVal(e.target.value)}
                className="flex-1 min-w-0 border border-line rounded-sm bg-paper text-ink text-sm px-2.5 py-2"
              />
              <input
                type="time"
                value={startTimeVal}
                onChange={(e) => setStartTimeVal(e.target.value)}
                disabled={!startDateVal}
                className="w-[110px] border border-line rounded-sm bg-paper text-ink text-sm px-2.5 py-2 disabled:opacity-50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-faint mb-1.5">메모 (선택)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 3회차 도전, 우천 대비 등"
              className="w-full border border-line rounded-sm bg-paper text-ink text-sm px-2.5 py-2"
            />
          </div>
        </div>
        <p className="text-xs text-ink-faint mt-2">출발 일시는 CP 통과 예상 시각(요일·시각) 계산에 쓰입니다. 비워두면 경과시간만 표시돼요.</p>
      </div>

      <div className="bg-paper-raised border border-line rounded-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <span className="bg-accent text-accent-ink w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold">
              3
            </span>
            체크포인트(CP) <span className="font-normal text-xs text-ink-faint">(선택)</span>
          </h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCpMode("rows")}
              className={`text-xs font-medium rounded-full border px-3 py-1 ${
                cpMode === "rows" ? "bg-accent text-accent-ink border-accent" : "bg-paper border-line text-ink-soft hover:bg-paper-raised"
              }`}
            >
              칸 입력
            </button>
            <button
              type="button"
              onClick={() => setCpMode("paste")}
              className={`text-xs font-medium rounded-full border px-3 py-1 ${
                cpMode === "paste" ? "bg-accent text-accent-ink border-accent" : "bg-paper border-line text-ink-soft hover:bg-paper-raised"
              }`}
            >
              표 붙여넣기
            </button>
          </div>
        </div>

        {cpMode === "rows" ? (
          <>
            <CpRowEditor rows={cpRows} onChange={setCpRows} />
            {editing && cpText.trim() && (
              <p className="text-xs text-pending mt-2">
                ⚠️ 이 코스에 저장된 CP표가 있어요 — 칸 입력으로 저장하면 컷오프 원문·고도 같은 값은 다시 안
                채워져요. 기존 값을 지키려면 &quot;표 붙여넣기&quot; 탭을 쓰세요.
              </p>
            )}
          </>
        ) : (
          <>
            <textarea
              value={cpText}
              onChange={(e) => setCpText(e.target.value)}
              rows={7}
              placeholder={`대회 사이트 표를 그대로 복사해 붙여넣어도 되고, 직접 입력해도 됩니다.
예1) 사이트에서 복사한 표 그대로:
장소  CP  누적거리(km)  구간거리(km)  제한시간  컷오프  고도(m)  ...
장수종합경기장  START  0  0  0  토 08:10  440  ...
신덕산마을  A1  4.9  4.9  1h40m  토 09:50  751  ...

예2) 직접 입력:
장수종합경기장,0,0,440,금 14:00,출발
와룡자연휴양림,10.8,110,748,금 15:50,`}
              className="w-full border border-line rounded-sm bg-paper text-ink font-mono-brand text-xs px-2.5 py-2 leading-relaxed resize-y"
            />
            <p className="text-xs text-ink-faint mt-2 leading-relaxed">
              · 헤더 줄·각주(※...)·빈 줄은 자동으로 무시됩니다.
              <br />· 제한시간은 &quot;1h40m&quot;, &quot;8h&quot;, &quot;1:40&quot;, 또는 그냥 분(110) 등 다양한 표기를 인식합니다.
            </p>
          </>
        )}
        <p className="text-xs text-ink-faint mt-2">
          <b className="text-ink">CP가 없어도 괜찮습니다</b> — 비워두면 GPX 총거리를 8등분해서 기준점을 자동으로 만듭니다.
        </p>
      </div>

      <div className="bg-paper-raised border border-line rounded-sm p-4">
        <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <span className="bg-accent text-accent-ink w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold">
            4
          </span>
          주요 봉우리 <span className="font-normal text-xs text-ink-faint">(선택)</span>
        </h2>
        <label className="block text-xs text-ink-faint mb-1.5">
          형식: <code className="font-mono-brand">이름,누적거리(km)</code> — 없으면 최고점이 자동 표시됩니다.
        </label>
        <textarea
          value={peakText}
          onChange={(e) => setPeakText(e.target.value)}
          rows={3}
          placeholder={"예)\n정상봉,45.2\n전망대,78.9"}
          className="w-full border border-line rounded-sm bg-paper text-ink font-mono-brand text-xs px-2.5 py-2 leading-relaxed resize-y"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="bg-accent text-accent-ink font-bold text-sm rounded-sm px-6 py-3 hover:opacity-90 disabled:opacity-50"
        >
          {generating ? "⏳ 처리 중..." : editing ? "🔁 미리보기 다시 만들기" : "🚀 코스 가이드 생성"}
        </button>
        <Link href="/courses" className="text-sm text-ink-faint hover:text-ink-soft underline">
          ← 목록으로
        </Link>
      </div>
      {genStatus && (
        <p
          className={`text-sm border rounded-sm px-3 py-2 ${
            genStatus.kind === "ok"
              ? "bg-good-soft border-good/30 text-ink"
              : genStatus.kind === "warn"
              ? "bg-gold-soft border-gold/30 text-ink"
              : "bg-pending-soft border-pending/30 text-ink"
          }`}
        >
          {genStatus.text}
        </p>
      )}
    </div>
  );
}
