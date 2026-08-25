import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  recoveryIncidentAuditTable,
  recoveryIncidentEndpointsTable,
  recoveryIncidentsTable,
  type RecoveryIncident,
} from "@workspace/db";
import type {
  RecoveryIncidentDetail,
  RecoveryIncidentInput,
  RecoveryIncidentUpdate,
} from "@workspace/api-zod";
import type { RecoveryDevice } from "./action1-recovery";

const ACTOR_LABEL = "Authorized recovery operator";
const INCIDENT_STATUSES = new Set(["OPEN", "ESCALATED", "RECOVERED", "CLOSED"]);

export class RecoveryIncidentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryIncidentInputError";
  }
}

export type RecoveryExportFormat = "json" | "csv" | "print";

export interface RecoveryEvidenceExport {
  exportId: string;
  generatedAt: Date;
  incident: RecoveryIncidentDetail;
  limitations: string[];
  schemaVersion: string;
  source: string;
}

function normalizedOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toIncidentSummary(
  incident: RecoveryIncident,
  endpointCount: number,
): RecoveryIncidentDetail extends infer Summary ? Omit<Summary, "evidence" | "audit"> : never {
  if (!INCIDENT_STATUSES.has(incident.status)) {
    throw new RecoveryIncidentInputError("Stored incident has an unsupported status.");
  }
  return {
    id: incident.id,
    title: incident.title,
    caseNumber: incident.caseNumber,
    owner: incident.owner,
    status: incident.status as "OPEN" | "ESCALATED" | "RECOVERED" | "CLOSED",
    reportedAt: incident.reportedAt,
    resolvedAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    endpointCount,
  };
}

async function getEndpointCounts(incidentIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (incidentIds.length === 0) {
    return counts;
  }
  const rows = await db
    .select({
      incidentId: recoveryIncidentEndpointsTable.incidentId,
    })
    .from(recoveryIncidentEndpointsTable)
    .where(inArray(recoveryIncidentEndpointsTable.incidentId, incidentIds));
  for (const row of rows) {
    counts.set(row.incidentId, (counts.get(row.incidentId) ?? 0) + 1);
  }
  return counts;
}

function toAuditRecord(row: typeof recoveryIncidentAuditTable.$inferSelect) {
  return {
    id: row.id,
    eventType: row.eventType,
    actorLabel: row.actorLabel,
    summary: row.summary,
    endpointId: row.endpointId,
    occurredAt: row.occurredAt,
  };
}

export async function listRecoveryIncidents() {
  const incidents = await db
    .select()
    .from(recoveryIncidentsTable)
    .orderBy(desc(recoveryIncidentsTable.updatedAt));
  const counts = await getEndpointCounts(incidents.map((incident) => incident.id));
  return {
    incidents: incidents.map((incident) =>
      toIncidentSummary(incident, counts.get(incident.id) ?? 0),
    ),
  };
}

export async function getRecoveryIncidentDetail(
  incidentId: string,
): Promise<RecoveryIncidentDetail | null> {
  const [incident] = await db
    .select()
    .from(recoveryIncidentsTable)
    .where(eq(recoveryIncidentsTable.id, incidentId));
  if (!incident) {
    return null;
  }

  const [endpointRows, auditRows] = await Promise.all([
    db
      .select()
      .from(recoveryIncidentEndpointsTable)
      .where(eq(recoveryIncidentEndpointsTable.incidentId, incidentId))
      .orderBy(recoveryIncidentEndpointsTable.capturedAt),
    db
      .select()
      .from(recoveryIncidentAuditTable)
      .where(eq(recoveryIncidentAuditTable.incidentId, incidentId))
      .orderBy(desc(recoveryIncidentAuditTable.occurredAt)),
  ]);

  return {
    ...toIncidentSummary(incident, endpointRows.length),
    evidence: endpointRows.map((row) => ({
      endpointId: row.endpointId,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      capturedAt: row.capturedAt,
      sourceRefreshedAt: row.sourceRefreshedAt,
      device: row.deviceSnapshot as RecoveryDevice,
    })),
    audit: auditRows.map(toAuditRecord),
  };
}

