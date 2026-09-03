"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CourseAppState } from "@/lib/course-shared";
import { sportLabel } from "@/lib/course-shared";
import { fmtT, tod, niceStep } from "@/lib/course-calc";
import { toCsv } from "@/lib/csv";

// 큐시트 — 대회 중(햇빛 아래 화면 또는 인쇄물)에 한눈에 읽혀야 하므로, 앱의 --accent/--ink
// 같은 다크모드 대응 CSS 변수를 안 쓰고 항상 "흰 종이 위 진한 글씨"로 고정한다. 다크모드로
// 앱을 보고 있어도 큐시트만큼은 인쇄물과 동일하게 보이는 게 맞다는 판단(2026.09 결정).
const CS = {
  ink: "#0a0a0a",
  inkSoft: "#3a4642",
  line: "#c7ccc8",
  lineStrong: "#1a1a1a",
  accent: "#0b6b66",
  accentSoft: "#e3efed",
  warn: "#c1121f",
  warnSoft: "#fbe6e4",
  safe: "#1f6b45",
  rowAlt: "#f4f5f3",
};

// 나중에 텍스트 이스케이프가 필요해지면 여기만 고치면 되게(상세 페이지 표와 동일한 관례) —
// React가 어차피 자동 이스케이프하므로 지금은 항등함수.
function escapeHtml(s: string): string {
  return s;
}

