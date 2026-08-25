import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, lt } from "drizzle-orm";
import {
  db,
  recoveryIncidentAuditTable,
  recoveryLocationObservationsTable,
} from "@workspace/db";
import type { RecoveryDevice } from "./action1-recovery";

const ACTOR_LABEL = "Authorized recovery operator";
const DEFAULT_RETENTION_DAYS = 90;
const MAX_RETENTION_DAYS = 3650;
const MAX_HISTORY_RECORDS = 10000;

export type RecoveryLocationHistoryFormat = "json" | "csv" | "print";
export type RecoveryLocationHistoryScope = "FLEET" | "SELECTED" | "SINGLE";

export interface RecoveryLocationHistoryFilters {
  endpointIds?: string[];
  from?: Date;
  to?: Date;
  scope?: RecoveryLocationHistoryScope;
}

export interface RecoveryLocationObservation {
  id: string;
  endpointId: string;
  deviceId: string | null;
  computerName: string;
  organizationId: string;
  organizationName: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  operatingSystem: string;
  agentVersion: string | null;
  capturedAt: Date;
  sourceRefreshedAt: Date;
  locationObservedAt: Date | null;
  lastSeenAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: string | null;
  locationCoordinates: string | null;
  locationStatus: string | null;
  locationIntegrity: string | null;
  locationQuality: string | null;
  locationSource: string | null;
  positionSource: string | null;
  locationPermission: string | null;
  locationSequence: string | null;
  locationAgeMinutes: string | null;
  locationError: string | null;
  locationSummary: string | null;
  isMapSafe: boolean;
}

export interface RecoveryLocationHistoryExport {
  exportId: string;
  schemaVersion: string;
  generatedAt: Date;
  source: string;
  scope: RecoveryLocationHistoryScope;
  endpointIds: string[];
  from: Date | null;
  to: Date | null;
  observationCount: number;
  observations: RecoveryLocationObservation[];
  limitations: string[];
}

export class RecoveryLocationHistoryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryLocationHistoryInputError";
  }
}

function getRetentionDays(): number {
  const configured = Number(process.env["RECOVERY_LOCATION_HISTORY_RETENTION_DAYS"]);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }
  return Math.min(Math.floor(configured), MAX_RETENTION_DAYS);
}

export function parseAction1Timestamp(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const action1Match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/,
  );
  const normalized = action1Match
    ? `${action1Match[1]}-${action1Match[2]}-${action1Match[3]}T${action1Match[4]}:${action1Match[5]}:${action1Match[6]}Z`
    : value;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function createRecoveryObservationKey(
  device: RecoveryDevice,
  sourceRefreshedAt: Date,
): string {
  const source = [
    device.endpointId,
    device.deviceId ?? "",
    sourceRefreshedAt.toISOString(),
    device.locationUpdated ?? "",
    device.latitude ?? "",
    device.longitude ?? "",
    device.locationStatus ?? "",
    device.locationIntegrity ?? "",
    device.locationSequence ?? "",
  ].join("\u001f");
  return createHash("sha256").update(source).digest("hex");
}

function toObservation(
  row: typeof recoveryLocationObservationsTable.$inferSelect,
): RecoveryLocationObservation {
  return {
    id: row.id,
    endpointId: row.endpointId,
    deviceId: row.deviceId,
    computerName: row.computerName,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    serialNumber: row.serialNumber,
    manufacturer: row.manufacturer,
    model: row.model,
    operatingSystem: row.operatingSystem,
    agentVersion: row.agentVersion,
    capturedAt: row.capturedAt,
    sourceRefreshedAt: row.sourceRefreshedAt,
    locationObservedAt: row.locationObservedAt,
    lastSeenAt: row.lastSeenAt,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    locationCoordinates: row.locationCoordinates,
    locationStatus: row.locationStatus,
    locationIntegrity: row.locationIntegrity,
    locationQuality: row.locationQuality,
    locationSource: row.locationSource,
    positionSource: row.positionSource,
    locationPermission: row.locationPermission,
    locationSequence: row.locationSequence,
    locationAgeMinutes: row.locationAgeMinutes,
    locationError: row.locationError,
    locationSummary: row.locationSummary,
    isMapSafe: row.isMapSafe,
  };
}

