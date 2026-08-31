// 코스 아카이브 — GPX 파싱 / CP 파싱 / 목표시간 계산 로직.
// 참고 구현체(course-guide-archive-reference.html)의 로직을 그대로 포팅한 것 — 알고리즘은
// 새로 설계하지 않고 그대로 옮겼다. GPX 업로드는 항상 브라우저에서 일어나므로(파일 input),
// parseGPX는 DOMParser(브라우저 전용)를 쓴다 — 이 파일은 "use client" 컴포넌트에서만 호출할 것.

import type { TrackData, CheckPoint, Peak } from "@/lib/course-shared";

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dphi / 2) * Math.sin(dphi / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GpxPoint = { lat: number; lon: number; ele: number; t: number | null };
export type GpxWaypoint = { name: string; lat: number; lon: number; ele: number | null };
export type GpxParsed = { pts: GpxPoint[]; waypoints: GpxWaypoint[]; hasTime: boolean };

export function parseGPX(xmlText: string): GpxParsed {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const perr = doc.getElementsByTagName("parsererror");
  if (perr.length) throw new Error("GPX 파일을 읽을 수 없습니다 (XML 형식 오류)");
  const trkpts = doc.getElementsByTagName("trkpt");
  if (trkpts.length === 0) {
    throw new Error("GPX 안에 트랙포인트(trkpt)가 없습니다. 루트/웨이포인트 전용 파일은 지원하지 않습니다.");
  }
  const pts: GpxPoint[] = [];
  let timeCount = 0;
  for (let i = 0; i < trkpts.length; i++) {
    const p = trkpts[i];
    const lat = parseFloat(p.getAttribute("lat") ?? "");
    const lon = parseFloat(p.getAttribute("lon") ?? "");
    const eleEl = p.getElementsByTagName("ele")[0];
    const ele = eleEl ? parseFloat(eleEl.textContent ?? "0") : 0;
    const timeEl = p.getElementsByTagName("time")[0];
    let t: number | null = null;
    if (timeEl && timeEl.textContent) {
      const parsed = Date.parse(timeEl.textContent.trim());
      if (!isNaN(parsed)) {
        t = parsed;
        timeCount++;
      }
    }
    pts.push({ lat, lon, ele, t });
  }
  const hasTime = timeCount === trkpts.length;
  const wptEls = doc.getElementsByTagName("wpt");
  const waypoints: GpxWaypoint[] = [];
  for (let j = 0; j < wptEls.length; j++) {
    const w = wptEls[j];
    const wlat = parseFloat(w.getAttribute("lat") ?? "");
    const wlon = parseFloat(w.getAttribute("lon") ?? "");
    const nameEl = w.getElementsByTagName("name")[0];
    const name = nameEl && nameEl.textContent?.trim() ? nameEl.textContent.trim() : `WP${j + 1}`;
    const weleEl = w.getElementsByTagName("ele")[0];
    const wele = weleEl ? parseFloat(weleEl.textContent ?? "") : null;
    if (!isNaN(wlat) && !isNaN(wlon)) waypoints.push({ name, lat: wlat, lon: wlon, ele: wele });
  }
  return { pts, waypoints, hasTime };
}

export function nearestIdxByKm(d: number[], km: number): number {
  let lo = 0,
    hi = d.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (d[m] < km) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function waypointsToCPs(waypoints: GpxWaypoint[], track: TrackData): CheckPoint[] {
  const cps = waypoints.map((w) => {
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < track.la.length; i++) {
      const dlat = track.la[i] - w.lat,
        dlon = track.lo[i] - w.lon;
      const d = dlat * dlat + dlon * dlon;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return {
      name: w.name,
      km: track.d[best],
      limMin: 0,
      ele: w.ele !== null && !isNaN(w.ele) ? Math.round(w.ele) : track.e[best],
      cot: "",
      note: "",
    } as Partial<CheckPoint> & { name: string; km: number; limMin: number; ele: number | null; cot: string; note: string };
  });
  cps.sort((a, b) => a.km - b.km);
  const totalKm = track.d[track.d.length - 1];
  const NEAR_KM = 0.5;
  if (cps.length === 0 || cps[0].km > NEAR_KM) {
    cps.unshift({ name: "출발", km: 0, limMin: 0, ele: track.e[0], cot: "", note: "" });
  }
  if (cps.length === 0 || cps[cps.length - 1].km < totalKm - NEAR_KM) {
    cps.push({ name: "도착", km: totalKm, limMin: 0, ele: track.e[track.e.length - 1], cot: "", note: "" });
  }
  const withCode = cps.map((c, i) => ({ ...c, code: `CP${i}` })) as CheckPoint[];
  withCode[0].code = "START";
  withCode[withCode.length - 1].code = "FIN";
  return withCode;
}

export function buildTrack(pts: GpxPoint[], hasTime: boolean, targetPoints = 900): TrackData {
  const n = pts.length;
  const eleRaw = pts.map((p) => p.ele);
  const half = 3;
  const smoothed = eleRaw.map((_, i) => {
    const lo = Math.max(0, i - half),
      hi = Math.min(n, i + half + 1);
    let s = 0;
    for (let k = lo; k < hi; k++) s += eleRaw[k];
    return s / (hi - lo);
  });
  const cumDist = [0];
  for (let i = 1; i < n; i++) cumDist.push(cumDist[i - 1] + haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon));

  let elapsedMin: number[] | null = null;
  let anomalies = 0;
  if (hasTime) {
    const MAX_GAP_MS = 30 * 60 * 1000;
    const em = [0];
    for (let j = 1; j < n; j++) {
      let dt = (pts[j].t as number) - (pts[j - 1].t as number);
      if (dt < 0) {
        dt = 0;
        anomalies++;
      } else if (dt > MAX_GAP_MS) {
        dt = MAX_GAP_MS;
        anomalies++;
      }
      em.push(em[j - 1] + dt);
    }
    elapsedMin = em.map((ms) => ms / 60000);
  }

  const stride = Math.max(1, Math.floor(n / targetPoints));
  const idxs: number[] = [];
  for (let k = 0; k < n; k += stride) idxs.push(k);
  if (idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
  const la = idxs.map((i) => pts[i].lat);
  const lo_ = idxs.map((i) => pts[i].lon);
  const d = idxs.map((i) => Math.round(cumDist[i] / 10) / 100);
  const e = idxs.map((i) => Math.round(smoothed[i]));
  const t = elapsedMin ? idxs.map((i) => (elapsedMin as number[])[i]) : null;
  const g = [0];
  for (let m = 1; m < d.length; m++) {
    const dd = (d[m] - d[m - 1]) * 1000,
      de = e[m] - e[m - 1];
    g.push(dd > 0 ? Math.round((de / dd) * 1000) / 10 : 0);
  }
  const cg = [0];
  let gain = 0;
  for (let q = 1; q < d.length; q++) {
    const deq = e[q] - e[q - 1];
    if (deq > 0) gain += deq;
    cg.push(Math.round(gain));
  }
  return { la, lo: lo_, d, e, g, cg, t, timeAnomalies: anomalies };
}

function splitLine(line: string): string[] {
  if (line.indexOf("\t") >= 0) return line.split("\t");
  return line.split(",");
}
function tryFloat(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null;
  const v = parseFloat(String(s).trim());
  return isNaN(v) ? null : v;
}
export function parseTimeToMinutes(s: string | undefined | null): number {
  if (!s) return 0;
  s = String(s).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  let h = 0,
    mi = 0;
  const mh = s.match(/(\d+)\s*[hH시]/);
  if (mh) h = parseInt(mh[1]);
  const mm = s.match(/(\d+)\s*[mM분]/);
  if (mm) mi = parseInt(mm[1]);
  return h * 60 + mi;
}

type RawCP = { name: string; km: number; limMin: number; ele: number | null; cot: string; note: string };

export function parseCPText(text: string, trackD: number[]): CheckPoint[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0);
  const cps: RawCP[] = [];
  const totalKm = trackD[trackD.length - 1];
  lines.forEach((line) => {
    const parts = splitLine(line).map((s) => s.trim());
    if (parts.length >= 7 && tryFloat(parts[2]) !== null) {
      const name = parts[0] || `CP${cps.length + 1}`;
      const km = tryFloat(parts[2]) as number;
      const limMin = parts[4] ? parseTimeToMinutes(parts[4]) : 0;
      const cot = parts[5] || "";
      const ele = tryFloat(parts[6]);
      cps.push({ name, km: Math.min(km, totalKm), limMin, ele, cot, note: "" });
    } else if (parts.length >= 2 && tryFloat(parts[1]) !== null) {
      const name2 = parts[0] || `CP${cps.length + 1}`;
      const km2 = tryFloat(parts[1]) as number;
      const limMin2 = parts[2] ? parseTimeToMinutes(parts[2]) : 0;
      const ele2 = tryFloat(parts[3]);
      const cot2 = parts[4] || "";
      const note2 = parts[5] || "";
      cps.push({ name: name2, km: Math.min(km2, totalKm), limMin: limMin2, ele: ele2, cot: cot2, note: note2 });
    }
  });
  cps.sort((a, b) => a.km - b.km);
  const NEAR_KM = 0.5;
  const anyLim = cps.some((c) => c.limMin > 0);
  if (cps.length === 0 || cps[0].km > NEAR_KM) {
    cps.unshift({ name: "출발", km: 0, limMin: 0, ele: null, cot: "", note: "" });
  }
  if (!anyLim && (cps.length === 0 || cps[cps.length - 1].km < totalKm - NEAR_KM)) {
    cps.push({ name: "도착", km: totalKm, limMin: 0, ele: null, cot: "", note: "" });
  }
  const withCode = cps.map((c, i) => ({ ...c, code: `CP${i}` })) as CheckPoint[];
  if (withCode.length) {
    withCode[0].code = "START";
    withCode[withCode.length - 1].code = "FIN";
  }
  return withCode;
}

export function autoGenerateCPs(track: TrackData, n = 8): CheckPoint[] {
  const totalKm = track.d[track.d.length - 1];
  const cps: RawCP[] = [];
  for (let i = 0; i <= n; i++) {
    const km = Math.round(((totalKm * i) / n) * 10) / 10;
    const idx = nearestIdxByKm(track.d, km);
    cps.push({
      name: i === 0 ? "출발" : i === n ? "도착" : `${km.toFixed(1)}km 지점`,
      km,
      limMin: 0,
      ele: track.e[idx],
      cot: "",
      note: "",
    });
  }
  const withCode = cps.map((c, i) => ({ ...c, code: `CP${i}` })) as CheckPoint[];
  withCode[0].code = "START";
  withCode[withCode.length - 1].code = "FIN";
  return withCode;
}

// cps를 track에 붙여서 idx/cgain/s(목표시간 비율)를 채운다.
// s 계산 우선순위: ① 공식 컷오프 비율 → ② GPX 실측시간 비율 → ③ 거리+고도 가중 유효거리 비율.
export function attachEleAndS(cps: CheckPoint[], track: TrackData): CheckPoint[] {
  const totalLim = cps[cps.length - 1].limMin || 0;
  const hasLim = totalLim > 0;
  const hasTrackTime = !!track.t;

  const withIdx = cps.map((c) => {
    const idx = nearestIdxByKm(track.d, c.km);
    const ele = c.ele === null || isNaN(c.ele as number) ? track.e[idx] : c.ele;
    return { ...c, ele, cgain: track.cg[idx], idx };
  });

  let withS: CheckPoint[];
  if (hasLim) {
    withS = withIdx.map((c) => ({ ...c, s: c.limMin / totalLim }));
  } else if (hasTrackTime) {
    const t = track.t as number[];
    const totalT = t[t.length - 1];
    withS = withIdx.map((c) => ({ ...c, s: totalT > 0 ? t[c.idx] / totalT : c.km / track.d[track.d.length - 1] }));
  } else {
    const totalKm = track.d[track.d.length - 1];
    const totalGain = track.cg[track.cg.length - 1];
    const totalEff = totalKm + totalGain / 100;
    withS = withIdx.map((c) => {
      const effKm = c.km + c.cgain / 100;
      return { ...c, s: totalEff > 0 ? effKm / totalEff : c.km / totalKm };
    });
  }
  return withS;
}

// 트랙 전 구간에 대한 s(목표시간 비율) 배열 — hover 시 현재 위치 보간 등에 쓰임
export function buildSArray(track: TrackData, cps: CheckPoint[], hasLim: boolean): number[] {
  if (!hasLim && track.t) {
    const t = track.t;
    const totalT = t[t.length - 1];
    return totalT > 0 ? t.map((v) => v / totalT) : track.d.map((km) => km / track.d[track.d.length - 1]);
  }
  const kmBp = cps.map((c) => c.km),
    sBp = cps.map((c) => c.s);
  function interp(km: number): number {
    if (km <= kmBp[0]) return sBp[0];
    if (km >= kmBp[kmBp.length - 1]) return sBp[sBp.length - 1];
    for (let i = 1; i < kmBp.length; i++) {
      if (km <= kmBp[i]) {
        const frac = kmBp[i] === kmBp[i - 1] ? 0 : (km - kmBp[i - 1]) / (kmBp[i] - kmBp[i - 1]);
        return sBp[i - 1] + frac * (sBp[i] - sBp[i - 1]);
      }
    }
    return sBp[sBp.length - 1];
  }
  return track.d.map((km) => interp(km));
}

export function parsePeakText(text: string, track: TrackData): Peak[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const peaks: Peak[] = [];
  lines.forEach((line) => {
    const parts = splitLine(line).map((s) => s.trim());
    if (parts.length < 2) return;
    const km = parseFloat(parts[1]);
    if (isNaN(km)) return;
    const idx = nearestIdxByKm(track.d, km);
    peaks.push({ km, e: track.e[idx], n: parts[0] });
  });
  if (peaks.length === 0) {
    let maxI = 0;
    for (let i = 1; i < track.e.length; i++) if (track.e[i] > track.e[maxI]) maxI = i;
    peaks.push({ km: track.d[maxI], e: track.e[maxI], n: "최고점" });
  }
  return peaks;
}

export function parseStartDT(s: string | undefined | null): Date | null {
  if (!s) return null;
  s = s.trim();
  const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\sT]+(\d{1,2}):(\d{1,2})/);
  if (!m) return null;
  const dt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return isNaN(dt.getTime()) ? null : dt;
}

export function fmtT(m: number): string {
  m = Math.round(m);
  return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
}

// 출발일시 기준 CP 통과 예상 "요일 시:분" — 출발일시가 없으면 경과시간만
export function tod(mins: number, startDT: Date | null): string {
  if (!startDT) return fmtT(mins) + " 경과";
  const dt = new Date(startDT.getTime() + mins * 60000);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayLabel = days[dt.getDay()];
  const hh = String(dt.getHours()).padStart(2, "0"),
    mm = String(dt.getMinutes()).padStart(2, "0");
  return `${dayLabel} ${hh}:${mm}`;
}

// 캔버스 축 눈금 간격 — "보기 좋은" 값(1/2/5/10의 배수)으로 반올림
export function niceStep(range: number, targetTicks: number): number {
  if (!(range > 0)) return 1;
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

// cps에서 km 기준으로 "현재 어느 구간인지" 인덱스 — 고도 프로파일/CP표 hover 연동용
export function segIndexFor(cps: CheckPoint[], km: number): number {
  let s = 1;
  for (let i = 1; i < cps.length; i++) {
    s = i;
    if (km <= cps[i].km) break;
  }
  return s;
}
