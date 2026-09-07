"use client";

import { useState } from "react";
import { parsePastedTextAction, parseFileAction, commitImportAction } from "./actions";
import { IMPORT_COLUMNS, CATEGORY_LABEL_TO_ENUM } from "@/lib/import-template";
import type { ParsedRow } from "@/lib/import-template";

type Mode = "paste" | "file";

export default function ImportPanel() {
  const [mode, setMode] = useState<Mode>("paste");
  const [pastedText, setPastedText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    attendanceCreated: number;
    unmatchedNames: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validRows = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = rows?.filter((r) => r.errors.length > 0) ?? [];

  async function handleParsePaste() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("pastedText", pastedText);
      const parsed = await parsePastedTextAction(fd);
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파싱 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleParseFile(file: File) {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const parsed = await parseFileAction(fd);
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (validRows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await commitImportAction(validRows);
      setResult(res);
      setRows(null);
      setPastedText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오기 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-paper-raised border border-line rounded-sm p-4">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent mb-2">
          컬럼 형식 (고정 순서)
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>
                {IMPORT_COLUMNS.map((c) => (
                  <th key={c} className="border border-line px-2 py-1 text-left font-medium text-ink-soft whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="text-ink-faint">
                <td className="border border-line px-2 py-1">2027-03-06</td>
                <td className="border border-line px-2 py-1">정기훈련</td>
                <td className="border border-line px-2 py-1"></td>
                <td className="border border-line px-2 py-1">Swim,Run</td>
                <td className="border border-line px-2 py-1">청사 수영장 2000m + Run 5K</td>
                <td className="border border-line px-2 py-1">2</td>
                <td className="border border-line px-2 py-1">0</td>
                <td className="border border-line px-2 py-1">5</td>
                <td className="border border-line px-2 py-1">김철수, 이영희</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-faint mt-2">
          분류는 <b className="text-ink-soft">{Object.keys(CATEGORY_LABEL_TO_ENUM).join(" / ")}</b> 중 하나여야
          합니다. 첫 줄이 헤더면 자동으로 건너뜁니다. 같은 날짜 + 같은 분류의 세션이 이미 있으면 값을
          덮어쓰고, 없으면 새로 만듭니다. <b className="text-ink-soft">참석자</b>는 기존 회원 이름과 정확히
          일치해야 자동으로 연결되고(기본 포인트: 정기훈련·공식행사·자율훈련 3점 / 대회 0점 — 대회는
          완주 코스마다 달라 가져오기 후 개별 입력 필요), 이미 참석 기록이 있는 사람은 건드리지 않습니다.
          이름이 회원 명단과 안 맞으면 가져오기 후 결과에 표시됩니다.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("paste")}
          className={`text-sm font-medium px-3 py-1.5 rounded-sm border ${
            mode === "paste" ? "bg-accent text-accent-ink border-accent" : "border-line text-ink-soft"
          }`}
        >
          구글시트/엑셀 붙여넣기
        </button>
        <button
          onClick={() => setMode("file")}
          className={`text-sm font-medium px-3 py-1.5 rounded-sm border ${
            mode === "file" ? "bg-accent text-accent-ink border-accent" : "border-line text-ink-soft"
          }`}
        >
          엑셀 파일 업로드
        </button>
      </div>

      {mode === "paste" ? (
        <div className="bg-paper-raised border border-line rounded-sm p-4 flex flex-col gap-3">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={6}
            placeholder="구글시트나 엑셀에서 위 컬럼 순서대로 셀을 선택해 복사한 뒤 여기에 붙여넣으세요 (Ctrl+V)"
            className="border border-line rounded-sm px-3 py-2 bg-paper text-sm font-mono-brand"
          />
          <button
            onClick={handleParsePaste}
            disabled={busy || pastedText.trim().length === 0}
            className="self-start bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-2 disabled:opacity-40"
          >
            미리보기
          </button>
        </div>
      ) : (
        <div className="bg-paper-raised border border-line rounded-sm p-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleParseFile(f);
            }}
            className="text-sm"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-pending bg-pending-soft border border-pending/30 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      {result && (
        <div className="text-sm text-good bg-good-soft border border-good/30 rounded-sm px-3 py-2">
          <p>
            가져오기 완료 — 세션 신규 {result.created}건, 업데이트 {result.updated}건 · 참석자 신규 연결{" "}
            {result.attendanceCreated}명
          </p>
          {result.unmatchedNames.length > 0 && (
            <p className="text-pending mt-1">
              회원 명단과 매칭 안 된 이름 ({result.unmatchedNames.length}명) — 오탈자이거나 아직 등록 안 된
              회원입니다: {result.unmatchedNames.join(", ")}
            </p>
          )}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="bg-paper-raised border border-line rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">
              미리보기 — 정상 {validRows.length}건{invalidRows.length > 0 && ` · 오류 ${invalidRows.length}건(가져오기 제외)`}
            </p>
            <button
              onClick={handleCommit}
              disabled={busy || validRows.length === 0}
              className="bg-good text-white text-sm font-medium rounded-sm px-4 py-1.5 disabled:opacity-40"
            >
              {validRows.length}건 가져오기
            </button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="sticky top-0 bg-paper-raised">
                  <th className="border border-line px-2 py-1 text-left">줄</th>
                  <th className="border border-line px-2 py-1 text-left">날짜</th>
                  <th className="border border-line px-2 py-1 text-left">분류</th>
                  <th className="border border-line px-2 py-1 text-left">종목</th>
                  <th className="border border-line px-2 py-1 text-left">거리(S/B/R)</th>
                  <th className="border border-line px-2 py-1 text-left">참석자</th>
                  <th className="border border-line px-2 py-1 text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowIndex} className={r.errors.length > 0 ? "bg-pending-soft/40" : ""}>
                    <td className="border border-line px-2 py-1 text-ink-faint">{r.rowIndex}</td>
                    <td className="border border-line px-2 py-1">{r.date ?? r.raw[0]}</td>
                    <td className="border border-line px-2 py-1">{r.category ?? r.raw[1]}</td>
                    <td className="border border-line px-2 py-1">{r.disciplines ?? "—"}</td>
                    <td className="border border-line px-2 py-1 font-mono-brand [font-variant-numeric:tabular-nums]">
                      {r.swimKm}/{r.bikeKm}/{r.runKm}
                    </td>
                    <td className="border border-line px-2 py-1 max-w-[220px] truncate" title={r.participantNames.join(", ")}>
                      {r.participantNames.length > 0 ? `${r.participantNames.length}명 — ${r.participantNames.join(", ")}` : "—"}
                    </td>
                    <td className="border border-line px-2 py-1">
                      {r.errors.length > 0 ? (
                        <span className="text-pending">{r.errors.join("; ")}</span>
                      ) : (
                        <span className="text-good">정상</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
