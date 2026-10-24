"use client";

import type { SessionUser } from "@anzelu/contracts";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

async function request<T>(path: string, init: RequestInit = {}, paged = false): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    const e = json?.error ?? {};
    throw new ApiError(e.message ?? `Request failed (${res.status})`, res.status, e.code ?? "ERROR", e.details, json?.meta?.requestId);
  }
  if (paged) return { items: json.data, total: json.meta.total, page: json.meta.page, pageSize: json.meta.pageSize } as T;
  return json?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  page: <T>(path: string) => request<Page<T>>(path, {}, true),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}), headers }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function useApi<T>(path: string | null, options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">) {
  return useQuery<T>({ queryKey: [path], queryFn: () => api.get<T>(path!), enabled: !!path, ...options });
}

export function usePage<T>(path: string | null) {
  return useQuery<Page<T>>({ queryKey: ["page", path], queryFn: () => api.page<T>(path!), enabled: !!path, placeholderData: (prev) => prev });
}

export function useSession() {
  return useApi<SessionUser>("/auth/me", { staleTime: 60_000, retry: false });
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
}

/** Field-level messages from a 400 VALIDATION_FAILED response, keyed by path. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return {};
  return Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
}

export function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
