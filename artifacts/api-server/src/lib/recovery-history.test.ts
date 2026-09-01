import assert from "node:assert/strict";
import test from "node:test";
import type { RecoveryDevice } from "./action1-recovery";
import {
  buildRecoveryLocationHistoryAnalysis,
  createRecoveryObservationKey,
  parseAction1Timestamp,
  renderRecoveryLocationHistoryCsv,
  type RecoveryLocationObservation,
  type RecoveryLocationHistoryExport,
} from "./recovery-history";

const device: RecoveryDevice = {
  accuracy: null,
  addressSource: "Action1",
  agentHealth: null,
  agentVersion: "1.0.0",
  city: "Seattle",
  computerName: "=unsafe-computer-name",
  country: "US",
  crossStreets: "1st Ave & Pine St",
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
  state: "WA",
  streetAddress: "100 Example Ave",
  postalCode: "98101",
  nearestAddress: "100 Example Ave, Seattle, WA 98101",
  addressPrecision: "STREET",
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
    schemaVersion: "les-recovery-location-history/v2",
    generatedAt: new Date("2026-08-25T18:00:00.000Z"),
    source: "test",
    scope: "SINGLE",
    endpointIds: [device.endpointId],
    from: null,
    to: null,
    observationCount: 1,
    observationOrdering: "GROUPED_BY_ENDPOINT_THEN_CHRONOLOGICAL_ASCENDING",
    coverage: {
      endpointCount: 1,
      endpointsWithCoordinates: 1,
      observationCount: 1,
      coordinateObservationCount: 1,
      movementSegmentCount: 0,
      firstObservationAt: new Date("2026-08-25T17:30:00.000Z"),
      lastObservationAt: new Date("2026-08-25T17:30:00.000Z"),
      totalApparentDistanceMeters: 0,
      endpointSummaries: [
        {
          endpointId: device.endpointId,
          deviceId: null,
          computerNames: [device.computerName],
          organizationName: device.organizationName,
          observationCount: 1,
          coordinateObservationCount: 1,
          firstObservationAt: new Date("2026-08-25T17:30:00.000Z"),
          lastObservationAt: new Date("2026-08-25T17:30:00.000Z"),
          firstCoordinate: device.locationCoordinates,
          lastCoordinate: device.locationCoordinates,
          apparentDistanceMeters: 0,
          movementSegmentCount: 0,
          maxApparentSpeedKmh: null,
          locationStatuses: [device.locationStatus ?? ""],
          integrityStates: [device.locationIntegrity ?? ""],
          city: device.city,
          state: device.state,
          postalCode: device.postalCode,
          country: device.country,
          nearestAddress: device.nearestAddress,
          crossStreets: device.crossStreets,
        },
      ],
    },
    limitations: ["=never-formula"],
    observations: [
      {
        ...device,
        id: "observation-1",
        capturedAt: new Date("2026-08-25T18:00:00.000Z"),
        sourceRefreshedAt: new Date("2026-08-25T18:00:00.000Z"),
        locationObservedAt: new Date("2026-08-25T17:30:00.000Z"),
        lastSeenAt: new Date("2026-08-25T17:30:00.000Z"),
        observationNumber: 1,
        observationTimeBasis: "ENDPOINT_LOCATION_OBSERVED_AT",
        movementFromPrevious: null,
      },
    ],
  };

  const csv = renderRecoveryLocationHistoryCsv(exportData);
  assert.match(csv, /"'=unsafe-computer-name"/);
  assert.match(csv, /"'=serial"/);
  assert.match(csv, /"'=never-formula"/);
  assert.match(csv, /"EXPORT_SUMMARY"/);
  assert.match(csv, /"ENDPOINT_SUMMARY"/);
  assert.match(csv, /"OBSERVATION"/);
  assert.match(csv, /"movement_assessment"/);
  const columnCounts = csv
    .split("\r\n")
    .map((line) => line.split('","').length);
  assert.ok(columnCounts.every((count) => count === columnCounts[0]));
});

test("history evidence is chronological and calculates apparent movement per endpoint", () => {
  const makeObservation = (
    id: string,
    observedAt: string,
    latitude: number,
    longitude: number,
  ): RecoveryLocationObservation => ({
    ...device,
    id,
    capturedAt: new Date(observedAt),
    sourceRefreshedAt: new Date(observedAt),
    locationObservedAt: new Date(observedAt),
    lastSeenAt: new Date(observedAt),
    latitude,
    longitude,
    locationCoordinates: `${latitude},${longitude}`,
  });
  const analysis = buildRecoveryLocationHistoryAnalysis([
    makeObservation("observation-2", "2026-08-25T18:30:00.000Z", 47.61, -122.3),
    makeObservation("observation-1", "2026-08-25T17:30:00.000Z", 47.6, -122.3),
  ]);

  assert.equal(analysis.observations[0]?.id, "observation-1");
  assert.equal(analysis.observations[1]?.observationNumber, 2);
  assert.equal(
    analysis.observations[1]?.movementFromPrevious?.assessment,
    "COORDINATE_CHANGE",
  );
  assert.ok(
    (analysis.observations[1]?.movementFromPrevious?.distanceMeters ?? 0) > 1000,
  );
  assert.equal(analysis.endpointSummaries[0]?.movementSegmentCount, 1);
  assert.equal(analysis.movementSegmentCount, 1);
});