/**
 * A second command of the same user intent (e.g. the payment recorded together with a charge) gets its own key derived
 * from the intent's key, so a retry of the whole intent replays BOTH commands instead of running the second twice.
 * Pure (no imports) so node:test can load it; stays inside Core's 8–128 character rule.
 */
export function derivedKey(intent: string, suffix: string): string {
  return `${intent.slice(0, 128 - suffix.length - 1)}.${suffix}`;
}
