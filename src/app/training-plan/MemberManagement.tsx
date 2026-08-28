"use client";

import { useState } from "react";
import { addMemberAction, setMemberActiveAction } from "./actions";

export type MemberRow = {
  id: string;
  name: string;
  isActive: boolean;
  totalPoints: number;
};

export default function MemberManagement({ members, isAdmin }: { members: MemberRow[]; isAdmin: boolean }) {
  const [adding, setAdding] = useState(false);
  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);

  return (
    <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">
          회원 관리 · 활성 {active.length}명 {inactive.length > 0 && `· 탈퇴 ${inactive.length}명`}
        </p>
        {isAdmin && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1 hover:bg-accent-soft"
          >
            + 회원 추가
          </button>
        )}
      </div>

      {adding && (
        <form
          action={async (fd) => {
            await addMemberAction(fd);
            setAdding(false);
          }}
          className="flex items-center gap-2 mb-3 bg-good-soft/40 rounded-sm p-2"
        >
          <input
            name="name"
            required
            placeholder="이름"
            autoFocus
            className="border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-sm flex-1"
          />
          <button type="submit" className="bg-good text-white text-sm font-medium rounded-sm px-3 py-1.5">
            추가
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-sm text-ink-faint px-2">
            취소
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        {active.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-sm py-0.5">
            <span className="text-ink">{m.name}</span>
            {isAdmin && (
              <form action={setMemberActiveAction}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="isActive" value="false" />
                <button type="submit" className="text-xs text-ink-faint hover:text-pending hover:underline">
                  탈퇴처리
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {inactive.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-ink-faint cursor-pointer">탈퇴 회원 {inactive.length}명 보기</summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-2">
            {inactive.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-0.5 text-ink-faint">
                <span>{m.name}</span>
                {isAdmin && (
                  <form action={setMemberActiveAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="isActive" value="true" />
                    <button type="submit" className="text-xs text-accent hover:underline">
                      복귀처리
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
