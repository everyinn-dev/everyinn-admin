"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { resolveIntentKey, type IntentKey } from "@/lib/intentKey";
import type { BffError } from "@/lib/bookingClosure";

/**
 * The one way every money command of the booking drawer talks to the BFF (cancel, add a charge, void a charge):
 * one Idempotency-Key per intent (the same body re-sent after a lost response is replayed by Core, a changed body
 * gets a new key), the busy flag, and the Core error text — all in one place so the panels behave the same.
 */
export function useBookingCommand(opts: { onError?: (status: number, data: BffError) => Promise<void> | void } = {}) {
  const intentRef = useRef<IntentKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const onErrorRef = useRef(opts.onError);
  useEffect(() => {
    onErrorRef.current = opts.onError;
  });

  /** Returns the parsed response on success, `null` after the error has been shown. */
  const run = useCallback(async <T extends object>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<(T & BffError) | null> => {
    setSubmitting(true);
    setError("");
    try {
      const text = JSON.stringify(body);
      intentRef.current = resolveIntentKey(intentRef.current, text, () => `adm.booking-cmd.${crypto.randomUUID()}`);
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Idempotency-Key": intentRef.current.key },
        body: text,
      });
      const data = (await res.json().catch(() => ({}))) as T & BffError;
      if (!res.ok) {
        intentRef.current = null; // the next try is a new attempt
        await onErrorRef.current?.(res.status, data);
        setError(data.error || "Thao tác không thành công.");
        return null;
      }
      return data;
    } catch (err) {
      intentRef.current = null;
      setError(err instanceof Error ? err.message : "Lỗi kết nối, vui lòng thử lại.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { run, submitting, error, setError };
}
