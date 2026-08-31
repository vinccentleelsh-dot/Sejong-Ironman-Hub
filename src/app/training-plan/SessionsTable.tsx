"use client";

import { useState } from "react";
import { updateSessionAction, createSessionAction, deleteSessionAction } from "./actions";
import { CATEGORY_OPTIONS, CATEGORY_LABELS, DISCIPLINE_OPTIONS, formatDisciplines } from "@/lib/constants";
import type { SessionCategory } from "@/generated/prisma/client";

export type Attendee = { memberId: string; name: string; points: number };

export type SessionRow = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  category: SessionCategory;
  title: string | null;
  description: string | null;
  disciplines: string | null;
  swimKm: number;
  bikeKm: number;
  runKm: number;
  attendees: Attendee[];
};

export type MemberOption = { id: string; name: string; isActive: boolean };

function oneLine(text: string) {
  return text.replace(/\r?\n/g, " / ");
}

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  // 연도는 페이지 제목("2026년 훈련계획")에 이미 나오므로 표에서는 생략 — MM.DD (요일)
  return `${iso.slice(5).replace(/-/g, ".")} (${days[d.getUTCDay()]})`;
}

function CategoryBadge({ category }: { category: SessionCategory }) {
  const styles: Record<SessionCategory, string> = {
    REGULAR: "bg-accent-soft text-accent",
    OFFICIAL_EVENT: "bg-gold-soft text-gold",
    COMPETITION: "bg-pending-soft text-pending",
    FREE_TRAINING: "bg-line text-ink-soft",
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// 기본 공통 포인트 — 정기훈련/공식행사/자율훈련은 3점, 대회는 종목마다 달라서 운영자가 직접 입력
function defaultPoints(category: SessionCategory) {
  return category === "COMPETITION" ? 0 : 3;
}

function AttendeePicker({ members, defaultChecked }: { members: MemberOption[]; defaultChecked: Set<string> }) {
  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);
  return (
    <div className="border border-line rounded-sm bg-paper-raised max-h-48 overflow-y-auto p-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
        {active.map((m) => (
          <label key={m.id} className="flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" name="memberIds" value={m.id} defaultChecked={defaultChecked.has(m.id)} />
            {m.name}
          </label>
        ))}
      </div>
      {inactive.length > 0 && (
        <>
          <p className="text-[10px] text-ink-faint uppercase tracking-wide mt-2 mb-1">탈퇴 회원</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
            {inactive.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-sm text-ink-faint">
                <input type="checkbox" name="memberIds" value={m.id} defaultChecked={defaultChecked.has(m.id)} />
                {m.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EditForm({
  row,
  members,
  onDone,
}: {
  row: SessionRow;
  members: MemberOption[];
  onDone: () => void;
}) {
  const currentDisciplines = row.disciplines ? row.disciplines.split(",") : [];
  const attendeeIds = new Set(row.attendees.map((a) => a.memberId));
  const commonPoints = row.attendees.length > 0 ? row.attendees[0].points : defaultPoints(row.category);

  return (
    <tr className="bg-accent-soft/40">
      <td colSpan={8} className="p-3">
        <form
          action={async (fd) => {
            await updateSessionAction(fd);
            onDone();
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={row.id} />
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              날짜
              <input
                disabled
                value={fmtDate(row.date)}
                className="border border-line rounded-sm px-2 py-1.5 bg-line/30 text-ink-soft text-sm w-32"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              분류
              <select
                name="category"
                defaultValue={row.category}
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm"
              >
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              대회/행사명
              <input
                name="title"
                defaultValue={row.title ?? ""}
                placeholder="정기훈련이면 비워두기"
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-44"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            코스 설명
            <textarea
              name="description"
              defaultValue={row.description ?? ""}
              rows={2}
              className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm"
            />
          </label>

          <div className="flex flex-wrap items-end gap-4">
            <fieldset className="flex flex-col gap-1 text-xs text-ink-faint">
              종목
              <div className="flex gap-3 pt-1">
                {DISCIPLINE_OPTIONS.map((d) => (
                  <label key={d.value} className="flex items-center gap-1 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="disciplines"
                      value={d.value}
                      defaultChecked={currentDisciplines.includes(d.value)}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              Swim(km)
              <input
                type="number"
                step="0.1"
                min="0"
                name="swimKm"
                defaultValue={row.swimKm}
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-20 [font-variant-numeric:tabular-nums]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              Bike(km)
              <input
                type="number"
                step="0.1"
                min="0"
                name="bikeKm"
                defaultValue={row.bikeKm}
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-20 [font-variant-numeric:tabular-nums]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              Run(km)
              <input
                type="number"
                step="0.1"
                min="0"
                name="runKm"
                defaultValue={row.runKm}
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-20 [font-variant-numeric:tabular-nums]"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-faint">참석자 (체크한 전원에게 아래 포인트 일괄 적용)</span>
              <label className="flex items-center gap-1.5 text-xs text-ink-faint">
                포인트
                <input
                  type="number"
                  name="points"
                  min="0"
                  defaultValue={commonPoints}
                  className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-16 [font-variant-numeric:tabular-nums]"
                />
              </label>
            </div>
            <AttendeePicker members={members} defaultChecked={attendeeIds} />
          </div>

          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onDone} className="text-sm text-ink-faint px-3 py-1.5 hover:text-ink-soft">
              취소
            </button>
            <button
              type="submit"
              className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-1.5 hover:opacity-90"
            >
              저장
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function NewSessionForm({ members, onDone }: { members: MemberOption[]; onDone: () => void }) {
  return (
    <tr className="bg-good-soft/40">
      <td colSpan={8} className="p-3">
        <form
          action={async (fd) => {
            await createSessionAction(fd);
            onDone();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              날짜
              <input
                type="date"
                name="date"
                required
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              분류
              <select name="category" defaultValue="REGULAR" className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm">
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              대회/행사명
              <input name="title" className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-40" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              포인트
              <input
                type="number"
                name="points"
                min="0"
                defaultValue={3}
                className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-16"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-ink-faint">참석자 (선택 사항 — 나중에 "수정"으로도 추가 가능)</span>
            <AttendeePicker members={members} defaultChecked={new Set()} />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-good text-white text-sm font-medium rounded-sm px-4 py-1.5 hover:opacity-90"
            >
              추가
            </button>
            <button type="button" onClick={onDone} className="text-sm text-ink-faint px-3 py-1.5 hover:text-ink-soft">
              취소
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export default function SessionsTable({
  sessions,
  members,
  isAdmin,
}: {
  sessions: SessionRow[];
  members: MemberOption[];
  isAdmin: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  return (
    <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
      <div className="flex items-center justify-between p-4 pb-0">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">
          훈련계획 · 세션 {sessions.length}개
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a
              href="/api/export/sessions"
              className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1 hover:bg-accent-soft"
            >
              ⬇ 엑셀 다운로드
            </a>
          )}
          {isAdmin && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1 hover:bg-accent-soft"
            >
              + 새 세션 추가
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left">
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint whitespace-nowrap">날짜</th>
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">분류</th>
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">설명</th>
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">참석자</th>
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">종목</th>
              <th className="px-2 py-2 font-mono-brand text-[9px] uppercase text-ink-faint/70 text-right whitespace-nowrap">
                종목별(S/B/R)
              </th>
              <th className="px-2 py-2 font-mono-brand text-[9px] uppercase text-ink-faint/70 text-right whitespace-nowrap">
                합계(km)
              </th>
              {isAdmin && (
                <th className="px-2 py-2 sticky right-0 bg-paper-raised shadow-[-4px_0_6px_-4px_rgba(20,34,32,.15)]"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {adding && <NewSessionForm members={members} onDone={() => setAdding(false)} />}
            {sessions.map((row) =>
              editingId === row.id ? (
                <EditForm key={row.id} row={row} members={members} onDone={() => setEditingId(null)} />
              ) : (
                <tr key={row.id} className="border-b border-line hover:bg-paper align-top">
                  <td className="px-2 py-2 font-mono-brand text-xs text-ink-soft whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="px-2 py-2">
                    <CategoryBadge category={row.category} />
                    {row.title && <div className="text-xs text-ink-soft mt-0.5">{row.title}</div>}
                  </td>
                  <td className="px-2 py-2 text-ink-faint text-xs max-w-[220px] truncate" title={row.description ?? ""}>
                    {row.description ? oneLine(row.description) : ""}
                  </td>
                  <td className="px-2 py-2 min-w-[160px]">
                    {row.attendees.length > 0 ? (
                      <>
                        <span className="text-ink font-medium font-mono-brand [font-variant-numeric:tabular-nums]">
                          {row.attendees.length}명
                        </span>
                        <span className="text-ink-faint"> — {row.attendees.map((a) => a.name).join(", ")}</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">0명</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-ink-soft whitespace-nowrap">{formatDisciplines(row.disciplines)}</td>
                  <td className="px-2 py-2 text-[11px] text-ink-faint/80 font-mono-brand [font-variant-numeric:tabular-nums] text-right whitespace-nowrap">
                    {row.swimKm || row.bikeKm || row.runKm
                      ? `${row.swimKm}/${row.bikeKm}/${row.runKm}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-ink-faint/80 font-mono-brand [font-variant-numeric:tabular-nums] text-right whitespace-nowrap">
                    {row.swimKm + row.bikeKm + row.runKm > 0 ? (row.swimKm + row.bikeKm + row.runKm).toFixed(1) : "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-2 whitespace-nowrap sticky right-0 bg-paper-raised shadow-[-4px_0_6px_-4px_rgba(20,34,32,.15)]">
                      <button
                        onClick={() => setEditingId(row.id)}
                        className="text-xs text-accent hover:underline mr-2"
                      >
                        수정
                      </button>
                      {confirmingDeleteId === row.id ? (
                        <form
                          action={async (fd) => {
                            await deleteSessionAction(fd);
                            setConfirmingDeleteId(null);
                          }}
                          className="inline-flex items-center gap-1"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className="text-xs text-pending hover:underline">
                            정말 삭제
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            className="text-xs text-ink-faint hover:underline"
                          >
                            취소
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(row.id)}
                          className="text-xs text-ink-faint hover:text-pending hover:underline"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