export async function createRecoveryIncident(
  input: RecoveryIncidentInput,
  snapshot: { devices: RecoveryDevice[]; refreshedAt: string; source: string },
): Promise<RecoveryIncidentDetail> {
  const title = input.title.trim();
  const normalizedEndpointIds = input.endpointIds.map((id) => id.trim());
  if (title.length < 3 || normalizedEndpointIds.some((id) => id.length === 0)) {
    throw new RecoveryIncidentInputError(
      "Provide an incident title and at least one valid endpoint identifier.",
    );
  }
  const endpointIds = [...new Set(normalizedEndpointIds)];
  const requestedDevices = endpointIds.map((endpointId) =>
    snapshot.devices.find((device) => device.endpointId === endpointId),
  );
  if (requestedDevices.some((device) => !device)) {
    throw new RecoveryIncidentInputError(
      "One or more selected endpoints are no longer available from Action1. Refresh the fleet list and try again.",
    );
  }

  const capturedDevices = requestedDevices as RecoveryDevice[];
  const sourceRefreshedAt = new Date(snapshot.refreshedAt);
  if (!Number.isFinite(sourceRefreshedAt.getTime())) {
    throw new RecoveryIncidentInputError(
      "Action1 returned an invalid evidence refresh timestamp.",
    );
  }

  const incidentId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(recoveryIncidentsTable)
      .values({
        title,
        caseNumber: normalizedOptionalText(input.caseNumber),
        owner: normalizedOptionalText(input.owner),
        status: "OPEN",
        reportedAt: input.reportedAt ?? new Date(),
      })
      .returning({ id: recoveryIncidentsTable.id });

    await tx.insert(recoveryIncidentEndpointsTable).values(
      capturedDevices.map((device) => ({
        incidentId: created.id,
        endpointId: device.endpointId,
        organizationId: device.organizationId,
        organizationName: device.organizationName,
        sourceRefreshedAt,
        deviceSnapshot: device,
      })),
    );
    await tx.insert(recoveryIncidentAuditTable).values([
      {
        incidentId: created.id,
        eventType: "INCIDENT_CREATED",
        actorLabel: ACTOR_LABEL,
        summary: `Opened incident with ${capturedDevices.length} captured endpoint${capturedDevices.length === 1 ? "" : "s"}.`,
        metadata: {
          endpointCount: capturedDevices.length,
          source: snapshot.source,
          sourceRefreshedAt: snapshot.refreshedAt,
        },
      },
      ...(normalizedOptionalText(input.note)
        ? [
            {
              incidentId: created.id,
              eventType: "NOTE_ADDED",
              actorLabel: ACTOR_LABEL,
              summary: normalizedOptionalText(input.note) as string,
              metadata: {},
            },
          ]
        : []),
    ]);
    return created.id;
  });

  const detail = await getRecoveryIncidentDetail(incidentId);
  if (!detail) {
    throw new Error("Created recovery incident could not be reloaded.");
  }
  return detail;
}

