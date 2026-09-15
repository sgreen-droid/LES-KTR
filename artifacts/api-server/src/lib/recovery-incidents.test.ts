import assert from "node:assert/strict";
import test from "node:test";
import {
  GetRecoveryIncidentResponse,
  type RecoveryIncidentDetail,
} from "@workspace/api-zod";
import type { RecoveryDevice } from "./action1-recovery";
import {
  applyCurrentFriendlyNamesToIncident,
  normalizeRecoveryDeviceSnapshot,
  renderRecoveryEvidenceCsv,
  renderRecoveryEvidencePrintDocument,
  type RecoveryEvidenceExport,
} from "./recovery-incidents";

function makeDevice(): RecoveryDevice {
  return {
    accuracy: null,
    addressPrecision: null,
    addressSource: null,
    agentHealth: null,
    agentVersion: null,
    city: null,
    computerName: "WIN-001",
    country: null,
    crossStreets: null,
    deviceId: "device-1",
    endpointId: "endpoint-1",
    endpointStatus: "ONLINE",
    friendlyName: null,
    isDuplicateComputerName: false,
    isMapSafe: false,
    lastAttempt: null,
    lastSeen: null,
    lastSuccess: null,
    latitude: null,
    locationAgeMinutes: null,
    locationCoordinates: null,
    locationError: null,
    locationIntegrity: null,
    locationPermission: null,
    locationQuality: null,
    locationSequence: null,
    locationSource: null,
    locationStatus: null,
    locationSummary: null,
    locationUpdated: null,
    longitude: null,
    mapEmbedUrl: null,
    mapLink: null,
    manufacturer: null,
    model: null,
    operatingSystem: "Windows",
    organizationId: "org-1",
    organizationName: "Example",
    positionSource: null,
    postalCode: null,
    recoveryStatus: null,
    serialNumber: null,
    state: null,
    streetAddress: null,
    nearestAddress: null,
  };
}

test("historical incident snapshots gain nullable friendlyName at projection time", () => {
  const storedSnapshot = makeDevice() as unknown as Record<string, unknown>;
  delete storedSnapshot["friendlyName"];

  const projected = normalizeRecoveryDeviceSnapshot(storedSnapshot);

  assert.equal(projected.friendlyName, null);
  assert.equal(Object.hasOwn(storedSnapshot, "friendlyName"), false);
  assert.doesNotThrow(() =>
    GetRecoveryIncidentResponse.parse({
      id: "incident-1",
      title: "Recovery",
      caseNumber: null,
      owner: null,
      status: "OPEN",
      reportedAt: new Date(),
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      endpointCount: 1,
      evidence: [
        {
          endpointId: projected.endpointId,
          organizationId: projected.organizationId,
          organizationName: projected.organizationName,
          capturedAt: new Date(),
          sourceRefreshedAt: new Date(),
          device: projected,
        },
      ],
      audit: [],
    }),
  );
});

test("incident exports apply current aliases without changing stored evidence", () => {
  const storedDevice = makeDevice();
  const incident = {
    id: "incident-1",
    title: "Recovery",
    caseNumber: null,
    owner: null,
    status: "OPEN",
    reportedAt: new Date("2026-08-25T18:00:00.000Z"),
    resolvedAt: null,
    createdAt: new Date("2026-08-25T18:00:00.000Z"),
    updatedAt: new Date("2026-08-25T18:00:00.000Z"),
    endpointCount: 1,
    evidence: [
      {
        endpointId: storedDevice.endpointId,
        organizationId: storedDevice.organizationId,
        organizationName: storedDevice.organizationName,
        capturedAt: new Date("2026-08-25T18:00:00.000Z"),
        sourceRefreshedAt: new Date("2026-08-25T18:00:00.000Z"),
        device: storedDevice,
      },
    ],
    audit: [],
  } as RecoveryIncidentDetail;
  const exportedIncident = applyCurrentFriendlyNamesToIncident(
    incident,
    [{ endpointId: storedDevice.endpointId, friendlyName: "  Finance PC  " }],
  );
  const exportData = {
    exportId: "export-1",
    generatedAt: new Date("2026-08-25T19:00:00.000Z"),
    incident: exportedIncident,
    limitations: [],
    schemaVersion: "les-recovery-evidence/v2",
    source: "test",
  } as RecoveryEvidenceExport;

  assert.equal(storedDevice.friendlyName, null);
  assert.equal(
    exportedIncident.evidence[0]?.device.friendlyName,
    "Finance PC",
  );
  const csv = renderRecoveryEvidenceCsv(exportData);
  assert.match(csv, /friendly_name/);
  assert.match(csv, /Finance PC/);
  assert.match(csv, /WIN-001/);
  const printDocument = renderRecoveryEvidencePrintDocument(exportData);
  assert.match(printDocument, /Finance PC/);
  assert.match(printDocument, /Windows computer name/);
});