import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/db";

// 회원 로그인은 없음 — 운영자 전용 비밀번호 1개로 "쓰기 권한"만 구분한다.
// (요구사항 정의서 결정 로그: "간단한 운영자 암호 1개면 충분")
//
// 쿠키에는 비밀번호 원문이 아니라, 서버 비밀키로 서명한 토큰만 저장한다.

const COOKIE_NAME = "admin_token";
const MARKER = "sejong-admin-authenticated";

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

// 비밀번호 저장소 — 관리자 페이지에서 바꾼 값은 AppSetting 테이블(해시)에 저장된다.
// Vercel 배포 환경에서는 env 변수를 앱 안에서 바꿀 방법이 없어서(대시보드를 거쳐야 함),
// "관리자 페이지"에서 직접 바꿀 수 있게 DB로 옮겼다. 한 번도 안 바꿨으면(DB에 값 없음)
// 기존 env 변수(ADMIN_PASSWORD/SEJONG_AUTH_PASSWORD)로 그대로 동작한다.

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidateHash = scryptSync(password, salt, 64);
  const storedHash = Buffer.from(hash, "hex");
  if (candidateHash.length !== storedHash.length) return false;
  return timingSafeEqual(candidateHash, storedHash);
}

async function getAppSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setAppSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

function checkPlainPassword(password: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET 환경변수가 설정되어 있지 않습니다 (.env 확인).");
  }
  return secret;
}

const ADMIN_PASSWORD_KEY = "admin_password_hash";

export async function checkAdminPassword(password: string): Promise<boolean> {
  const stored = await getAppSetting(ADMIN_PASSWORD_KEY);
  if (stored) return verifyPasswordHash(password, stored);
  // 관리자 페이지에서 한 번도 안 바꿨으면 기존 env 변수(.env / Vercel 환경변수)로 폴백
  return checkPlainPassword(password, process.env.ADMIN_PASSWORD);
}

export async function setAdminPassword(newPassword: string) {
  await setAppSetting(ADMIN_PASSWORD_KEY, hashPassword(newPassword));
}

export function makeAdminToken(): string {
  return sign(MARKER, getSecret());
}

export async function setAdminCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, makeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = makeAdminToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error("운영자 권한이 필요합니다. 먼저 로그인해주세요.");
  }
}

// "세종철인 인증" — 대회기록(/competitions) 전용 게이트. 운영자 인증과는 완전히 별개 쿠키·
// 비밀번호를 쓴다 (지금 값은 우연히 같지만, 나중에 서로 다르게 바꿀 수 있어야 하므로).
// 열람·등록·수정·삭제·참가 전부 이 인증을 요구한다 — 실수/악의로 지워지는 것에 대한 안전망은
// 감사로그 + 자동 백업(스냅샷)으로 별도 확보한다.

const SEJONG_COOKIE_NAME = "sejong_auth_token";
const SEJONG_MARKER = "sejong-competitions-authenticated";

function getSejongSecret() {
  const secret = process.env.SEJONG_AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("SEJONG_AUTH_SESSION_SECRET 환경변수가 설정되어 있지 않습니다 (.env 확인).");
  }
  return secret;
}

const SEJONG_AUTH_PASSWORD_KEY = "sejong_auth_password_hash";

export async function checkSejongPassword(password: string): Promise<boolean> {
  const stored = await getAppSetting(SEJONG_AUTH_PASSWORD_KEY);
  if (stored) return verifyPasswordHash(password, stored);
  return checkPlainPassword(password, process.env.SEJONG_AUTH_PASSWORD);
}

export async function setSejongPassword(newPassword: string) {
  await setAppSetting(SEJONG_AUTH_PASSWORD_KEY, hashPassword(newPassword));
}

function makeSejongToken(): string {
  return sign(SEJONG_MARKER, getSejongSecret());
}

export async function setSejongAuthCookie() {
  const store = await cookies();
  store.set(SEJONG_COOKIE_NAME, makeSejongToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
}

export async function clearSejongAuthCookie() {
  const store = await cookies();
  store.delete(SEJONG_COOKIE_NAME);
}

export async function isSejongAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SEJONG_COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = makeSejongToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireSejongAuth() {
  if (!(await isSejongAuthed())) {
    throw new Error("세종철인 인증이 필요합니다. 먼저 비밀번호를 입력해주세요.");
  }
}

// "관리자 페이지" 전용 — 운영진 비밀번호/세종철인 인증 비밀번호 변경, 세철포인트 규정,
// 변경 로그·IP 추적처럼 민감한 화면은 운영진 전체(dnsdudwls)가 아니라 딱 한 사람만 접근할 수
// 있게 완전히 별개의 세 번째 비밀번호로 게이트한다 (2026.09 결정 — "이건 나만 알고 있을 것").

const SUPERADMIN_COOKIE_NAME = "superadmin_token";
const SUPERADMIN_MARKER = "sejong-superadmin-authenticated";

function getSuperAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET 환경변수가 설정되어 있지 않습니다 (.env 확인).");
  }
  // 별도 시크릿을 새로 발급하는 대신 기존 ADMIN_SESSION_SECRET을 다른 마커로 서명해 재사용한다
  // (쿠키 자체는 admin_token과 이름·값이 달라 완전히 독립적으로 검증됨).
  return secret;
}

const SUPERADMIN_PASSWORD_KEY = "superadmin_password_hash";

export async function checkSuperAdminPassword(password: string): Promise<boolean> {
  const stored = await getAppSetting(SUPERADMIN_PASSWORD_KEY);
  if (stored) return verifyPasswordHash(password, stored);
  return checkPlainPassword(password, process.env.SUPERADMIN_PASSWORD);
}

export async function setSuperAdminPassword(newPassword: string) {
  await setAppSetting(SUPERADMIN_PASSWORD_KEY, hashPassword(newPassword));
}

function makeSuperAdminToken(): string {
  return sign(SUPERADMIN_MARKER, getSuperAdminSecret());
}

export async function setSuperAdminCookie() {
  const store = await cookies();
  store.set(SUPERADMIN_COOKIE_NAME, makeSuperAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
}

export async function clearSuperAdminCookie() {
  const store = await cookies();
  store.delete(SUPERADMIN_COOKIE_NAME);
}

export async function isSuperAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SUPERADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = makeSuperAdminToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireSuperAdmin() {
  if (!(await isSuperAdmin())) {
    throw new Error("관리자 권한이 필요합니다. 먼저 로그인해주세요.");
  }
}

// 감사로그용 — 로컬/사설망에서는 정확한 클라이언트 IP를 못 받을 수 있음 (최선 노력).
export async function getRequestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent");
  return { ipAddress, userAgent };
}
