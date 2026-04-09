"use client";

import { getAccessToken, getRefreshToken, setAccessToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

const REQUEST_MS = 25_000;

/** Always return a signal so fetch cannot hang forever when the API is down (no AbortSignal.timeout in some browsers). */
function requestSignal(): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(REQUEST_MS);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), REQUEST_MS);
  return c.signal;
}

async function parseResponse(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      signal: requestSignal()
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok || typeof data?.access_token !== "string") return false;
    setAccessToken(data.access_token);
    return true;
  } catch {
    return false;
  }
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  isRetry: boolean
): Promise<Response> {
  if (!isRetry && !getAccessToken() && getRefreshToken()) {
    await tryRefreshAccessToken();
  }
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
    signal: init.signal ?? requestSignal()
  });
  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) return authorizedFetch(path, init, true);
  }
  return res;
}

export async function apiGet(path: string) {
  const res = await authorizedFetch(path, { method: "GET" }, false);
  return parseResponse(res);
}

export async function apiPost(path: string, body: unknown, withAuth = true) {
  if (!withAuth) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: requestSignal()
    });
    return parseResponse(res);
  }
  const res = await authorizedFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    },
    false
  );
  return parseResponse(res);
}

export async function apiPatch(path: string, body: unknown) {
  const res = await authorizedFetch(
    path,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    },
    false
  );
  return parseResponse(res);
}

export async function apiPut(path: string, body: unknown) {
  const res = await authorizedFetch(
    path,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    },
    false
  );
  return parseResponse(res);
}

export async function apiDelete(path: string) {
  const res = await authorizedFetch(path, { method: "DELETE" }, false);
  return parseResponse(res);
}