export default function CueSheetView({
  appState,
  courseId,
  initialGoalHours,
}: {
  appState: CourseAppState;
  courseId: string;
  initialGoalHours: number | null;
}) {
  const { track, cps, meta, startDT } = appState;
  const totalKm = track.d[track.d.length - 1];
  const totalLim = cps[cps.length - 1]?.limMin || 0;
  const isBike = meta.sport === "cycle"; // 자전거/그란폰도만 평속, 나머지는 전부 페이스 — 요구사항 그대로
  const startDTDate = startDT ? new Date(startDT) : null;

  const [goal, setGoal] = useState(() => {
    if (initialGoalHours && initialGoalHours > 0) return initialGoalHours;
    if (totalLim) return Math.round(((totalLim / 60) * 0.9) * 10) / 10;
    return Math.round((totalKm / 8) * 10) / 10;
  });
  const goalMin = goal * 60;
  const goalMax = totalLim ? (totalLim / 60) * 1.05 : Math.ceil(totalKm / 3);

  const avgSpeed = totalKm / (goalMin / 60);
  const avgPaceMin = goalMin / totalKm;
  const apm = Math.floor(avgPaceMin),
    aps = Math.round((avgPaceMin - apm) * 60);

  const pills: Array<{ h: number; label: string }> = totalLim
    ? [
        { h: Math.round(totalLim * 0.75) / 60, label: "75%" },
        { h: Math.round(totalLim * 0.85) / 60, label: "85%" },
        { h: Math.round(totalLim * 0.95) / 60, label: "95%" },
        { h: totalLim / 60, label: "컷오프" },
      ]
    : [
        { h: totalKm * 0.1, label: "빠름" },
        { h: totalKm * 0.13, label: "보통" },
        { h: totalKm * 0.16, label: "여유" },
      ];

  // ---------------- 행별 계산 — 상세 페이지 표와 같은 공식, 컬럼만 요청받은 7개로 추림 ----------------
  const rows = cps.map((c, i) => {
    const t = c.s * goalMin;
    const prev = i > 0 ? cps[i - 1] : null;
    const segKm = c.km - (prev?.km ?? 0);
    const segMin = t - (prev ? prev.s * goalMin : 0);
    const segGain = Math.max(0, Math.round((c.cgain || 0) - (prev?.cgain || 0)));
    let paceOrSpeed = "—";
    let paceOrSpeedRaw = "";
    if (segKm > 0.01 && segMin > 0) {
      if (isBike) {
        const speed = segKm / (segMin / 60);
        paceOrSpeed = `${speed.toFixed(1)} km/h`;
        paceOrSpeedRaw = speed.toFixed(1);
      } else {
        const pace = segMin / segKm;
        const pm = Math.floor(pace),
          ps = Math.round((pace - pm) * 60);
        paceOrSpeed = `${pm}:${String(ps).padStart(2, "0")}/km`;
        paceOrSpeedRaw = `${pm}:${String(ps).padStart(2, "0")}`;
      }
    }
    // 상세 페이지의 "여유"(slack) 계산과 같은 부등식 — 컷오프 초과 여부만 색으로 표시하고
    // 별도 컬럼은 만들지 않는다(요청받은 7개 컬럼만 유지하기 위함).
    const overCutoff = !!(c.limMin && c.limMin - t < -0.5);
    return { c, t, segGain, paceOrSpeed, paceOrSpeedRaw, overCutoff };
  });

  // ---------------- CSV 다운로드 — 사용자가 직접 열어서 고칠 수 있는 포맷 ----------------
  function downloadCsv() {
    const header = [
      "CP",
      "이름",
      "누적거리(km)",
      "구간상승(m)",
      "누적상승(m)",
      "예상시각",
      isBike ? "구간평속(km/h)" : "구간페이스(분:초/km)",
      "컷오프",
    ];
    const body = rows.map(({ c, t, segGain, paceOrSpeedRaw }) => [
      c.code,
      c.name,
      c.km.toFixed(1),
      segGain,
      c.cgain || 0,
      tod(t, startDTDate),
      paceOrSpeedRaw,
      c.limMin ? fmtT(c.limMin) : "",
    ]);
    const csv = toCsv(header, body);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(meta.name || "course").replace(/[\\/:*?"<>|]/g, "_")}-큐시트.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------------- 고도 프로파일 — 큐시트 전용: 굵고 진하게, 호버 인터랙션 없이 정적으로 ----------------
  const profRef = useRef<HTMLCanvasElement>(null);
  const drawProf = useCallback(() => {
    const cv = profRef.current;
    if (!cv) return;
    const r = window.devicePixelRatio || 1;
    const b = cv.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    cv.width = Math.round(b.width * r);
    cv.height = Math.round(b.height * r);
    const g = cv.getContext("2d");
    if (!g) return;
    g.setTransform(r, 0, 0, r, 0, 0);
    const w = b.width,
      h = b.height,
      L = 50,
      R = 12,
      T = 26,
      B = 30;
    const kmMax = track.d[track.d.length - 1];
    let eMin = track.e[0],
      eMax = track.e[0];
    for (let i = 1; i < track.e.length; i++) {
      if (track.e[i] < eMin) eMin = track.e[i];
      if (track.e[i] > eMax) eMax = track.e[i];
    }
    const X = (km: number) => L + (km / kmMax) * (w - L - R);
    const Y = (e: number) => T + (1 - (e - eMin) / Math.max(1, eMax - eMin)) * (h - T - B);
    g.clearRect(0, 0, w, h);

    g.beginPath();
    g.moveTo(X(0), Y(eMin));
    track.d.forEach((km, i) => g.lineTo(X(km), Y(track.e[i])));
    g.lineTo(X(kmMax), Y(eMin));
    g.closePath();
    g.fillStyle = CS.accentSoft;
    g.fill();

    g.beginPath();
    track.d.forEach((km, i) => (i ? g.lineTo(X(km), Y(track.e[i])) : g.moveTo(X(km), Y(track.e[i]))));
    g.strokeStyle = CS.accent;
    g.lineWidth = 3;
    g.stroke();

    const eStep = niceStep(eMax - eMin, 4);
    g.font = '700 11px "IBM Plex Mono",monospace';
    for (let e = Math.ceil(eMin / eStep) * eStep; e <= eMax + 1e-6; e += eStep) {
      const yTick = Y(e);
      g.strokeStyle = CS.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(L, yTick);
      g.lineTo(w - R, yTick);
      g.stroke();
      g.fillStyle = CS.inkSoft;
      g.textAlign = "right";
      g.textBaseline = "middle";
      g.fillText(Math.round(e).toLocaleString() + "m", L - 6, yTick);
    }

    const kmStep = niceStep(kmMax, 6);
    const kmDecimals = kmStep < 1 ? 1 : 0;
    for (let km = 0; km <= kmMax + 1e-6; km += kmStep) {
      const xTick = X(Math.min(km, kmMax));
      g.strokeStyle = CS.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(xTick, T);
      g.lineTo(xTick, h - B + 4);
      g.stroke();
      g.fillStyle = CS.inkSoft;
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillText(km.toFixed(kmDecimals) + "km", xTick, h - B + 17);
    }

    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    const usedX: number[] = [];
    cps.forEach((c) => {
      const x = X(c.km);
      const yCurve = Y(track.e[c.idx]);
      g.beginPath();
      g.moveTo(x, T);
      g.lineTo(x, yCurve);
      g.strokeStyle = CS.lineStrong;
      g.lineWidth = 1.2;
      g.setLineDash([3, 2]);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(x, yCurve, 4, 0, 7);
      g.fillStyle = "#ffffff";
      g.fill();
      g.strokeStyle = CS.accent;
      g.lineWidth = 2.5;
      g.stroke();
      if (usedX.length === 0 || Math.abs(x - usedX[usedX.length - 1]) > 22) {
        g.font = '800 11px "IBM Plex Sans KR","IBM Plex Sans",sans-serif';
        g.fillStyle = CS.lineStrong;
        g.fillText(c.code, x, T - 8);
        usedX.push(x);
      }
    });
  }, [track, cps]);

  useEffect(() => {
    drawProf();
  }, [drawProf]);

  useEffect(() => {
    const cv = profRef.current;
    if (!cv || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => drawProf());
    ro.observe(cv);
    const t1 = setTimeout(() => drawProf(), 150);
    window.addEventListener("resize", drawProf);
    // 인쇄 시 레이아웃이 좁아지며 캔버스 크기가 바뀌므로 인쇄 전후로도 다시 그린다.
    window.addEventListener("beforeprint", drawProf);
    window.addEventListener("afterprint", drawProf);
    return () => {
      ro.disconnect();
      clearTimeout(t1);
      window.removeEventListener("resize", drawProf);
      window.removeEventListener("beforeprint", drawProf);
      window.removeEventListener("afterprint", drawProf);
    };
  }, [drawProf]);

  return (
    <div className="flex flex-col gap-5 cuesheet-print">
      <div className="print:hidden flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-ink">{meta.name || "—"} · 큐시트</h2>
          <p className="text-sm text-ink-faint mt-0.5">
            {sportLabel(meta.sport)} · {totalKm.toFixed(1)}km · +{track.cg[track.cg.length - 1].toLocaleString()}m
          </p>
        </div>
        <Link href={`/courses/${courseId}`} className="text-sm text-accent hover:underline">
          ← 코스 상세로
        </Link>
      </div>

      {/* 목표시간 설정 — 인쇄에는 안 나가고, 결과(아래 요약 줄 + 표)만 나간다 */}
      <div className="print:hidden bg-paper border border-line rounded-sm p-4">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">⏱️ 목표 완주 시간 설정</p>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="font-mono-brand text-2xl font-bold min-w-[80px] [font-variant-numeric:tabular-nums]">
            {fmtT(goalMin)}
          </span>
          <input
            type="range"
            min={1}
            max={goalMax}
            step={0.0833}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="flex-1 min-w-[180px] accent-[var(--accent)]"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {pills.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setGoal(Math.round(p.h * 60) / 60)}
              className={`text-xs rounded-full border px-3 py-1 ${
                Math.abs(p.h * 60 - goalMin) < 1
                  ? "bg-accent text-accent-ink border-accent"
                  : "bg-paper-raised border-line text-ink hover:bg-paper"
              }`}
            >
              {p.label} ({fmtT(p.h * 60)})
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={downloadCsv}
            className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-2 hover:opacity-90"
          >
            ⬇ CSV로 다운로드 (엑셀에서 직접 수정 가능)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-line text-ink text-sm rounded-sm px-4 py-2 hover:bg-paper-raised"
          >
            🖨️ 인쇄
          </button>
        </div>
      </div>

      {/* 목표시간 요약 — 화면·인쇄 둘 다 보임 */}
      <p className="text-sm font-semibold" style={{ color: CS.ink }}>
        🎯 목표 완주시간 <span className="font-mono-brand">{fmtT(goalMin)}</span> · 평균{" "}
        {isBike ? `${avgSpeed.toFixed(1)} km/h` : `${apm}:${String(aps).padStart(2, "0")}/km`}
      </p>

      {/* 고도 프로파일 */}
      <div
        className="rounded-sm overflow-hidden"
        style={{ background: "#ffffff", border: `1.5px solid ${CS.lineStrong}`, height: 190 }}
      >
        <canvas ref={profRef} className="w-full h-full block" />
      </div>

      {/* CP 표 — 대회 중 가독성 최우선(큰 글씨·굵게·고대비), 컷오프 초과 위험은 빨간색으로 */}
      <div className="overflow-x-auto rounded-sm" style={{ border: `1.5px solid ${CS.lineStrong}` }}>
        <table className="w-full border-collapse" style={{ background: "#ffffff" }}>
          <thead>
            <tr>
              {["CP", "누적km", "구간상승", "누적상승", "예상시각", isBike ? "구간평속" : "구간페이스", "컷오프"].map((h) => (
                <th
                  key={h}
                  className="px-2 py-2.5 text-center whitespace-nowrap"
                  style={{ background: CS.lineStrong, color: "#ffffff", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, t, segGain, paceOrSpeed, overCutoff }, i) => (
              <tr key={c.code} style={{ background: i % 2 ? CS.rowAlt : "#ffffff" }}>
                <td className="px-2 py-2.5 text-center" style={{ borderTop: `1px solid ${CS.line}` }}>
                  <span
                    className="inline-flex items-center justify-center rounded-full font-mono-brand"
                    style={{ background: CS.accent, color: "#ffffff", fontWeight: 800, fontSize: 18, minWidth: 44, padding: "3px 8px" }}
                  >
                    {c.code}
                  </span>
                  <br />
                  <span style={{ fontSize: 11.5, color: CS.inkSoft }}>{escapeHtml(c.name)}</span>
                </td>
                <td
                  className="px-2 py-2.5 text-center font-mono-brand [font-variant-numeric:tabular-nums]"
                  style={{ borderTop: `1px solid ${CS.line}`, fontSize: 15, fontWeight: 600, color: CS.ink }}
                >
                  {c.km.toFixed(1)}
                </td>
                <td
                  className="px-2 py-2.5 text-center font-mono-brand [font-variant-numeric:tabular-nums]"
                  style={{ borderTop: `1px solid ${CS.line}`, fontSize: 15, fontWeight: 600, color: CS.ink }}
                >
                  {segGain > 0 ? `+${segGain}m` : "—"}
                </td>
                <td
                  className="px-2 py-2.5 text-center font-mono-brand [font-variant-numeric:tabular-nums]"
                  style={{ borderTop: `1px solid ${CS.line}`, fontSize: 15, fontWeight: 600, color: CS.ink }}
                >
                  +{(c.cgain || 0).toLocaleString()}m
                </td>
                <td
                  className="px-2 py-2.5 text-center font-mono-brand [font-variant-numeric:tabular-nums]"
                  style={{
                    borderTop: `1px solid ${CS.line}`,
                    fontSize: 19,
                    fontWeight: 800,
                    color: overCutoff ? CS.warn : CS.ink,
                    background: overCutoff ? CS.warnSoft : undefined,
                  }}
                >
                  {tod(t, startDTDate)}
                </td>
                <td
                  className="px-2 py-2.5 text-center font-mono-brand [font-variant-numeric:tabular-nums]"
                  style={{ borderTop: `1px solid ${CS.line}`, fontSize: 15, fontWeight: 600, color: CS.ink }}
                >
                  {paceOrSpeed}
                </td>
                <td
                  className="px-2 py-2.5 text-center font-mono-brand [font-variant-numeric:tabular-nums]"
                  style={{
                    borderTop: `1px solid ${CS.line}`,
                    fontSize: 17,
                    fontWeight: c.limMin ? 800 : 400,
                    color: overCutoff ? CS.warn : c.limMin ? CS.safe : CS.inkSoft,
                    background: overCutoff ? CS.warnSoft : undefined,
                  }}
                >
                  {c.limMin ? fmtT(c.limMin) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="print:hidden text-xs text-ink-faint">
        * 예상시각·컷오프가 빨간색이면 이 목표시간으로는 해당 CP를 컷오프 안에 못 들어와요. 위 슬라이더로 목표시간을 조정해보세요.
      </p>
    </div>
  );
}