export async function recordRecoverySnapshot(snapshot: {
  devices: RecoveryDevice[];
  refreshedAt: string;
  source: string;
}): Promise<void> {
  const sourceRefreshedAt = new Date(snapshot.refreshedAt);
  if (!Number.isFinite(sourceRefreshedAt.getTime())) {
    throw new RecoveryLocationHistoryInputError(
      "The recovery snapshot has an invalid refresh timestamp.",
    );
  }
  if (snapshot.devices.length === 0) {
    return;
  }

  await db
    .insert(recoveryLocationObservationsTable)
    .values(
      snapshot.devices.map((device) => ({
        observationKey: createRecoveryObservationKey(device, sourceRefreshedAt),
        endpointId: device.endpointId,
        deviceId: device.deviceId,
        computerName: device.computerName,
        organizationId: device.organizationId,
        organizationName: device.organizationName,
        serialNumber: device.serialNumber,
        manufacturer: device.manufacturer,
        model: device.model,
        operatingSystem: device.operatingSystem,
        agentVersion: device.agentVersion,
        source: snapshot.source,
        sourceRefreshedAt,
        locationObservedAt: parseAction1Timestamp(device.locationUpdated),
        lastSeenAt: parseAction1Timestamp(device.lastSeen),
        latitude: device.latitude,
        longitude: device.longitude,
        accuracy: device.accuracy,
        locationCoordinates: device.locationCoordinates,
        locationStatus: device.locationStatus,
        locationIntegrity: device.locationIntegrity,
        locationQuality: device.locationQuality,
        locationSource: device.locationSource,
        positionSource: device.positionSource,
        locationPermission: device.locationPermission,
        locationSequence: device.locationSequence,
        locationAgeMinutes: device.locationAgeMinutes,
        locationError: device.locationError,
        locationSummary: device.locationSummary,
        isMapSafe: device.isMapSafe,
        deviceSnapshot: device,
      })),
    )
    .onConflictDoNothing({
      target: recoveryLocationObservationsTable.observationKey,
    });

  const cutoff = new Date(Date.now() - getRetentionDays() * 24 * 60 * 60 * 1000);
  await db
    .delete(recoveryLocationObservationsTable)
    .where(lt(recoveryLocationObservationsTable.capturedAt, cutoff));
}

