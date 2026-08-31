"use server";

import { redirect } from "next/navigation";
import { checkSejongPassword, setSejongAuthCookie, clearSejongAuthCookie } from "@/lib/auth";

export async function loginSejongAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/competitions");

  if (!(await checkSejongPassword(password))) {
    redirect(`/competitions/login?error=1&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  await setSejongAuthCookie();
  redirect(redirectTo);
}

export async function logoutSejongAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/competitions");
  await clearSejongAuthCookie();
  redirect(redirectTo);
}
