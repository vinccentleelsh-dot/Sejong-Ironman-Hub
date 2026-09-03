"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  createRaceAction,
  updateRaceAction,
  deleteRaceAction,
  joinRaceAction,
  leaveRaceAction,
} from "./actions";
import {
  RACE_CATEGORIES,
  RACE_CATEGORY_COLOR,
  formatTotalKm,
  type CompetitionRaceRow,
} from "@/lib/competitions-shared";

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월",
];

export type MemberOption = { id: string; name: string };

function CategoryTag({ category }: { category: string }) {
  const c = RACE_CATEGORY_COLOR[category] ?? { text: "var(--ink-soft)", bg: "var(--line)" };
  return (
    <span
      className="inline-block text-xs font-medium px-1.5 py-0.5 rounded-sm whitespace-nowrap"
      style={{ color: c.text, backgroundColor: c.bg }}
    >
      {category}
    </span>
  );
}

// 참가자 표시 + 이름 옆 작은 x로 빼기, 밑에 "+ 참가" 드롭다운으로 자기 이름 추가 — 인증만 하면 누구나
function Participants({ race, members }: { race: CompetitionRaceRow; members: MemberOption[] }) {
  const [joining, setJoining] = useState(false);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const joinedNames = new Set(race.participants.map((p) => p.name.toLowerCase()));
  const available = members.filter((m) => !joinedNames.has(m.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      {!race.isPending && race.participants.length > 0 && (
        <div className="text-xs leading-snug">
          {race.participants.map((p, i) => (
            <span key={p.name + i} className="inline-flex items-center gap-0.5 mr-1.5">
              {p.memberId ? (
                <Link href={`/members/${p.memberId}`} className="text-ink hover:text-accent hover:underline">
                  {p.name}
                </Link>
              ) : (
                <span className="text-ink-soft">{p.name}</span>
              )}
              <form
                action={async (fd) => {
                  await leaveRaceAction(fd);
                }}
                className="inline"
              >
                <input type="hidden" name="raceId" value={race.id} />
                <input type="hidden" name="memberName" value={p.name} />
                <button
                  type="submit"
                  title="참가자에서 빼기"
                  className="text-ink-faint hover:text-pending text-[10px] leading-none align-middle"
                >
                  ✕
                </button>
              </form>
              {i < race.participants.length - 1 && <span className="text-ink-faint">,</span>}
            </span>
          ))}
        </div>
      )}
      {race.isPending && (
        <span className="text-xs text-pending bg-pending-soft px-1.5 py-0.5 rounded-sm whitespace-nowrap self-start">
          미정
        </span>
      )}

      {joining ? (
        <form
          action={async (fd) => {
            setError(null);
            try {
              await joinRaceAction(fd);
              setJoining(false);
              setSelected("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "실패했습니다.");
            }
          }}
          className="flex items-center gap-1"
        >
          <input type="hidden" name="raceId" value={race.id} />
          <select
            name="memberName"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            required
            className="border border-line rounded-sm px-1 py-0.5 bg-paper-raised text-xs"
          >
            <option value="">이름 선택</option>
            {available.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" className="text-xs text-accent-ink bg-accent rounded-sm px-2 py-0.5">
            참가
          </button>
          <button type="button" onClick={() => setJoining(false)} className="text-xs text-ink-faint">
            취소
          </button>
        </form>
      ) : (
        <button onClick={() => setJoining(true)} className="text-xs text-accent hover:underline self-start">
          + 참가
        </button>
      )}
      {error && <p className="text-[11px] text-pending">{error}</p>}
    </div>
  );
}

// 수영/자전거/달리기 3칸을 "1.5/40/10" 처럼 한 칸에 압축 — 중요도가 낮은 정보라 자리 최소화
function CompactDistance({ race }: { race: CompetitionRaceRow }) {
  const has = race.swimKm !== null || race.bikeKm !== null || race.runKm !== null;
  if (!has) return <span className="text-ink-faint">—</span>;
  return (
    <span className="font-mono-brand [font-variant-numeric:tabular-nums]">
      {race.swimKm ?? "-"}/{race.bikeKm ?? "-"}/{race.runKm ?? "-"}
    </span>
  );
}

// 달력에서 고른 날짜(YYYY-MM-DD)를 "9/18(목)" 같은 표시용 문구로 변환 — 날짜 표기 칸을
// 자동으로 채워준다 (여러 날짜에 걸치는 대회는 채워진 값을 사람이 직접 "~20"처럼 고쳐 쓰면 됨).
function formatDateLabelFromISO(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function RaceForm({
  race,
  colSpan,
  action,
  onDone,
}: {
  race?: CompetitionRaceRow;
  colSpan: number;
  action: (fd: FormData) => Promise<void>;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const dateLabelRef = useRef<HTMLInputElement>(null);
  return (
    <tr className="bg-accent-soft/40">
      <td colSpan={colSpan} className="p-3">
        <form
          action={async (fd) => {
            setError(null);
            try {
              await action(fd);
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
            }
          }}
          className="flex flex-col gap-2"
        >
          {race && <input type="hidden" name="id" value={race.id} />}
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              날짜 선택
              <input
                type="date"
                name="startDate"
                defaultValue={race?.startDate ?? ""}
                onChange={(e) => {
                  // 달력에서 고르면 아래 "날짜 표기" 칸이 자동으로 채워진다 — 여러 날에 걸치는
                  // 대회면 채워진 값 뒤에 "~20"처럼 직접 덧붙이면 됨 (강제 동기화는 아님).
                  if (dateLabelRef.current) dateLabelRef.current.value = formatDateLabelFromISO(e.target.value);
                }}
                required
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              날짜 표기 <span className="normal-case font-normal">(자동 입력, 수정 가능)</span>
              <input
                ref={dateLabelRef}
                name="dateLabel"
                defaultValue={race?.dateLabel ?? ""}
                placeholder="달력에서 날짜를 고르면 채워져요"
                required
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-32"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              분류
              <input
                name="category"
                list="race-category-suggestions"
                defaultValue={race?.category ?? ""}
                required
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-24"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint flex-1 min-w-[140px]">
              대회명
              <input
                name="raceName"
                defaultValue={race?.raceName ?? ""}
                required
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            세부종목 / 코스
            <input
              name="courseDetail"
              defaultValue={race?.courseDetail ?? ""}
              className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            참가자 (콤마로 구분, 미정이면 비워두기 — 표에서 "+ 참가"로도 추가 가능)
            <input
              name="participantsRaw"
              defaultValue={race?.participantsRaw ?? ""}
              placeholder="예: 김승현, 조영우"
              className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm"
            />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              Swim(km)
              <input
                type="number"
                step="0.001"
                name="swimKm"
                defaultValue={race?.swimKm ?? ""}
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-20"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              Bike(km)
              <input
                type="number"
                step="0.001"
                name="bikeKm"
                defaultValue={race?.bikeKm ?? ""}
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-20"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              Run(km)
              <input
                type="number"
                step="0.001"
                name="runKm"
                defaultValue={race?.runKm ?? ""}
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-20"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              전체 거리 표기
              <input
                name="totalKmDisplay"
                defaultValue={formatTotalKm(race?.totalKmDisplay ?? null) ?? ""}
                placeholder="숫자 또는 설명 텍스트"
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-faint">
              획득고도(m)
              <input
                type="number"
                step="1"
                name="elevationGainM"
                defaultValue={race?.elevationGainM ?? ""}
                className="border border-line rounded-sm px-2 py-1 bg-paper-raised text-sm w-24"
              />
            </label>
          </div>

          <datalist id="race-category-suggestions">
            {RACE_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {error && <p className="text-xs text-pending">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" className="bg-accent text-accent-ink text-sm font-medium rounded-sm px-4 py-1.5">
              저장
            </button>
            <button type="button" onClick={onDone} className="text-sm text-ink-faint px-2">
              취소
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

const COL_COUNT = 10; // 월,날짜,대회명,세부종목,참가자,분류,S/B/R,전체,획득고도,관리(수정/삭제)

// 정렬 가능한 컬럼은 요청받은 4개(월/날짜/분류/전체km)만 — 나머지(대회명·참가자 등)는
// 정렬해도 크게 쓸모가 없어서 그대로 둔다.
type SortKey = "month" | "date" | "category" | "totalKm";

// "1.5(수영)+스카이런 2,917계단"처럼 숫자로 안 떨어지는 표기는 정렬 기준에서 뺀다(가짜
// 정밀도 금지 원칙과 동일 — 억지로 순서를 매기지 않고, 정렬 시 맨 뒤로 보낸다).
function parseKmValue(display: string | null): number | null {
  if (!display) return null;
  const trimmed = display.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function SortHeader({
  label,
  className,
  active,
  dir,
  onClick,
}: {
  label: string;
  className: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 hover:text-accent ${active ? "text-accent" : ""}`}
      >
        {label}
        <span className="text-[9px]" aria-hidden>
          {active ? (dir === "asc" ? "▲" : "▼") : "⋮"}
        </span>
      </button>
    </th>
  );
}

export default function CompetitionsTable({
  races,
  members,
  year,
}: {
  races: CompetitionRaceRow[];
  members: MemberOption[];
  year: number;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // 정렬 안 한 기본 상태는 서버가 준 원래 순서(날짜순) 그대로 — 정렬 버튼을 눌렀을 때만
  // 복사본을 만들어 정렬한다(원본 races 배열은 건드리지 않음).
  const sortedRaces = useMemo(() => {
    if (!sortKey) return races;
    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...races];
    copy.sort((r1, r2) => {
      switch (sortKey) {
        case "month":
          return (r1.month - r2.month) * dir;
        case "date":
          return r1.startDate.localeCompare(r2.startDate) * dir;
        case "category":
          return r1.category.localeCompare(r2.category, "ko") * dir;
        case "totalKm": {
          const n1 = parseKmValue(r1.totalKmDisplay);
          const n2 = parseKmValue(r2.totalKmDisplay);
          if (n1 === null && n2 === null) return 0;
          if (n1 === null) return 1; // 숫자로 안 떨어지는 값은 정렬 방향과 무관하게 항상 맨 뒤
          if (n2 === null) return -1;
          return (n1 - n2) * dir;
        }
        default:
          return 0;
      }
    });
    return copy;
  }, [races, sortKey, sortDir]);

  let lastMonth: number | null = null;

  return (
    <div className="bg-paper-raised border border-line rounded-sm shadow-[0_1px_2px_rgba(20,34,32,.06),0_8px_24px_-12px_rgba(20,34,32,.12)]">
      <div className="flex items-center justify-between p-4 pb-0">
        <p className="font-mono-brand text-[10.5px] tracking-wide uppercase text-accent">
          {year}년 대회 캘린더 · {races.length}건
        </p>
        <div className="flex items-center gap-3">
          <a
            href="/api/export/competitions"
            className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1 hover:bg-accent-soft"
          >
            ⬇ 엑셀 다운로드
          </a>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="text-sm font-medium text-accent border border-accent/40 rounded-sm px-3 py-1 hover:bg-accent-soft"
            >
              + 새 대회 추가
            </button>
          )}
        </div>
      </div>
      <p className="px-4 pt-1.5 text-xs text-ink-faint">
        세종철인 인증만 하면 등록·수정·참가자 추가·삭제까지 모두 가능해요. 대신 모든 변경은
        기록되고 자동 백업되니, 지워도 복구할 수 있어요.
      </p>

      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line-strong text-left">
              <SortHeader
                label="월"
                className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint"
                active={sortKey === "month"}
                dir={sortDir}
                onClick={() => toggleSort("month")}
              />
              <SortHeader
                label="날짜"
                className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint whitespace-nowrap"
                active={sortKey === "date"}
                dir={sortDir}
                onClick={() => toggleSort("date")}
              />
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">대회명</th>
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">세부종목</th>
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint">참가자</th>
              <SortHeader
                label="분류"
                className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint"
                active={sortKey === "category"}
                dir={sortDir}
                onClick={() => toggleSort("category")}
              />
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint/70 text-right whitespace-nowrap">
                S/B/R
              </th>
              <SortHeader
                label="전체(km)"
                className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint/70 text-right whitespace-nowrap"
                active={sortKey === "totalKm"}
                dir={sortDir}
                onClick={() => toggleSort("totalKm")}
              />
              <th className="px-2 py-2 font-mono-brand text-[10.5px] uppercase text-ink-faint/70 text-right whitespace-nowrap">
                고도(m)
              </th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {adding && <RaceForm colSpan={COL_COUNT} action={createRaceAction} onDone={() => setAdding(false)} />}
            {sortedRaces.map((race) => {
              const showMonth = race.month !== lastMonth;
              lastMonth = race.month;

              if (editingId === race.id) {
                return (
                  <RaceForm
                    key={race.id}
                    race={race}
                    colSpan={COL_COUNT}
                    action={updateRaceAction}
                    onDone={() => setEditingId(null)}
                  />
                );
              }

              return (
                <tr key={race.id} className="border-b border-line hover:bg-paper align-top">
                  <td className="px-2 py-2 font-mono-brand text-ink-soft whitespace-nowrap">
                    {showMonth ? MONTH_LABELS[race.month - 1] : ""}
                  </td>
                  <td className="px-2 py-2 font-mono-brand text-ink-soft whitespace-nowrap">{race.dateLabel}</td>
                  <td className="px-2 py-2 text-ink font-medium">{race.raceName}</td>
                  <td className="px-2 py-2 text-ink-faint max-w-[220px]">{race.courseDetail ?? ""}</td>
                  <td className="px-2 py-2">
                    <Participants race={race} members={members} />
                  </td>
                  <td className="px-2 py-2">
                    <CategoryTag category={race.category} />
                  </td>
                  <td className="px-2 py-2 text-ink-faint/80 text-right whitespace-nowrap">
                    <CompactDistance race={race} />
                  </td>
                  <td className="px-2 py-2 text-ink-faint/80 text-right whitespace-nowrap font-mono-brand">
                    {formatTotalKm(race.totalKmDisplay) ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-ink-faint/80 text-right whitespace-nowrap font-mono-brand">
                    {race.elevationGainM ?? "—"}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <button onClick={() => setEditingId(race.id)} className="text-xs text-accent hover:underline mr-2">
                      수정
                    </button>
                    {confirmingDeleteId === race.id ? (
                      <form
                        action={async (fd) => {
                          await deleteRaceAction(fd);
                          setConfirmingDeleteId(null);
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        <input type="hidden" name="id" value={race.id} />
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
                        onClick={() => setConfirmingDeleteId(race.id)}
                        className="text-xs text-ink-faint hover:text-pending hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {races.length === 0 && !adding && (
              <tr>
                <td colSpan={COL_COUNT} className="px-2 py-6 text-center text-sm text-ink-faint">
                  {year}년에 등록된 대회 일정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
