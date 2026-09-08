"use client";

import { useState } from "react";
import { addMemberAction, setMembershipStatusAction } from "./actions";
import { MEMBERSHIP_STATUS_LABELS, MEMBERSHIP_STATUS_OPTIONS } from "@/lib/constants";
import type { MembershipStatus } from "@/generated/prisma/client";

export type MemberRow = {
  id: string;
  name: string;
  isActive: boolean;
  membershipStatus: MembershipStatus;
  totalPoints: number;
};

const GROUP_ORDER: MembershipStatus[] = ["REGULAR", "TRAINING", "NEW", "WITHDRAWN"];

function StatusSelect({ memberId, current, isAdmin }: { memberId: string; current: MembershipStatus; isAdmin: boolean }) {
  if (!isAdmin) return <span className="text-xs text-ink-faint">{MEMBERSHIP_STATUS_LABELS[current]}</span>;
  return (
    <form action={setMembershipStatusAction}>
      <input type="hidden" name="id" value={memberId} />
      <select
        name="membershipStatus"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-xs border border-line rounded-sm px-1.5 py-0.5 bg-paper-raised text-ink-soft"
      >
        {MEMBERSHIP_STATUS_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}

function MemberGroup({
  status,
  members,
  isAdmin,
  defaultOpen,
}: {
  status: MembershipStatus;
  members: MemberRow[];
  isAdmin: boolean;
  defaultOpen: boolean;
}) {
  if (members.length === 0) return null;
  const list = (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-0.5">
          <span className="text-ink truncate">{m.name}</span>
          <StatusSelect memberId={m.id} current={m.membershipStatus} isAdmin={isAdmin} />
        </div>
      ))}
    </div>
  );

  const heading = `${MEMBERSHIP_STATUS_LABELS[status]} ${members.length}명`;

  if (defaultOpen) {
    return (
      <div>
        <p className="text-xs font-medium text-ink-soft mb-2">{heading}</p>
        {list}
      </div>
    );
  }

  return (
    <details>
      <summary className="text-xs font-medium text-ink-soft cursor-pointer mb-2">{heading}</summary>
      {list}
    </details>
  );
}

export default function MemberManagement({ members, isAdmin }: { members: MemberRow[]; isAdmin: boolean }) {
  const [adding, setAdding] = useState(false);
  const grouped = GROUP_ORDER.map((status) => ({
    status,
    members: members.filter((m) => m.membershipStatus === status),
  }));

  return (
    <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">
          회원 관리 ·{" "}
          {grouped
            .filter((g) => g.members.length > 0)
            .map((g) => `${MEMBERSHIP_STATUS_LABELS[g.status]} ${g.members.length}명`)
            .join(" · ")}
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
          <select
            name="membershipStatus"
            defaultValue="REGULAR"
            className="text-sm border border-line rounded-sm px-2 py-1.5 bg-paper-raised text-ink-soft"
          >
            {MEMBERSHIP_STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-good text-white text-sm font-medium rounded-sm px-3 py-1.5">
            추가
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-sm text-ink-faint px-2">
            취소
          </button>
        </form>
      )}

      <div className="flex flex-col gap-4">
        {grouped.map((g) => (
          <MemberGroup
            key={g.status}
            status={g.status}
            members={g.members}
            isAdmin={isAdmin}
            defaultOpen={g.status === "REGULAR"}
          />
        ))}
      </div>
    </div>
  );
}
