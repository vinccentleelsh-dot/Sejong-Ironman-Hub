"use server";

import { redirect } from "next/navigation";
import { checkSuperAdminPassword, setSuperAdminCookie, clearSuperAdminCookie } from "@/lib/auth";

export async function superLoginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/settings");

  if (!(await checkSuperAdminPassword(password))) {
    redirect(`/admin/super-login?error=1&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  await setSuperAdminCookie();
  redirect(redirectTo);
}

export async function superLogoutAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/training-plan");
  await clearSuperAdminCookie();
  redirect(redirectTo);
}