export async function updateRecoveryIncident(
  incidentId: string,
  input: RecoveryIncidentUpdate,
): Promise<RecoveryIncidentDetail | null> {
  const [existing] = await db
    .select()
    .from(recoveryIncidentsTable)
    .where(eq(recoveryIncidentsTable.id, incidentId));
  if (!existing) {
    return null;
  }

  const normalizedTitle = input.title?.trim();
  const normalizedNote = input.note?.trim();
  if (input.title !== undefined && (!normalizedTitle || normalizedTitle.length < 3)) {
    throw new RecoveryIncidentInputError(
      "Incident titles must contain at least three non-space characters.",
    );
  }
  if (input.note !== undefined && !normalizedNote) {
    throw new RecoveryIncidentInputError("Audit notes must contain non-space text.");
  }

  const changes: string[] = [];
  const statusChanged = input.status && input.status !== existing.status;
  const nextStatus = input.status ?? existing.status;
  const values: Partial<typeof recoveryIncidentsTable.$inferInsert> = {};
  if (normalizedTitle !== undefined && normalizedTitle !== existing.title) {
    values.title = normalizedTitle;
    changes.push("title");
  }
  if (input.caseNumber !== undefined && normalizedOptionalText(input.caseNumber) !== existing.caseNumber) {
    values.caseNumber = normalizedOptionalText(input.caseNumber);
    changes.push("case number");
  }
  if (input.owner !== undefined && normalizedOptionalText(input.owner) !== existing.owner) {
    values.owner = normalizedOptionalText(input.owner);
    changes.push("owner");
  }
  if (statusChanged) {
    values.status = nextStatus;
    values.resolvedAt =
      nextStatus === "RECOVERED" || nextStatus === "CLOSED" ? new Date() : null;
    changes.push(`status to ${nextStatus}`);
  }

  await db.transaction(async (tx) => {
    if (Object.keys(values).length > 0) {
      await tx
        .update(recoveryIncidentsTable)
        .set(values)
        .where(eq(recoveryIncidentsTable.id, incidentId));
      await tx.insert(recoveryIncidentAuditTable).values({
        incidentId,
        eventType: statusChanged ? "STATUS_CHANGED" : "INCIDENT_UPDATED",
        actorLabel: ACTOR_LABEL,
        summary: `Updated ${changes.join(", ")}.`,
        metadata: { changes },
      });
    }
    if (normalizedNote) {
      await tx.insert(recoveryIncidentAuditTable).values({
        incidentId,
        eventType: "NOTE_ADDED",
        actorLabel: ACTOR_LABEL,
        summary: normalizedNote,
        metadata: {},
      });
    }
  });

  return getRecoveryIncidentDetail(incidentId);
}

