"use client";

export const ACCESS_COOKIE = "pt_access_token";
export const REFRESH_COOKIE = "pt_refresh_token";
export const OWNER_ACCESS_BACKUP_COOKIE = "pt_owner_access_backup";
export const OWNER_REFRESH_BACKUP_COOKIE = "pt_owner_refresh_backup";

/** Refresh JWT matches backend (7d). */
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;
/**
 * Keep access cookie for the same window as refresh. JWT expiry is enforced by the API;
 * if we expire the cookie at 1h, the browser deletes the token string and we send an empty
 * Bearer — refresh never runs and the session feels "broken."
 */
const ACCESS_COOKIE_MAX_AGE = REFRESH_MAX_AGE;

function readCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  if (!entry) return "";
  return decodeURIComponent(entry.slice(prefix.length));
}

/**
 * Read access token from cookie. Uses slice after the cookie name so JWT `=` padding
 * is never truncated (split("=")[1] breaks tokens that contain raw `=`).
 */
export function getAccessToken() {
  return readCookieValue(ACCESS_COOKIE);
}

export function getRefreshToken() {
  return readCookieValue(REFRESH_COOKIE);
}

export function setAccessToken(token: string, remember = true) {
  const age = remember ? `; max-age=${ACCESS_COOKIE_MAX_AGE}` : "";
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(token)}; path=/${age}; SameSite=Lax`;
}

export function setRefreshToken(token: string, remember = true) {
  const age = remember ? `; max-age=${REFRESH_MAX_AGE}` : "";
  document.cookie = `${REFRESH_COOKIE}=${encodeURIComponent(token)}; path=/${age}; SameSite=Lax`;
}

export function setSessionTokens(access: string, refresh: string | undefined, remember = true) {
  setAccessToken(access, remember);
  if (refresh) setRefreshToken(refresh, remember);
}

export function clearAccessToken() {
  document.cookie = `${ACCESS_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${REFRESH_COOKIE}=; path=/; max-age=0`;
}

export function setOwnerBackupTokens(access: string, refresh: string | undefined) {
  document.cookie = `${OWNER_ACCESS_BACKUP_COOKIE}=${encodeURIComponent(access)}; path=/; max-age=${ACCESS_COOKIE_MAX_AGE}; SameSite=Lax`;
  if (refresh) {
    document.cookie = `${OWNER_REFRESH_BACKUP_COOKIE}=${encodeURIComponent(refresh)}; path=/; max-age=${REFRESH_MAX_AGE}; SameSite=Lax`;
  }
}

export function getOwnerBackupTokens() {
  return {
    access: readCookieValue(OWNER_ACCESS_BACKUP_COOKIE),
    refresh: readCookieValue(OWNER_REFRESH_BACKUP_COOKIE)
  };
}

export function clearOwnerBackupTokens() {
  document.cookie = `${OWNER_ACCESS_BACKUP_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${OWNER_REFRESH_BACKUP_COOKIE}=; path=/; max-age=0`;
}

export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
