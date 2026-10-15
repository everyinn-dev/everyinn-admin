import test from "node:test";
import assert from "node:assert/strict";

test("jwt fails closed when JWT_SECRET is unset", async () => {
  const oldSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    const { getSecretKey } = await import("../src/lib/jwt.ts");
    assert.throws(
      () => getSecretKey(),
      /JWT_SECRET environment variable is missing/,
      "Should throw error when JWT_SECRET is unset"
    );
  } finally {
    if (oldSecret !== undefined) {
      process.env.JWT_SECRET = oldSecret;
    }
  }
});

test("jwt signs and verifies payload correctly when JWT_SECRET is set", async () => {
  process.env.JWT_SECRET = "test_secret_for_unit_tests_123456789";
  const { signStaffJwt, verifyStaffJwt } = await import("../src/lib/jwt.ts");

  const payload = {
    sub: 42,
    phone: "0901234567",
    fullName: "Reception Test",
    role: "receptionist",
  };

  const token = await signStaffJwt(payload, 3600);
  assert.ok(typeof token === "string" && token.split(".").length === 3);

  const decoded = await verifyStaffJwt(token);
  assert.ok(decoded);
  assert.equal(decoded.sub, 42);
  assert.equal(decoded.phone, "0901234567");
  assert.equal(decoded.role, "receptionist");
});
