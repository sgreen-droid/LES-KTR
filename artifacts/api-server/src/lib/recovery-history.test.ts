import assert from "node:assert/strict";
import test from "node:test";
import type { RecoveryDevice } from "./action1-recovery";
import {
  createRecoveryObservationKey,
  parseAction1Timestamp,
  renderRecoveryLocationHistoryCsv,
  type RecoveryLocationHistoryExport,
} from "./recovery-history";

const device: RecoveryDevice = {
  accuracy: null,
  agentHealth: null,
  agentVersion: "1.0.0",
  computerName: "=unsafe-computer-name",
  deviceId: null,
  endpointId: "endpoint-1",
  endpointStatus: "ONLINE",
  isDuplicateComputerName: false,
  isMapSafe: true,
  lastAttempt: null,
  lastSeen: "2026-08-25_17-30-00",
  lastSuccess: null,
  latitude: 47.6,
  locationAgeMinutes: "5",
  locationCoordinates: "47.6,-122.3",
  locationError: null,
  locationIntegrity: "VALID",
  locationPermission: "GRANTED",
  locationQuality: "GOOD",
  locationSequence: "1",
  locationSource: "WINDOWS",
  locationStatus: "CURRENT",
  locationSummary: null,
  locationUpdated: "2026-08-25_17-30-00",
  longitude: -122.3,
  manufacturer: "LES",
  mapEmbedUrl: null,
  mapLink: null,
  model: "Recovery Test",
  operatingSystem: "Windows 11",
  organizationId: "org-1",
  organizationName: "Example Org",
  positionSource: "GPS",
  recoveryStatus: "ACTIVE",
  serialNumber: "=serial",
};

test("normalizes Action1 underscore timestamps safely", () => {
  assert.equal(
    parseAction1Timestamp("2026-08-25_17-30-00")?.toISOString(),
    "2026-08-25T17:30:00.000Z",
  );
  assert.equal(parseAction1Timestamp("not-a-date"), null);
});

test("observation keys suppress identical captures but retain a newly reported device ID", () => {
  const refreshedAt = new Date("2026-08-25T18:00:00.000Z");
  const first = createRecoveryObservationKey(device, refreshedAt);
  const duplicate = createRecoveryObservationKey(device, refreshedAt);
  const withDeviceId = createRecoveryObservationKey(
    { ...device, deviceId: "action1-device-7" },
    refreshedAt,
  );

  assert.equal(first, duplicate);
  assert.notEqual(first, withDeviceId);
});

test("history CSV is spreadsheet-safe for identity values", () => {
  const exportData: RecoveryLocationHistoryExport = {
    exportId: "export-1",
    schemaVersion: "les-recovery-location-history/v1",
    generatedAt: new Date("2026-08-25T18:00:00.000Z"),
    source: "test",
    scope: "SINGLE",
    endpointIds: [device.endpointId],
    from: null,
    to: null,
    observationCount: 1,
    limitations: ["=never-formula"],
    observations: [
      {
        ...device,
        id: "observation-1",
        capturedAt: new Date("2026-08-25T18:00:00.000Z"),
        sourceRefreshedAt: new Date("2026-08-25T18:00:00.000Z"),
        locationObservedAt: new Date("2026-08-25T17:30:00.000Z"),
        lastSeenAt: new Date("2026-08-25T17:30:00.000Z"),
      },
    ],
  };

  const csv = renderRecoveryLocationHistoryCsv(exportData);
  assert.match(csv, /"'=unsafe-computer-name"/);
  assert.match(csv, /"'=serial"/);
  assert.match(csv, /"'=never-formula"/);
});