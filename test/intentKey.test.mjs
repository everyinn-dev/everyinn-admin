import test from "node:test";
import assert from "node:assert/strict";
import { resolveIntentKey } from "../src/lib/intentKey.ts";

let n = 0;
const makeKey = () => `adm.booking-create.key-${++n}`;

test("same body reuses the key (retry after a lost response is replayed by Core)", () => {
  const first = resolveIntentKey(null, '{"roomId":"haven-101"}', makeKey);
  const second = resolveIntentKey(first, '{"roomId":"haven-101"}', makeKey);
  assert.equal(second.key, first.key);
});

test("changed body gets a fresh key (Core rejects one key reused with another body)", () => {
  const first = resolveIntentKey(null, '{"roomId":"haven-101"}', makeKey);
  const second = resolveIntentKey(first, '{"roomId":"sig-102"}', makeKey);
  assert.notEqual(second.key, first.key);
  assert.equal(second.body, '{"roomId":"sig-102"}');
});

test("after a rejected attempt the caller clears the intent, so the next submit gets a new key", () => {
  const first = resolveIntentKey(null, '{"a":1}', makeKey);
  const afterReject = resolveIntentKey(null, '{"a":1}', makeKey);
  assert.notEqual(afterReject.key, first.key);
});
