/**
 * One Idempotency-Key per booking intent (double-submit guard for the create-booking form).
 *
 * The same request body reuses the previous key, so a retry after a lost response is replayed by Booking Core
 * (Core stores the result per key + body hash). A different body gets a fresh key, because Core rejects one key
 * reused with another body.
 */
export interface IntentKey {
  key: string;
  body: string;
}

export function resolveIntentKey(prev: IntentKey | null, body: string, makeKey: () => string): IntentKey {
  if (prev && prev.body === body) return prev;
  return { key: makeKey(), body };
}
