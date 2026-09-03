import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecoverySession,
  getRecoverySessionExpiry,
  revokeRecoverySession,
} from "./recovery-session";

test("recovery sessions expire within one hour and can be revoked", () => {
  const originalSecret = process.env["SESSION_SECRET"];
  process.env["SESSION_SECRET"] =
    "test-session-secret-that-is-long-enough-for-hmac";

  try {
    const startedAt = Date.now();
    const session = createRecoverySession();
    const expiresAt = getRecoverySessionExpiry(session.token);

    assert.equal(expiresAt, session.expiresAt);
    assert.ok(new Date(session.expiresAt).getTime() > startedAt);
    assert.ok(
      new Date(session.expiresAt).getTime() <= startedAt + 60 * 60 * 1000 + 100,
    );

    revokeRecoverySession(session.token);
    assert.equal(getRecoverySessionExpiry(session.token), null);
  } finally {
    if (originalSecret === undefined) {
      delete process.env["SESSION_SECRET"];
    } else {
      process.env["SESSION_SECRET"] = originalSecret;
    }
  }
});