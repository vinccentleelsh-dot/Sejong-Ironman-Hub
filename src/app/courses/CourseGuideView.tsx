"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CourseAppState, CoursePayload } from "@/lib/course-shared";
import { sportLabel } from "@/lib/course-shared";
import { fmtT, tod, niceStep, nearestIdxByKm, segIndexFor } from "@/lib/course-calc";
import { createCourseAction, updateCourseAction, deleteCourseAction } from "./actions";

// 코스 가이드 화면 — 지도/고도 프로파일(캔버스 자체 렌더링)/CP표/목표시간 슬라이더.
// 참고 구현체(course-guide-archive-reference.html)의 drawMap/drawProf/refresh/update 로직을
// React 컴포넌트로 그대로 포팅한 것 — 신규 미리보기(new)/편집 미리보기(edit)/저장된 코스
// 상세보기(detail) 세 모드에서 공용으로 쓴다.

function cssv(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function eleColor(e: number, eMin: number, eMax: number): string {
  const t = (e - eMin) / Math.max(1, eMax - eMin);
  return `hsl(${205 - 165 * t} ${45 + 35 * t}% ${58 - 18 * t}%)`;
}
function escapeHtml(s: string): string {
  return s;
}

export default function CourseGuideView({
  appState,
  mode,
  courseId,
}: {
  appState: CourseAppState;
  mode: "new" | "edit" | "detail";
  courseId: string | null;
}) {
  const router = useRouter();
  const { track, cps, peaks, startDT, meta } = appState;
  const totalKm = track.d[track.d.length - 1];
  const totalLim = cps[cps.length - 1]?.limMin || 0;

  const mapRef = useRef<HTMLCanvasElement>(null);
  const profRef = useRef<HTMLCanvasElement>(null);
  const projRef = useRef<{ px: (lon: number) => number; py: (lat: number) => number } | null>(null);

  const [cur, setCur] = useState(-1);
  const [goal, setGoal] = useState(() => {
    if (totalLim) return Math.round(((totalLim / 60) * 0.9) * 10) / 10;
    return Math.round((totalKm / 8) * 10) / 10; // 시간(h) 단위, 슬라이더 표시용
  });
  const goalMin = goal * 60;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  // ---------------- 캔버스: 고도 프로파일 ----------------
  const drawProf = useCallback(() => {
    const cv = profRef.current;
    if (!cv) return;
    try {
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
        L = 44,
        R = 10,
        T = 22,
        B = 34;
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
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `color-mix(in srgb, ${cssv("--accent")} 35%, transparent)`);
      grad.addColorStop(1, `color-mix(in srgb, ${cssv("--accent")} 2%, transparent)`);
      g.fillStyle = grad;
      g.fill();
      g.beginPath();
      track.d.forEach((km, i) => (i ? g.lineTo(X(km), Y(track.e[i])) : g.moveTo(X(km), Y(track.e[i]))));
      g.strokeStyle = cssv("--accent");
      g.lineWidth = 2;
      g.stroke();

      const eStep = niceStep(eMax - eMin, 5);
      g.font = '500 9px "IBM Plex Mono",monospace';
      for (let e = Math.ceil(eMin / eStep) * eStep; e <= eMax + 1e-6; e += eStep) {
        const yTick = Y(e);
        g.strokeStyle = cssv("--line");
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(L, yTick);
        g.lineTo(w - R, yTick);
        g.stroke();
        g.fillStyle = cssv("--ink-faint");
        g.textAlign = "right";
        g.textBaseline = "middle";
        g.fillText(Math.round(e).toLocaleString() + "m", L - 6, yTick);
      }

      const kmStep = niceStep(kmMax, 6);
      const kmDecimals = kmStep < 1 ? 1 : 0;
      for (let km = 0; km <= kmMax + 1e-6; km += kmStep) {
        const xTick = X(Math.min(km, kmMax));
        g.strokeStyle = cssv("--line");
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(xTick, T);
        g.lineTo(xTick, h - B + 4);
        g.stroke();
        g.fillStyle = cssv("--ink-faint");
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillText(km.toFixed(kmDecimals) + "km", xTick, h - B + 16);
      }

      g.fillStyle = cssv("--ink-faint");
      g.font = '600 9px "IBM Plex Sans",sans-serif';
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillText("거리(km) →", L + (w - L - R) / 2, h - 3);
      g.save();
      g.translate(11, T + (h - T - B) / 2);
      g.rotate(-Math.PI / 2);
      g.fillText("← 고도(m)", 0, 0);
      g.restore();

      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      const usedX: number[] = [];
      cps.forEach((c) => {
        const x = X(c.km);
        const idx = c.idx ?? nearestIdxByKm(track.d, c.km);
        const yCurve = Y(track.e[idx]);
        g.beginPath();
        g.moveTo(x, T);
        g.lineTo(x, yCurve);
        g.strokeStyle = cssv("--line");
        g.lineWidth = 1;
        g.setLineDash([2, 2]);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.arc(x, yCurve, 3.5, 0, 7);
        g.fillStyle = cssv("--paper-raised");
        g.fill();
        g.strokeStyle = cssv("--accent");
        g.lineWidth = 2;
        g.stroke();
        if (usedX.length === 0 || Math.abs(x - usedX[usedX.length - 1]) > 18) {
          g.font = '700 9px "IBM Plex Sans",sans-serif';
          g.textAlign = "center";
          g.fillStyle = cssv("--accent");
          g.fillText(c.code, x, T - 7);
          usedX.push(x);
        }
      });
      if (cur >= 0) {
        const km = track.d[cur];
        g.beginPath();
        g.moveTo(X(km), T);
        g.lineTo(X(km), h - B);
        g.strokeStyle = cssv("--ink");
        g.lineWidth = 1.3;
        g.stroke();
        g.beginPath();
        g.arc(X(km), Y(track.e[cur]), 5, 0, 7);
        g.fillStyle = cssv("--accent");
        g.fill();
      }
    } catch (err) {
      console.error("drawProf failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, cps, cur]);

  // ---------------- 캔버스: 지도 ----------------
  const drawMap = useCallback(() => {
    const cv = mapRef.current;
    if (!cv) return;
    try {
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
        pad = 34;
      let latMin = track.la[0],
        latMax = track.la[0],
        lonMin = track.lo[0],
        lonMax = track.lo[0];
      for (let i = 1; i < track.la.length; i++) {
        if (track.la[i] < latMin) latMin = track.la[i];
        if (track.la[i] > latMax) latMax = track.la[i];
        if (track.lo[i] < lonMin) lonMin = track.lo[i];
        if (track.lo[i] > lonMax) lonMax = track.lo[i];
      }
      const avgLat = (latMin + latMax) / 2,
        cosLat = Math.cos((avgLat * Math.PI) / 180);
      const lonSpan = (lonMax - lonMin) * cosLat,
        latSpan = latMax - latMin;
      const availW = w - pad * 2,
        availH = h - pad * 2;
      const scale = Math.min(availW / Math.max(lonSpan, 1e-9), availH / Math.max(latSpan, 1e-9));
      const drawW = lonSpan * scale,
        drawH = latSpan * scale;
      const offX = pad + (availW - drawW) / 2,
        offY = pad + (availH - drawH) / 2;
      const px = (lon: number) => offX + (lon - lonMin) * cosLat * scale;
      const py = (lat: number) => offY + (latMax - lat) * scale;
      projRef.current = { px, py };
      g.clearRect(0, 0, w, h);
      let eMin = track.e[0],
        eMax = track.e[0];
      for (let j = 1; j < track.e.length; j++) {
        if (track.e[j] < eMin) eMin = track.e[j];
        if (track.e[j] > eMax) eMax = track.e[j];
      }
      g.beginPath();
      track.la.forEach((la, i) => {
        const x = px(track.lo[i]),
          y = py(la);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.strokeStyle = cssv("--paper-raised");
      g.lineWidth = 6;
      g.lineJoin = "round";
      g.lineCap = "round";
      g.stroke();
      const N = track.la.length;
      for (let k = 0; k < N - 1; k += 10) {
        const jj = Math.min(k + 10, N - 1);
        let mm = 0;
        for (let kk = k; kk <= jj; kk++) mm += track.e[kk];
        mm /= jj - k + 1;
        g.beginPath();
        for (let kk2 = k; kk2 <= jj; kk2++) {
          const x2 = px(track.lo[kk2]),
            y2 = py(track.la[kk2]);
          kk2 === k ? g.moveTo(x2, y2) : g.lineTo(x2, y2);
        }
        g.strokeStyle = eleColor(mm, eMin, eMax);
        g.lineWidth = 3.2;
        g.lineJoin = "round";
        g.lineCap = "round";
        g.stroke();
      }
      const used: Array<{ x: number; y: number }> = [];
      cps.forEach((c) => {
        if (c.idx === undefined || c.idx === null || !track.lo[c.idx]) return;
        const x = px(track.lo[c.idx]),
          y = py(track.la[c.idx]);
        const isEnd = c.code === "START" || c.code === "FIN";
        g.beginPath();
        g.arc(x, y, isEnd ? 6.5 : 5, 0, 7);
        g.fillStyle = cssv("--paper-raised");
        g.fill();
        g.strokeStyle = cssv("--accent");
        g.lineWidth = 2.5;
        g.stroke();
        g.font = '700 10px "IBM Plex Sans",sans-serif';
        g.textAlign = "center";
        let ly = y - 10;
        while (used.some((u) => Math.abs(u.x - x) < 24 && Math.abs(u.y - ly) < 12)) ly -= 13;
        used.push({ x, y: ly });
        g.fillStyle = cssv("--accent");
        g.fillText(c.code, x, ly);
      });
      peaks.forEach((p) => {
        const idx = nearestIdxByKm(track.d, p.km);
        const x = px(track.lo[idx]),
          y = py(track.la[idx]);
        g.beginPath();
        g.moveTo(x, y - 6);
        g.lineTo(x - 4.5, y + 2);
        g.lineTo(x + 4.5, y + 2);
        g.closePath();
        g.fillStyle = cssv("--gold");
        g.fill();
        g.font = '700 9.5px "IBM Plex Sans",sans-serif';
        g.textAlign = "center";
        let ly2 = y - 11;
        while (used.some((u) => Math.abs(u.x - x) < 28 && Math.abs(u.y - ly2) < 12)) ly2 -= 13;
        used.push({ x, y: ly2 });
        g.fillStyle = cssv("--gold");
        g.fillText(p.n, x, ly2);
      });
      if (cur >= 0) {
        const xC = px(track.lo[cur]),
          yC = py(track.la[cur]);
        g.beginPath();
        g.arc(xC, yC, 7, 0, 7);
        g.fillStyle = cssv("--accent");
        g.strokeStyle = cssv("--ink");
        g.lineWidth = 2.5;
        g.fill();
        g.stroke();
      }
    } catch (err) {
      console.error("drawMap failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, cps, peaks, cur]);

  useEffect(() => {
    drawProf();
    drawMap();
  }, [drawProf, drawMap]);

  useEffect(() => {
    const onResize = () => {
      drawProf();
      drawMap();
    };
    window.addEventListener("resize", onResize);
    let ro: ResizeObserver | null = null;
    if (window.ResizeObserver && mapRef.current && profRef.current) {
      ro = new ResizeObserver(onResize);
      ro.observe(mapRef.current);
      ro.observe(profRef.current);
    }
    // 폰트 로딩 등으로 최초 레이아웃이 살짝 늦게 자리잡는 경우 대비
    const t1 = setTimeout(onResize, 150);
    const t2 = setTimeout(onResize, 600);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [drawProf, drawMap]);

  function pickAtMap(clientX: number, clientY: number) {
    const cv = mapRef.current,
      proj = projRef.current;
    if (!cv || !proj) return;
    const b = cv.getBoundingClientRect();
    const mx = clientX - b.left,
      my = clientY - b.top;
    let best = -1,
      bd = 1e9;
    for (let i = 0; i < track.la.length; i++) {
      const x = proj.px(track.lo[i]),
        y = proj.py(track.la[i]);
      const d = (x - mx) * (x - mx) + (y - my) * (y - my);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0 && bd < 40 * 40) setCur(best);
  }
  function pickAtProf(clientX: number) {
    const cv = profRef.current;
    if (!cv) return;
    const b = cv.getBoundingClientRect();
    const kmMax = track.d[track.d.length - 1];
    const frac = (clientX - b.left - 8) / (b.width - 16);
    const km = Math.max(0, Math.min(kmMax, frac * kmMax));
    setCur(nearestIdxByKm(track.d, km));
  }

  // ---------------- 목표시간 배분(pills) ----------------
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
  const goalMax = totalLim ? (totalLim / 60) * 1.05 : Math.ceil(totalKm / 3);

  const avgSpeed = totalKm / (goalMin / 60);
  const avgPaceMin = goalMin / totalKm;
  const apm = Math.floor(avgPaceMin),
    aps = Math.round((avgPaceMin - apm) * 60);

  const segIdx = cur >= 0 ? segIndexFor(cps, track.d[cur]) : -1;

  const overCps = cps.filter((c) => c.limMin && c.s * goalMin > c.limMin + 0.5);

  const startDTDate = startDT ? new Date(startDT) : null;

  // ---------------- 저장 / 삭제 ----------------
  async function handleSave() {
    setSaving(true);
    setBanner(null);
    const payload: CoursePayload = {
      track,
      cps,
      peaks,
      startDT: startDT,
      meta,
    };
    try {
      if (mode === "edit" && courseId) {
        await updateCourseAction(courseId, payload);
        setBanner({ kind: "ok", text: "✅ 변경사항이 저장되었습니다." });
        router.push(`/courses/${courseId}`);
      } else {
        const { id } = await createCourseAction(payload);
        setBanner({ kind: "ok", text: "✅ 아카이브에 저장되었습니다." });
        router.push(`/courses/${id}`);
      }
    } catch (err) {
      // 저장 실패는 절대 성공처럼 보이면 안 된다 — 화면에 남아 재시도할 수 있게 한다.
      setBanner({ kind: "err", text: `❌ 저장에 실패했습니다: ${err instanceof Error ? err.message : String(err)}` });
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!courseId) return;
    if (!window.confirm(`"${meta.name}" 가이드를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    setBanner(null);
    try {
      await deleteCourseAction(courseId);
      router.push("/courses");
    } catch (err) {
      setBanner({ kind: "err", text: `❌ 삭제에 실패했습니다: ${err instanceof Error ? err.message : String(err)}` });
      setDeleting(false);
    }
  }

  const bannerClass =
    banner?.kind === "ok"
      ? "bg-good-soft border-good/30 text-ink"
      : banner?.kind === "err"
      ? "bg-pending-soft border-pending/30 text-ink"
      : "bg-line text-ink-soft";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-ink">{meta.name || "—"}</h2>
          <p className="text-sm text-ink-faint mt-0.5">
            {sportLabel(meta.sport)}
            {startDTDate
              ? ` · ${startDTDate.toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : meta.startDTraw
              ? ` · ⚠️ 출발일시 미인식: ${meta.startDTraw}`
              : ""}
          </p>
        </div>
      </div>

      {meta.notes && meta.notes.trim() && (
        <div className="bg-paper border border-line rounded-sm px-3.5 py-3 text-sm text-ink whitespace-pre-wrap">
          📝 {meta.notes}
        </div>
      )}

      {banner && (
        <p className={`text-sm border rounded-sm px-3 py-2 ${bannerClass}`}>{banner.text}</p>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-paper rounded-sm px-2 py-2.5 text-center">
          <b className="block font-mono-brand text-base [font-variant-numeric:tabular-nums]">{totalKm.toFixed(1)} km</b>
          <span className="text-[10px] text-ink-faint uppercase tracking-wide">총거리</span>
        </div>
        <div className="bg-paper rounded-sm px-2 py-2.5 text-center">
          <b className="block font-mono-brand text-base [font-variant-numeric:tabular-nums]">
            +{track.cg[track.cg.length - 1].toLocaleString()} m
          </b>
          <span className="text-[10px] text-ink-faint uppercase tracking-wide">누적상승(GPX)</span>
        </div>
        <div className="bg-paper rounded-sm px-2 py-2.5 text-center">
          <b className="block font-mono-brand text-base [font-variant-numeric:tabular-nums]">
            {Math.min(...track.e)}→{Math.max(...track.e)} m
          </b>
          <span className="text-[10px] text-ink-faint uppercase tracking-wide">고도범위</span>
        </div>
        <div className="bg-paper rounded-sm px-2 py-2.5 text-center">
          <b className="block font-mono-brand text-base [font-variant-numeric:tabular-nums]">{cps.length}개</b>
          <span className="text-[10px] text-ink-faint uppercase tracking-wide">CP</span>
        </div>
      </div>

      {/* 지도 */}
      <div>
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">
          🗺️ 코스 지도 <span className="text-ink-faint normal-case font-normal">— 자체 렌더링, 오프라인 작동</span>
        </p>
        <div className="h-[380px] rounded-sm bg-paper border border-line overflow-hidden">
          <canvas
            ref={mapRef}
            className="w-full h-full block cursor-crosshair"
            onPointerMove={(e) => pickAtMap(e.clientX, e.clientY)}
            onPointerLeave={() => setCur(-1)}
          />
        </div>
      </div>

      {/* 고도 프로파일 */}
      <div>
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">⛰️ 고도 프로파일</p>
        <div className="h-[200px] rounded-sm bg-paper border border-line overflow-hidden">
          <canvas
            ref={profRef}
            className="w-full h-full block cursor-crosshair"
            onPointerMove={(e) => pickAtProf(e.clientX)}
            onPointerLeave={() => setCur(-1)}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2.5">
          <div className="bg-paper rounded-sm px-2 py-2 text-center">
            <b className="block text-sm">{cur >= 0 ? `${track.d[cur].toFixed(1)} km` : "—"}</b>
            <span className="text-[10px] text-ink-faint">거리</span>
          </div>
          <div className="bg-paper rounded-sm px-2 py-2 text-center">
            <b className="block text-sm">{cur >= 0 ? `${track.e[cur]} m` : "—"}</b>
            <span className="text-[10px] text-ink-faint">고도</span>
          </div>
          <div className="bg-paper rounded-sm px-2 py-2 text-center">
            <b className="block text-sm">{cur >= 0 ? `${track.g[cur] >= 0 ? "+" : ""}${track.g[cur].toFixed(1)}%` : "—"}</b>
            <span className="text-[10px] text-ink-faint">경사</span>
          </div>
          <div className="bg-paper rounded-sm px-2 py-2 text-center">
            <b className="block text-sm">{cur >= 0 ? `+${track.cg[cur].toLocaleString()} m` : "—"}</b>
            <span className="text-[10px] text-ink-faint">누적상승</span>
          </div>
        </div>
      </div>

      {/* 목표 완주 시간 */}
      <div>
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">⏱️ 목표 완주 시간</p>
        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
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
        <p className="font-mono-brand text-xs text-ink-faint mb-2">
          전체 평균 <b className="text-ink">{avgSpeed.toFixed(1)} km/h</b> · 평균 페이스{" "}
          <b className="text-ink">
            {apm}:{String(aps).padStart(2, "0")}/km
          </b>
        </p>
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {pills.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setGoal(Math.round(p.h * 60) / 60)}
              className={`text-xs rounded-full border px-3 py-1 ${
                Math.abs(p.h * 60 - goalMin) < 1
                  ? "bg-accent text-accent-ink border-accent"
                  : "bg-paper border-line text-ink hover:bg-paper-raised"
              }`}
            >
              {p.label} ({fmtT(p.h * 60)})
            </button>
          ))}
        </div>
        <p className="text-sm mb-3">
          {overCps.length > 0 ? (
            <b className="text-pending">⚠ 이 페이스로는 {overCps.map((c) => c.code).join("·")} 컷오프 초과</b>
          ) : cps.some((c) => c.limMin) ? (
            <span className="text-good font-medium">✅ 전 CP 컷오프 통과</span>
          ) : (
            <span className="text-ink-faint">(컷오프 정보 없음 — 참고용 예상시각만 표시)</span>
          )}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse font-mono-brand [font-variant-numeric:tabular-nums]">
            <thead>
              <tr>
                {["CP", "누적km", "구간상승", "누적상승", "예상통과", "예상시각", "구간평속", "구간페이스", "컷오프", "여유", "비고"].map(
                  (h) => (
                    <th key={h} className="bg-paper px-1.5 py-1.5 border border-line text-center font-bold whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {cps.map((c, i) => {
                const t = c.s * goalMin;
                const prev = i > 0 ? cps[i - 1] : null;
                const segKm = c.km - (prev?.km ?? 0);
                const segMin = t - (prev ? prev.s * goalMin : 0);
                const segGain = Math.max(0, Math.round((c.cgain || 0) - (prev?.cgain || 0)));
                let speedHtml = "—",
                  paceHtml = "—";
                if (segKm > 0.01 && segMin > 0) {
                  const speed = segKm / (segMin / 60);
                  const pace = segMin / segKm;
                  const pm = Math.floor(pace),
                    ps = Math.round((pace - pm) * 60);
                  speedHtml = `${speed.toFixed(1)} km/h`;
                  paceHtml = `${pm}:${String(ps).padStart(2, "0")}/km`;
                }
                const slack = c.limMin ? c.limMin - t : null;
                return (
                  <tr
                    key={c.code}
                    className={i === segIdx ? "bg-accent-soft/40" : undefined}
                    onMouseEnter={() => setCur(c.idx)}
                  >
                    <td className="px-1.5 py-1.5 border border-line text-center">
                      <b>{c.code}</b>
                      <br />
                      <span className="text-[10px] text-ink-faint font-body">{escapeHtml(c.name)}</span>
                    </td>
                    <td className="px-1.5 py-1.5 border border-line text-center">{c.km.toFixed(1)}</td>
                    <td className="px-1.5 py-1.5 border border-line text-center">{segGain > 0 ? `+${segGain}m` : "—"}</td>
                    <td className="px-1.5 py-1.5 border border-line text-center">+{(c.cgain || 0).toLocaleString()}m</td>
                    <td className="px-1.5 py-1.5 border border-line text-center">
                      <b>{fmtT(t)}</b>
                    </td>
                    <td className="px-1.5 py-1.5 border border-line text-center">{tod(t, startDTDate)}</td>
                    <td className="px-1.5 py-1.5 border border-line text-center">{speedHtml}</td>
                    <td className="px-1.5 py-1.5 border border-line text-center">{paceHtml}</td>
                    <td className="px-1.5 py-1.5 border border-line text-center">
                      {c.limMin ? fmtT(c.limMin) : "—"}
                      {c.cot && (
                        <>
                          <br />
                          <span className="text-[10px] text-ink-faint font-body">{escapeHtml(c.cot)}</span>
                        </>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 border border-line text-center">
                      {slack !== null ? (
                        <span className={slack >= -0.5 ? "text-good font-bold" : "text-pending font-bold"}>
                          {slack >= 0 ? "+" : "−"}
                          {fmtT(Math.abs(slack))}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 border border-line text-center font-body text-[11px]">{c.note || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2.5 flex-wrap pt-1">
        {(mode === "new" || mode === "edit") && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-accent-ink font-medium text-sm rounded-sm px-5 py-2.5 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장 중…" : mode === "edit" ? "💾 변경사항 저장" : "💾 아카이브에 저장"}
          </button>
        )}
        {mode === "detail" && courseId && (
          <>
            <button
              type="button"
              onClick={() => router.push(`/courses/${courseId}/edit`)}
              className="border border-line text-ink text-sm rounded-sm px-5 py-2.5 hover:bg-paper"
            >
              ✏️ 정보·CP표 편집
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="border border-pending text-pending text-sm rounded-sm px-5 py-2.5 hover:bg-pending-soft disabled:opacity-50"
            >
              {deleting ? "삭제 중…" : "🗑️ 이 가이드 삭제"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => router.push("/courses")}
          className="border border-line text-ink-faint text-sm rounded-sm px-5 py-2.5 hover:bg-paper"
        >
          ← 목록으로
        </button>
      </div>
    </div>
  );
}
