import assert from "node:assert/strict";
import test from "node:test";
import {
  filterRecoveryDevices,
  type RecoveryDevice,
} from "./action1-recovery";
import {
  mergeRecoveryDeviceAliases,
  normalizeFriendlyName,
} from "./recovery-device-aliases";

const device = {
  endpointId: "endpoint-1",
  computerName: "WIN-001",
  friendlyName: null,
} as RecoveryDevice;

test("friendly names are trimmed and blank values clear", () => {
  assert.equal(normalizeFriendlyName("  Finance laptop  "), "Finance laptop");
  assert.equal(normalizeFriendlyName(" \t "), null);
  assert.equal(normalizeFriendlyName(null), null);
  assert.throws(() => normalizeFriendlyName("x".repeat(121)), /120/);
});

test("aliases merge onto copies without mutating Action1 devices", () => {
  const merged = mergeRecoveryDeviceAliases(
    [device],
    [{ endpointId: device.endpointId, friendlyName: "Finance laptop" }],
  );

  assert.equal(device.friendlyName, null);
  assert.equal(merged[0]?.friendlyName, "Finance laptop");
  assert.notEqual(merged[0], device);
  assert.equal(
    filterRecoveryDevices(merged, { search: "finance" }).length,
    1,
  );
});