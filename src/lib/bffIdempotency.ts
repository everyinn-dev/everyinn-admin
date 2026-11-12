import { newIdempotencyKey } from "@/lib/cores";

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/** One user intent == one key: the client sends it, so a double click / retry replays instead of failing. */
export function intentKey(req: Request, action: string): string {
  const headerKey = req.headers.get("idempotency-key")?.trim();
  return headerKey && IDEMPOTENCY_KEY_RE.test(headerKey) ? headerKey : newIdempotencyKey(action);
}
