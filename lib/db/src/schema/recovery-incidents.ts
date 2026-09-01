import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recoveryIncidentsTable = pgTable(
  "recovery_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    caseNumber: text("case_number"),
    owner: text("owner"),
    status: text("status").notNull().default("OPEN"),
    reportedAt: timestamp("reported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recovery_incidents_status_idx").on(table.status),
    index("recovery_incidents_reported_at_idx").on(table.reportedAt),
  ],
);

export const recoveryIncidentEndpointsTable = pgTable(
  "recovery_incident_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => recoveryIncidentsTable.id),
    endpointId: text("endpoint_id").notNull(),
    organizationId: text("organization_id").notNull(),
    organizationName: text("organization_name").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceRefreshedAt: timestamp("source_refreshed_at", {
      withTimezone: true,
    }).notNull(),
    deviceSnapshot: jsonb("device_snapshot").notNull(),
  },
  (table) => [
    index("recovery_incident_endpoints_incident_idx").on(table.incidentId),
    index("recovery_incident_endpoints_endpoint_idx").on(table.endpointId),
    uniqueIndex("recovery_incident_endpoints_unique").on(
      table.incidentId,
      table.endpointId,
    ),
  ],
);

export const recoveryIncidentAuditTable = pgTable(
  "recovery_incident_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id").references(() => recoveryIncidentsTable.id),
    endpointId: text("endpoint_id"),
    eventType: text("event_type").notNull(),
    actorLabel: text("actor_label").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("recovery_incident_audit_incident_at_idx").on(
      table.incidentId,
      table.occurredAt,
    ),
  ],
);

export const recoveryLocationObservationsTable = pgTable(
  "recovery_location_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    observationKey: text("observation_key").notNull(),
    endpointId: text("endpoint_id").notNull(),
    deviceId: text("device_id"),
    computerName: text("computer_name").notNull(),
    organizationId: text("organization_id").notNull(),
    organizationName: text("organization_name").notNull(),
    serialNumber: text("serial_number"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    operatingSystem: text("operating_system").notNull(),
    agentVersion: text("agent_version"),
    source: text("source").notNull().default("Action1"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceRefreshedAt: timestamp("source_refreshed_at", {
      withTimezone: true,
    }).notNull(),
    locationObservedAt: timestamp("location_observed_at", {
      withTimezone: true,
    }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracy: text("accuracy"),
    streetAddress: text("street_address"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    addressSource: text("address_source"),
    nearestAddress: text("nearest_address"),
    crossStreets: text("cross_streets"),
    addressPrecision: text("address_precision"),
    locationCoordinates: text("location_coordinates"),
    locationStatus: text("location_status"),
    locationIntegrity: text("location_integrity"),
    locationQuality: text("location_quality"),
    locationSource: text("location_source"),
    positionSource: text("position_source"),
    locationPermission: text("location_permission"),
    locationSequence: text("location_sequence"),
    locationAgeMinutes: text("location_age_minutes"),
    locationError: text("location_error"),
    locationSummary: text("location_summary"),
    isMapSafe: boolean("is_map_safe").notNull().default(false),
    deviceSnapshot: jsonb("device_snapshot").notNull(),
  },
  (table) => [
    uniqueIndex("recovery_location_observations_key_unique").on(
      table.observationKey,
    ),
    index("recovery_location_observations_endpoint_at_idx").on(
      table.endpointId,
      table.sourceRefreshedAt,
    ),
    index("recovery_location_observations_captured_at_idx").on(table.capturedAt),
    index("recovery_location_observations_device_id_idx").on(table.deviceId),
  ],
);

export const insertRecoveryIncidentSchema = createInsertSchema(
  recoveryIncidentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRecoveryIncident = z.infer<
  typeof insertRecoveryIncidentSchema
>;
export type RecoveryIncident = typeof recoveryIncidentsTable.$inferSelect;
export type RecoveryIncidentEndpoint =
  typeof recoveryIncidentEndpointsTable.$inferSelect;
export type RecoveryIncidentAudit = typeof recoveryIncidentAuditTable.$inferSelect;
export type RecoveryLocationObservation =
  typeof recoveryLocationObservationsTable.$inferSelect;