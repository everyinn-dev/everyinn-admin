import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyProfile,
  clearAutofill,
  emptyGuest,
  highlightSegments,
  maskNational,
  queryTokens,
  samePhone,
} from "../src/lib/guestAutofill.ts";
import { toMemberSearchHit } from "../src/lib/coreMappers.ts";
import { cdpCore, setTestFetcher } from "../src/lib/cores.ts";
import { createValidator } from "./helpers/schemaValidator.mjs";
import { FakeCore } from "./helpers/fakeCore.mjs";

const cdpDoc = JSON.parse(readFileSync(fileURLToPath(new URL("../contracts/cdp-core.openapi.json", import.meta.url)), "utf8"));
const cdp = createValidator(cdpDoc);

const guestA = { customerId: "cus_aaaaaaaa", phone: "0901111111", fullName: "Nguyễn Văn A", instagram: "a.ig", facebook: "A Facebook", zalo: "" };
const guestB = { customerId: "cus_bbbbbbbb", phone: "0902222222", fullName: "Trần Thị B", instagram: "", facebook: "", zalo: "0902222222" };

test("picking guest A then guest B leaves nothing of A in the form", () => {
  const a = applyProfile(emptyGuest(), null, guestA);
  assert.equal(a.replaced, true);
  assert.deepEqual(a.fields, { phone: "0901111111", name: "Nguyễn Văn A", instagram: "a.ig", facebook: "A Facebook", zalo: "" });

  const b = applyProfile(a.fields, a.snapshot, guestB);
  assert.equal(b.replaced, true);
  assert.deepEqual(b.fields, { phone: "0902222222", name: "Trần Thị B", instagram: "", facebook: "", zalo: "0902222222" });
  assert.equal(b.undo.label, "Trần Thị B");
  assert.deepEqual(b.undo.fields, a.fields, "undo restores the block as it was before the fill");
});

test("finding the guest that is already filled in keeps what staff typed since", () => {
  const a = applyProfile(emptyGuest(), null, guestA);
  const edited = { ...a.fields, facebook: "A mới" };
  const again = applyProfile(edited, a.snapshot, guestA);
  assert.equal(again.replaced, false);
  assert.equal(again.undo, null);
  assert.deepEqual(again.fields, edited);
});

test("switching to an unknown phone clears autofilled values but keeps hand-typed ones", () => {
  const a = applyProfile(emptyGuest(), null, guestA);
  const typed = { ...a.fields, phone: "0903333333", instagram: "khach.moi" };
  const cleared = clearAutofill(typed, a.snapshot);
  assert.deepEqual(cleared, { phone: "0903333333", name: "", instagram: "khach.moi", facebook: "", zalo: "" });
  assert.deepEqual(clearAutofill(typed, null), typed, "nothing autofilled → nothing cleared");
});

test("a profile without a phone keeps the phone staff typed", () => {
  const r = applyProfile({ ...emptyGuest(), phone: "0904444444" }, null, { customerId: "cus_cccccccc", fullName: "C" });
  assert.equal(r.fields.phone, "0904444444");
});

test("phone comparison ignores format", () => {
  assert.equal(samePhone("+84 901 111 111", "0901111111"), true);
  assert.equal(samePhone("84901111111", "0901.111.111"), true);
  assert.equal(samePhone("0901111111", "0901111112"), false);
  assert.equal(samePhone("", ""), false);
});

test("dropdown helpers: folding, highlight, masked phone", () => {
  assert.deepEqual(queryTokens("Ngọc  TRÂM.9"), ["ngoc", "tram", "9"]);
  assert.deepEqual(queryTokens("Đức"), ["duc"]);
  const segs = highlightSegments("Ngọc Trâm", ["ngoc", "tr"]);
  assert.deepEqual(segs, [
    { text: "Ngọc", hit: true },
    { text: " ", hit: false },
    { text: "Tr", hit: true },
    { text: "âm", hit: false },
  ]);
  assert.equal(maskNational("+84912345678"), "0912 ••• 678");
});

test("search hit maps to a Member the forms can autofill from, and matches the CDP contract", () => {
  const hit = {
    customerId: "cus_aaaaaaaa",
    fullName: "Nguyễn Ngọc Trâm",
    phone: "+84912345678",
    phoneNational: "0912345678",
    instagram: "ngoctram.99",
    facebook: "Ngọc Trâm",
    zalo: null,
    tier: "not_member",
    lifetimeBookingCount: 1,
    noShowCount: 0,
    isBlocked: false,
    lastBookingAt: "2026-10-12T08:00:00.000Z",
    lastRoomClass: "haven",
    matchedField: "facebook",
    matchedValue: "Ngọc Trâm",
    version: 3,
  };
  assert.deepEqual(cdp.validateSchema("#/components/schemas/CustomerSearchResult", { results: [hit] }), []);
  const mapped = toMemberSearchHit(hit);
  assert.equal(mapped.matchedField, "facebook");
  assert.equal(mapped.lastBookingAt, "2026-10-12T08:00:00.000Z");
  assert.deepEqual(
    { phone: mapped.member.phone, customerId: mapped.member.customerId, version: mapped.member.version, loyaltyTier: mapped.member.loyaltyTier },
    { phone: "0912345678", customerId: "cus_aaaaaaaa", version: 3, loyaltyTier: "new" },
  );
  const filled = applyProfile(emptyGuest(), null, mapped.member);
  assert.equal(filled.fields.facebook, "Ngọc Trâm");
  assert.equal(filled.fields.zalo, "");
});

test("phone change goes to CDP with the staff actor, expectedVersion and an idempotency key", async () => {
  const fake = new FakeCore("cdp");
  fake.on("POST", "/internal/v1/customers/cus_aaaaaaaa/phone", (req) => ({
    status: 409,
    body: { error: { code: "PHONE_TAKEN", message: "Số điện thoại này đã thuộc hồ sơ khách khác — chưa hỗ trợ gộp hồ sơ.", request_id: "r" } },
  }));
  setTestFetcher(() => fake);
  try {
    await assert.rejects(
      cdpCore.post("/internal/v1/customers/cus_aaaaaaaa/phone", {
        staff: { id: 7, role: "manager", full_name: "QL" },
        idempotencyKey: "adm.customer-phone-change.test-1",
        body: { newPhone: "0902222222", expectedVersion: 3, reason: "Khách đổi số mới" },
      }),
      (err) => err.code === "PHONE_TAKEN" && err.status === 409,
    );
    const call = fake.calls[0];
    assert.equal(call.headers.get("x-ei-actor-role"), "manager");
    assert.equal(call.headers.get("idempotency-key"), "adm.customer-phone-change.test-1");
    assert.deepEqual(call.body, { newPhone: "0902222222", expectedVersion: 3, reason: "Khách đổi số mới" });
    assert.deepEqual(cdp.validateSchema("#/components/schemas/PhoneChangeRequest", call.body), []);
  } finally {
    setTestFetcher(null);
  }
});
