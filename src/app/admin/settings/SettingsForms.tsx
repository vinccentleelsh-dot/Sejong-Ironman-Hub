"use client";

import { useState } from "react";

export function ChangePasswordForm({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <form
      action={async (fd) => {
        setError(null);
        setSuccess(false);
        try {
          await action(fd);
          setSuccess(true);
          (document.getElementById(`pw-form-${title}`) as HTMLFormElement | null)?.reset();
        } catch (e) {
          setError(e instanceof Error ? e.message : "변경에 실패했습니다.");
        }
      }}
      id={`pw-form-${title}`}
      className="flex flex-col gap-2"
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-xs text-ink-faint -mt-1">{description}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          name="newPassword"
          placeholder="새 비밀번호"
          required
          minLength={4}
          className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-40"
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="새 비밀번호 확인"
          required
          minLength={4}
          className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm w-40"
        />
        <button type="submit" className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-1.5 hover:opacity-90">
          변경
        </button>
      </div>
      {error && <p className="text-xs text-pending">{error}</p>}
      {success && <p className="text-xs text-good">변경되었습니다. 다음 로그인부터 새 비밀번호가 적용돼요.</p>}
    </form>
  );
}

export type PointRuleRow = { id: string; label: string; points: number; note: string | null };

export function PointRuleTable({
  rules,
  upsertAction,
  deleteAction,
}: {
  rules: PointRuleRow[];
  upsertAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitUpsert(fd: FormData, onDone: () => void) {
    setError(null);
    try {
      await upsertAction(fd);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }

  async function submitDelete(fd: FormData) {
    setError(null);
    try {
      await deleteAction(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  function EditRow({ rule }: { rule?: PointRuleRow }) {
    return (
      <tr className={rule ? "bg-accent-soft/40" : "bg-good-soft/40"}>
        <td colSpan={4} className="p-2">
          <form
            action={(fd) => submitUpsert(fd, () => (rule ? setEditingId(null) : setAdding(false)))}
            className="flex flex-wrap items-end gap-2"
          >
            {rule && <input type="hidden" name="id" value={rule.id} />}
            <label className="flex flex-col gap-0.5 text-xs text-ink-faint">
              항목명
              <input
                name="label"
                defaultValue={rule?.label ?? ""}
                required
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-32"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs text-ink-faint">
              포인트
              <input
                type="number"
                name="points"
                defaultValue={rule?.points ?? ""}
                required
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-20 [font-variant-numeric:tabular-nums]"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs text-ink-faint flex-1 min-w-[140px]">
              설명
              <input
                name="note"
                defaultValue={rule?.note ?? ""}
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-full"
              />
            </label>
            <button
              type="submit"
              className={`text-xs font-medium rounded-sm px-3 py-1.5 ${
                rule ? "bg-accent text-accent-ink" : "bg-good text-white"
              }`}
            >
              {rule ? "저장" : "추가"}
            </button>
            <button
              type="button"
              onClick={() => (rule ? setEditingId(null) : setAdding(false))}
              className="text-xs text-ink-faint px-2"
            >
              취소
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left">
            <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">항목</th>
            <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint text-right">포인트</th>
            <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">설명</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) =>
            editingId === rule.id ? (
              <EditRow key={rule.id} rule={rule} />
            ) : (
              <tr key={rule.id} className="border-b border-line hover:bg-paper">
                <td className="px-2 py-2 text-ink font-medium">{rule.label}</td>
                <td className="px-2 py-2 text-right font-mono-brand text-ink [font-variant-numeric:tabular-nums]">
                  {rule.points}점
                </td>
                <td className="px-2 py-2 text-ink-faint text-xs">{rule.note ?? ""}</td>
                <td className="px-2 py-2 whitespace-nowrap text-right">
                  <button onClick={() => setEditingId(rule.id)} className="text-xs text-accent hover:underline mr-2">
                    수정
                  </button>
                  <form
                    action={(fd) => submitDelete(fd)}
                    className="inline"
                    onSubmit={(e) => {
                      if (!confirm(`"${rule.label}" 항목을 삭제할까요?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit" className="text-xs text-ink-faint hover:text-pending hover:underline">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            )
          )}
          {adding && <EditRow />}
        </tbody>
      </table>
      {error && <p className="text-xs text-pending mt-2">{error}</p>}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1 hover:bg-accent-soft mt-3"
        >
          + 항목 추가
        </button>
      )}
    </div>
  );
}