export async function createRecoveryEvidenceExport(
  incidentId: string,
): Promise<RecoveryEvidenceExport | null> {
  const existingIncident = await getRecoveryIncidentDetail(incidentId);
  if (!existingIncident) {
    return null;
  }
  const exportId = randomUUID();
  await db.insert(recoveryIncidentAuditTable).values({
    incidentId,
    eventType: "EVIDENCE_EXPORTED",
    actorLabel: ACTOR_LABEL,
    summary: `Generated evidence export ${exportId}.`,
    metadata: { exportId },
  });
  const incident = await getRecoveryIncidentDetail(incidentId);
  if (!incident) {
    return null;
  }
  return {
    exportId,
    schemaVersion: "les-recovery-evidence/v1",
    generatedAt: new Date(),
    source:
      "Action1 endpoint recovery attributes captured at incident creation; this export does not represent a live device location.",
    incident,
    limitations: [
      "Location coordinates are last-known observations captured when this incident was opened, not live tracking data.",
      "A stale, invalid, legacy, unavailable, or unverifiable status must be considered before relying on any location field.",
      "Action1 remains the endpoint system of record. This packet contains no provider credentials, recovery secrets, or agent HMAC material.",
      "Use only for authorized company-owned device recovery and follow the organization’s incident and legal procedures.",
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

export function renderRecoveryEvidenceCsv(exportData: RecoveryEvidenceExport): string {
  const header = [
    "export_id",
    "generated_at_utc",
    "incident_id",
    "incident_title",
    "case_number",
    "incident_status",
    "endpoint_id",
    "device_id",
    "computer_name",
    "serial_number",
    "manufacturer",
    "model",
    "organization",
    "captured_at_utc",
    "source_refreshed_at_utc",
    "last_seen",
    "location_updated",
    "location_coordinates",
    "accuracy",
    "location_status",
    "location_integrity",
    "agent_health",
    "agent_version",
    "evidence_limitations",
  ];
  const limitations = exportData.limitations.join(" | ");
  const rows = exportData.incident.evidence.map((evidence) => {
    const device = evidence.device;
    return [
      exportData.exportId,
      exportData.generatedAt,
      exportData.incident.id,
      exportData.incident.title,
      exportData.incident.caseNumber,
      exportData.incident.status,
      evidence.endpointId,
      device.deviceId,
      device.computerName,
      device.serialNumber,
      device.manufacturer,
      device.model,
      evidence.organizationName,
      evidence.capturedAt,
      evidence.sourceRefreshedAt,
      device.lastSeen,
      device.locationUpdated,
      device.locationCoordinates,
      device.accuracy,
      device.locationStatus,
      device.locationIntegrity,
      device.agentHealth,
      device.agentVersion,
      limitations,
    ]
      .map(csvCell)
      .join(",");
  });
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

export function renderRecoveryEvidencePrintDocument(
  exportData: RecoveryEvidenceExport,
): string {
  const incident = exportData.incident;
  const evidenceRows = incident.evidence
    .map(({ device, capturedAt, sourceRefreshedAt }) => {
      return `<tr>
        <td>${escapeHtml(device.computerName)}<br><small>Endpoint: ${escapeHtml(device.endpointId)}<br>Device ID: ${escapeHtml(device.deviceId ?? "Not reported")}</small></td>
        <td>${escapeHtml(device.organizationName)}</td>
        <td>${escapeHtml(device.locationCoordinates || "Unavailable")}<br><small>${escapeHtml(device.accuracy || "Accuracy unavailable")}</small></td>
        <td>${escapeHtml(device.locationStatus || "Unavailable")}<br><small>Integrity: ${escapeHtml(device.locationIntegrity || "Unknown")}</small></td>
        <td>${escapeHtml(capturedAt.toISOString())}<br><small>Action1 refreshed: ${escapeHtml(sourceRefreshedAt.toISOString())}</small></td>
      </tr>`;
    })
    .join("");
  const auditRows = incident.audit
    .map(
      (record) =>
        `<li><strong>${escapeHtml(record.occurredAt.toISOString())}</strong> — ${escapeHtml(record.eventType)}: ${escapeHtml(record.summary)}</li>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>LES Recovery Evidence — ${escapeHtml(incident.title)}</title>
    <style>
      @page { size: auto; margin: 18mm; }
      body { color: #18212f; font: 12px/1.45 Arial, sans-serif; }
      h1, h2 { color: #0c3b5e; } h1 { font-size: 24px; margin: 0 0 6px; }
      h2 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #b8c8d5; padding-bottom: 5px; }
      .banner { background: #f8edcf; border-left: 4px solid #9a6700; padding: 10px 12px; margin: 18px 0; }
      .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .meta div { padding: 8px; background: #f4f7f9; border: 1px solid #d9e2e8; }
      .label { color: #52616f; display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th, td { border: 1px solid #cbd5df; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #eaf1f5; font-size: 10px; text-transform: uppercase; }
      small { color: #52616f; } ul { padding-left: 20px; } li { margin-bottom: 5px; }
      footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #cbd5df; color: #52616f; font-size: 10px; }
    </style>
  </head>
  <body>
    <h1>Recovery Evidence Packet</h1>
    <p>For authorized company-owned device recovery only. Export ID: <strong>${escapeHtml(exportData.exportId)}</strong></p>
    <div class="banner"><strong>Last-known evidence only.</strong> This packet is not proof of a live device location. Review freshness, integrity, and limitation labels before operational use.</div>
    <div class="meta">
      <div><span class="label">Incident</span>${escapeHtml(incident.title)}</div>
      <div><span class="label">Case / reference</span>${escapeHtml(incident.caseNumber || "Not recorded")}</div>
      <div><span class="label">Status / owner</span>${escapeHtml(incident.status)} / ${escapeHtml(incident.owner || "Unassigned")}</div>
      <div><span class="label">Reported / generated UTC</span>${escapeHtml(incident.reportedAt.toISOString())}<br>${escapeHtml(exportData.generatedAt.toISOString())}</div>
    </div>
    <h2>Captured endpoint evidence</h2>
    <table><thead><tr><th>Endpoint</th><th>Organization</th><th>Last-known location</th><th>Recovery assessment</th><th>Observation context</th></tr></thead>
      <tbody>${evidenceRows || "<tr><td colspan=\"5\">No captured endpoints.</td></tr>"}</tbody></table>
    <h2>Audit history</h2><ul>${auditRows || "<li>No audit entries available.</li>"}</ul>
    <h2>Limitations and provenance</h2><ul>${exportData.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <footer>Source: ${escapeHtml(exportData.source)}<br>Schema: ${escapeHtml(exportData.schemaVersion)}</footer>
  </body>
</html>`;
}