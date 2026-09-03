import assert from "node:assert/strict";
import test from "node:test";
import type { RecoveryDevice } from "./action1-recovery";
import {
  renderRecoveryEvidenceCsv,
  renderRecoveryEvidencePrintDocument,
  type RecoveryEvidenceExport,
} from "./recovery-incidents";

const device = {
  accuracy: "35 m",
  addressPrecision: "ADDRESS",
  addressSource: "OSM_NOMINATIM",
  agentHealth: "HEALTHY",
  agentVersion: "1.1.7",
  city: "New York",
  computerName: "LES-LAPTOP-01",
  country: "US",
  crossStreets: "Main Street & First Avenue",
  deviceId: "device-1",
  endpointId: "endpoint-1",
  endpointStatus: "ONLINE",
  isDuplicateComputerName: false,
  isMapSafe: true,
  lastAttempt: null,
  lastSeen: "2026-09-03_18-00-00",
  lastSuccess: "2026-09-03_18-00-00",
  latitude: 40.75,
  locationAgeMinutes: "5",
  locationCoordinates: "40.750000, -73.990000",
  locationError: null,
  locationIntegrity: "VALID",
  locationPermission: "GRANTED",
  locationQuality: "GOOD",
  locationSequence: "42",
  locationSource: "WINDOWS",
  locationStatus: "ACTIVE",
  locationSummary: "Last-known recovery observation",
  locationUpdated: "2026-09-03_18-00-00",
  longitude: -73.99,
  manufacturer: "Example",
  mapEmbedUrl: null,
  mapLink:
    "https://www.openstreetmap.org/?mlat=40.750000&mlon=-73.990000#map=18/40.750000/-73.990000",
  model: "Recovery Laptop",
  nearestAddress: "123 Main Street",
  operatingSystem: "Windows 11",
  organizationId: "org-1",
  organizationName: "Example Organization",
  positionSource: "GPS",
  postalCode: "10001",
  recoveryStatus: "ACTIVE",
  serialNumber: "SERIAL-1",
  state: "NY",
  streetAddress: "123 Main Street",
} satisfies RecoveryDevice;

const exportData = {
  exportId: "export-1",
  generatedAt: new Date("2026-09-03T18:10:00.000Z"),
  schemaVersion: "les-recovery-evidence/v2",
  source: "Test Action1 evidence",
  limitations: ["Last-known evidence only."],
  incident: {
    id: "incident-1",
    title: "Recovery test",
    caseNumber: "CASE-1",
    owner: "Recovery team",
    status: "OPEN",
    reportedAt: new Date("2026-09-03T18:00:00.000Z"),
    resolvedAt: null,
    createdAt: new Date("2026-09-03T18:00:00.000Z"),
    updatedAt: new Date("2026-09-03T18:00:00.000Z"),
    endpointCount: 1,
    evidence: [
      {
        endpointId: device.endpointId,
        organizationId: device.organizationId,
        organizationName: device.organizationName,
        capturedAt: new Date("2026-09-03T18:05:00.000Z"),
        sourceRefreshedAt: new Date("2026-09-03T18:04:00.000Z"),
        device,
      },
    ],
    audit: [],
  },
} as RecoveryEvidenceExport;

test("incident CSV includes complete address and cross-street context", () => {
  const csv = renderRecoveryEvidenceCsv(exportData);
  assert.match(csv, /"nearest_address"/);
  assert.match(csv, /"cross_streets"/);
  assert.match(csv, /"cross_streets_source"/);
  assert.match(csv, /"address_precision"/);
  assert.match(csv, /"address_source"/);
  assert.match(csv, /"Main Street & First Avenue"/);
  assert.match(csv, /"ACTION1_RECOVERY_ATTRIBUTE"/);
  const columnCounts = csv
    .split("\r\n")
    .map((line) => line.split('","').length);
  assert.ok(columnCounts.every((count) => count === columnCounts[0]));
});

test("incident print report leads with a concise summary and retains details", () => {
  const html = renderRecoveryEvidencePrintDocument(exportData);
  assert.ok(html.indexOf("Operational summary") < html.indexOf("Detailed captured endpoint evidence"));
  assert.match(html, /Nearest address/);
  assert.match(html, /Cross streets/);
  assert.match(html, /Main Street &amp; First Avenue/);
  assert.match(html, /Source: Action1 recovery attribute/);
  assert.match(html, /Address precision: ADDRESS/);
  assert.match(html, /class="detail-pages"/);
});

test("incident reports clearly label unavailable cross streets", () => {
  const withoutCrossStreets = {
    ...exportData,
    incident: {
      ...exportData.incident,
      evidence: [
        {
          ...exportData.incident.evidence[0],
          device: { ...device, crossStreets: null },
        },
      ],
    },
  };
  assert.match(renderRecoveryEvidenceCsv(withoutCrossStreets), /"NOT_AVAILABLE"/);
  assert.match(
    renderRecoveryEvidencePrintDocument(withoutCrossStreets),
    /No cross streets were reported by Action1/,
  );
});