export async function listRecoveryLocationHistory(
  filters: RecoveryLocationHistoryFilters,
): Promise<RecoveryLocationObservation[]> {
  if (
    filters.from &&
    filters.to &&
    filters.from.getTime() > filters.to.getTime()
  ) {
    throw new RecoveryLocationHistoryInputError(
      "The start of the date range must be before the end.",
    );
  }
  const endpointIds = [...new Set(filters.endpointIds?.filter(Boolean) ?? [])];
  const conditions = [
    endpointIds.length > 0
      ? inArray(recoveryLocationObservationsTable.endpointId, endpointIds)
      : undefined,
    filters.from
      ? gte(recoveryLocationObservationsTable.sourceRefreshedAt, filters.from)
      : undefined,
    filters.to
      ? lte(recoveryLocationObservationsTable.sourceRefreshedAt, filters.to)
      : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(recoveryLocationObservationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(recoveryLocationObservationsTable.sourceRefreshedAt))
    .limit(MAX_HISTORY_RECORDS + 1);
  if (rows.length > MAX_HISTORY_RECORDS) {
    throw new RecoveryLocationHistoryInputError(
      "This history request is too large. Narrow the date range or endpoint selection.",
    );
  }
  return rows.map(toObservation);
}

export async function createRecoveryLocationHistoryExport(
  filters: RecoveryLocationHistoryFilters,
): Promise<RecoveryLocationHistoryExport> {
  const observations = await listRecoveryLocationHistory(filters);
  const endpointIds = [...new Set(filters.endpointIds?.filter(Boolean) ?? [])];
  const exportId = randomUUID();
  const scope =
    filters.scope ??
    (endpointIds.length === 0
      ? "FLEET"
      : endpointIds.length === 1
        ? "SINGLE"
        : "SELECTED");
  await db.insert(recoveryIncidentAuditTable).values({
    eventType: "LOCATION_HISTORY_EXPORTED",
    actorLabel: ACTOR_LABEL,
    summary: `Generated ${scope.toLowerCase()} location history export ${exportId} with ${observations.length} observation${observations.length === 1 ? "" : "s"}.`,
    metadata: {
      exportId,
      scope,
      endpointIds,
      from: filters.from?.toISOString() ?? null,
      to: filters.to?.toISOString() ?? null,
      observationCount: observations.length,
    },
  });
  return {
    exportId,
    schemaVersion: "les-recovery-location-history/v1",
    generatedAt: new Date(),
    source:
      "Action1 recovery observations captured by this console after history collection was enabled; this export does not represent live device tracking.",
    scope,
    endpointIds,
    from: filters.from ?? null,
    to: filters.to ?? null,
    observationCount: observations.length,
    observations,
    limitations: [
      `History retention is ${getRetentionDays()} days from capture time. Records before history collection was enabled do not exist.`,
      "Coordinates are last-known observations from Action1, not live tracking data. Powered-off or disconnected devices cannot report a new location.",
      "Action1 endpoint ID is the canonical management identifier. Device ID and hardware fields are included only when Action1 reported them for that observation.",
      "Computer names can be reused or duplicated; do not use a computer name alone as proof of physical device identity.",
      "This export contains no provider credentials, recovery secrets, or agent HMAC material and is for authorized company-owned device recovery only.",
    ],
  };
}

function csvCell(value: unknown): string {
  const rawText =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  const text = rawText.replace(/\r?\n/g, " ");
  const spreadsheetSafeText =
    /^[=+\-@]/.test(text) || /^[\u0000-\u001f]/.test(text)
      ? `'${text}`
      : text;
  return `"${spreadsheetSafeText.replaceAll('"', '""')}"`;
}

export function renderRecoveryLocationHistoryCsv(
  exportData: RecoveryLocationHistoryExport,
): string {
  const header = [
    "export_id",
    "generated_at_utc",
    "scope",
    "endpoint_id",
    "device_id",
    "computer_name",
    "serial_number",
    "manufacturer",
    "model",
    "organization_id",
    "organization_name",
    "operating_system",
    "agent_version",
    "captured_at_utc",
    "source_refreshed_at_utc",
    "location_observed_at_utc",
    "last_seen_at_utc",
    "latitude",
    "longitude",
    "accuracy",
    "location_status",
    "location_integrity",
    "location_source",
    "position_source",
    "location_sequence",
    "evidence_limitations",
  ];
  const limitations = exportData.limitations.join(" | ");
  const rows = exportData.observations.map((observation) =>
    [
      exportData.exportId,
      exportData.generatedAt,
      exportData.scope,
      observation.endpointId,
      observation.deviceId,
      observation.computerName,
      observation.serialNumber,
      observation.manufacturer,
      observation.model,
      observation.organizationId,
      observation.organizationName,
      observation.operatingSystem,
      observation.agentVersion,
      observation.capturedAt,
      observation.sourceRefreshedAt,
      observation.locationObservedAt,
      observation.lastSeenAt,
      observation.latitude,
      observation.longitude,
      observation.accuracy,
      observation.locationStatus,
      observation.locationIntegrity,
      observation.locationSource,
      observation.positionSource,
      observation.locationSequence,
      limitations,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderRecoveryLocationHistoryPrintDocument(
  exportData: RecoveryLocationHistoryExport,
): string {
  const rows = exportData.observations
    .map(
      (observation) => `<tr>
        <td>${escapeHtml(observation.computerName)}<br><small>Endpoint: ${escapeHtml(observation.endpointId)}<br>Device ID: ${escapeHtml(observation.deviceId ?? "Not reported")}</small></td>
        <td>${escapeHtml(observation.serialNumber ?? "Not reported")}<br><small>${escapeHtml(observation.manufacturer ?? "")} ${escapeHtml(observation.model ?? "")}</small></td>
        <td>${escapeHtml(observation.locationCoordinates ?? "Unavailable")}<br><small>${escapeHtml(observation.accuracy ?? "Accuracy unavailable")}</small></td>
        <td>${escapeHtml(observation.locationStatus ?? "Unavailable")}<br><small>Integrity: ${escapeHtml(observation.locationIntegrity ?? "Unknown")}</small></td>
        <td>${escapeHtml(observation.locationObservedAt?.toISOString() ?? observation.sourceRefreshedAt.toISOString())}<br><small>Captured: ${escapeHtml(observation.capturedAt.toISOString())}</small></td>
      </tr>`,
    )
    .join("");
  const limitations = exportData.limitations
    .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>LES location history export ${escapeHtml(exportData.exportId)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
      h1 { margin-bottom: 4px; } .meta { color: #4b5563; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: .08em; }
      small { color: #4b5563; } footer { margin-top: 28px; font-size: 11px; color: #4b5563; }
      @media print { body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <h1>LES Location History Export</h1>
    <p class="meta">Export ID: ${escapeHtml(exportData.exportId)} · Generated UTC: ${escapeHtml(exportData.generatedAt.toISOString())} · Scope: ${escapeHtml(exportData.scope)} · Observations: ${exportData.observationCount}</p>
    <table>
      <thead><tr><th>Endpoint identity</th><th>Hardware identity</th><th>Last-known location</th><th>Status</th><th>Observation time</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No observations match this selection.</td></tr>'}</tbody>
    </table>
    <h2>Limitations</h2><ul>${limitations}</ul>
    <footer>${escapeHtml(exportData.source)}<br>Schema: ${escapeHtml(exportData.schemaVersion)}</footer>
  </body>
</html>`;
}