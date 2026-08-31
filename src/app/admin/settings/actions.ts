"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin, setAdminPassword, setSejongPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function changeAdminPasswordAction(formData: FormData) {
  await requireSuperAdmin();
  const next = str(formData, "newPassword");
  const confirm = str(formData, "confirmPassword");
  if (next.length < 4) throw new Error("비밀번호는 4자 이상이어야 합니다.");
  if (next !== confirm) throw new Error("두 비밀번호가 서로 다릅니다.");
  await setAdminPassword(next);
}

export async function changeSejongPasswordAction(formData: FormData) {
  await requireSuperAdmin();
  const next = str(formData, "newPassword");
  const confirm = str(formData, "confirmPassword");
  if (next.length < 4) throw new Error("비밀번호는 4자 이상이어야 합니다.");
  if (next !== confirm) throw new Error("두 비밀번호가 서로 다릅니다.");
  await setSejongPassword(next);
}

export async function upsertPointRuleAction(formData: FormData) {
  await requireSuperAdmin();
  const id = str(formData, "id");
  const label = str(formData, "label");
  const points = Number(formData.get("points"));
  const note = str(formData, "note") || null;

  if (!label) throw new Error("항목명을 입력해주세요.");
  if (!Number.isFinite(points)) throw new Error("포인트는 숫자여야 합니다.");

  if (id) {
    await prisma.pointRule.update({ where: { id }, data: { label, points, note } });
  } else {
    await prisma.pointRule.create({ data: { label, points, note } });
  }
  revalidatePath("/admin/settings");
}

export async function deletePointRuleAction(formData: FormData) {
  await requireSuperAdmin();
  const id = str(formData, "id");
  await prisma.pointRule.delete({ where: { id } });
  revalidatePath("/admin/settings");
}
