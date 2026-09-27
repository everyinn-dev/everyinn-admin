/**
 * apiClient.ts — Unified fetch wrapper for Every Inn Admin.
 *
 * Responsibilities:
 * 1. Executes standard Fetch requests.
 * 2. Automatically intercepts HTTP 401 Unauthorized responses.
 * 3. On 401:
 *    - Cleans all localStorage cache immediately (clearAllCache).
 *    - Dispatches session expiration event to notify UI (toast notification & redirect).
 *    - Redirects to /login?reason=expired.
 */

import { dispatchSessionExpired } from "./localCache";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      dispatchSessionExpired("unauthorized");
    }
  }

  return res;
}
