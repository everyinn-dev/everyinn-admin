import test from "node:test";
import assert from "node:assert/strict";
import { CoreError } from "../src/lib/cores.ts";
import { toHttpError } from "../src/lib/apiError.ts";

test("toHttpError passes through 4xx Core errors (400, 404, 409, 422)", async () => {
  const err400 = new CoreError(400, "BAD_REQUEST", "Dữ liệu không hợp lệ", { field: "phone" }, "rid-400");
  const res400 = toHttpError(err400);
  assert.equal(res400.status, 400);
  const data400 = await res400.json();
  assert.deepEqual(data400, {
    error: "Dữ liệu không hợp lệ",
    code: "BAD_REQUEST",
    details: { field: "phone" },
    requestId: "rid-400",
  });

  const err404 = new CoreError(404, "NOT_FOUND", "Không tìm thấy phòng", undefined, "rid-404");
  const res404 = toHttpError(err404);
  assert.equal(res404.status, 404);
  const data404 = await res404.json();
  assert.equal(data404.code, "NOT_FOUND");

  const err409 = new CoreError(409, "SLOT_CONFLICT", "Phòng đã có người đặt", undefined, "rid-409");
  const res409 = toHttpError(err409);
  assert.equal(res409.status, 409);
  const data409 = await res409.json();
  assert.equal(data409.code, "SLOT_CONFLICT");
});

test("toHttpError maps 5xx and gateway errors to 503 CORE_UNAVAILABLE", async () => {
  const err500 = new CoreError(500, "INTERNAL_CORE_CRASH", "Database lock timeout", undefined, "rid-500");
  const res500 = toHttpError(err500);
  assert.equal(res500.status, 503);
  const data500 = await res500.json();
  assert.equal(data500.code, "INTERNAL_CORE_CRASH");
  assert.match(data500.error, /Dịch vụ tạm thời không khả dụng/);

  const err502 = new CoreError(502, "CORE_BAD_RESPONSE", "Invalid JSON", undefined, "rid-502");
  const res502 = toHttpError(err502);
  assert.equal(res502.status, 503);
});

test("toHttpError maps uncaught generic errors to 500 INTERNAL_ERROR", async () => {
  const genericErr = new Error("Unexpected null pointer");
  const res = toHttpError(genericErr);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.code, "INTERNAL_ERROR");
});
