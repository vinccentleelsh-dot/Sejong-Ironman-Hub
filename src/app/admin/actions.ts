"use server";

import { redirect } from "next/navigation";
import { checkAdminPassword, setAdminCookie, clearAdminCookie } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/training-plan");

  if (!(await checkAdminPassword(password))) {
    redirect(`/admin/login?error=1&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  await setAdminCookie();
  redirect(redirectTo);
}

export async function logoutAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/training-plan");
  await clearAdminCookie();
  redirect(redirectTo);
}
