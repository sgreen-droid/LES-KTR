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
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  addressSource: string | null;
  nearestAddress: string | null;
  crossStreets: string | null;
  addressPrecision: string | null;
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

export type RecoveryLocationMovementAssessment =
  | "FIRST_COORDINATE"
  | "NO_MATERIAL_CHANGE"
  | "COORDINATE_CHANGE";

export interface RecoveryLocationMovement {
  priorObservationId: string;
  priorObservationAt: Date;
  distanceMeters: number;
  elapsedMinutes: number | null;
  apparentSpeedKmh: number | null;
  assessment: RecoveryLocationMovementAssessment;
}

export interface RecoveryLocationExportObservation
  extends RecoveryLocationObservation {
  observationNumber: number;
  observationTimeBasis:
    | "ENDPOINT_LOCATION_OBSERVED_AT"
    | "ACTION1_SOURCE_REFRESHED_AT";
  movementFromPrevious: RecoveryLocationMovement | null;
}

export interface RecoveryLocationEndpointSummary {
  endpointId: string;
  deviceId: string | null;
  computerNames: string[];
  organizationName: string;
  observationCount: number;
  coordinateObservationCount: number;
  firstObservationAt: Date | null;
  lastObservationAt: Date | null;
  firstCoordinate: string | null;
  lastCoordinate: string | null;
  apparentDistanceMeters: number;
  movementSegmentCount: number;
  maxApparentSpeedKmh: number | null;
  locationStatuses: string[];
  integrityStates: string[];
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  nearestAddress: string | null;
  crossStreets: string | null;
}

export interface RecoveryLocationHistoryCoverage {
  endpointCount: number;
  endpointsWithCoordinates: number;
  observationCount: number;
  coordinateObservationCount: number;
  movementSegmentCount: number;
  firstObservationAt: Date | null;
  lastObservationAt: Date | null;
  totalApparentDistanceMeters: number;
  endpointSummaries: RecoveryLocationEndpointSummary[];
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
  observationOrdering: "GROUPED_BY_ENDPOINT_THEN_CHRONOLOGICAL_ASCENDING";
  coverage: RecoveryLocationHistoryCoverage;
  observations: RecoveryLocationExportObservation[];
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
    streetAddress: row.streetAddress,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    addressSource: row.addressSource,
    nearestAddress: row.nearestAddress,
    crossStreets: row.crossStreets,
    addressPrecision: row.addressPrecision,
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

function observationTime(observation: RecoveryLocationObservation): {
  value: Date;
  basis: RecoveryLocationExportObservation["observationTimeBasis"];
} {
  if (observation.locationObservedAt) {
    return {
      value: observation.locationObservedAt,
      basis: "ENDPOINT_LOCATION_OBSERVED_AT",
    };
  }
  return {
    value: observation.sourceRefreshedAt,
    basis: "ACTION1_SOURCE_REFRESHED_AT",
  };
}

function hasValidCoordinates(
  observation: RecoveryLocationObservation,
): boolean {
  return (
    observation.latitude !== null &&
    observation.longitude !== null &&
    Number.isFinite(observation.latitude) &&
    Number.isFinite(observation.longitude) &&
    observation.latitude >= -90 &&
    observation.latitude <= 90 &&
    observation.longitude >= -180 &&
    observation.longitude <= 180
  );
}

function coordinateText(
  observation: Pick<
    RecoveryLocationObservation,
    "latitude" | "longitude" | "locationCoordinates"
  >,
): string | null {
  if (observation.locationCoordinates) {
    return observation.locationCoordinates;
  }
  if (observation.latitude === null || observation.longitude === null) {
    return null;
  }
  return `${observation.latitude},${observation.longitude}`;
}

function haversineDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function latestNonEmpty(
  observations: RecoveryLocationObservation[],
  read: (observation: RecoveryLocationObservation) => string | null,
): string | null {
  return [...observations].reverse().map(read).find(Boolean) ?? null;
}

export function buildRecoveryLocationHistoryAnalysis(
  observations: RecoveryLocationObservation[],
): {
  observations: RecoveryLocationExportObservation[];
  endpointSummaries: RecoveryLocationEndpointSummary[];
  totalApparentDistanceMeters: number;
  movementSegmentCount: number;
  firstObservationAt: Date | null;
  lastObservationAt: Date | null;
} {
  const sorted = [...observations].sort((left, right) => {
    const timeDifference =
      observationTime(left).value.getTime() -
      observationTime(right).value.getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
  const byEndpoint = new Map<string, RecoveryLocationObservation[]>();
  for (const observation of sorted) {
    const endpointObservations = byEndpoint.get(observation.endpointId) ?? [];
    endpointObservations.push(observation);
    byEndpoint.set(observation.endpointId, endpointObservations);
  }

  const enriched: RecoveryLocationExportObservation[] = [];
  const endpointSummaries: RecoveryLocationEndpointSummary[] = [];
  let totalApparentDistanceMeters = 0;
  let movementSegmentCount = 0;

  for (const endpointObservations of byEndpoint.values()) {
    let priorCoordinateObservation: RecoveryLocationObservation | null = null;
    let apparentDistanceMeters = 0;
    let endpointMovementSegmentCount = 0;
    let maxApparentSpeedKmh: number | null = null;
    const endpointExportObservations: RecoveryLocationExportObservation[] = [];

    endpointObservations.forEach((observation, index) => {
      const currentTime = observationTime(observation);
      let movementFromPrevious: RecoveryLocationMovement | null = null;
      if (hasValidCoordinates(observation) && priorCoordinateObservation) {
        const priorTime = observationTime(priorCoordinateObservation);
        const distanceMeters = haversineDistanceMeters(
          priorCoordinateObservation.latitude as number,
          priorCoordinateObservation.longitude as number,
          observation.latitude as number,
          observation.longitude as number,
        );
        const elapsedMinutes = Math.max(
          0,
          (currentTime.value.getTime() - priorTime.value.getTime()) / 60_000,
        );
        const apparentSpeedKmh =
          elapsedMinutes > 0
            ? (distanceMeters / 1000 / elapsedMinutes) * 60
            : null;
        movementFromPrevious = {
          priorObservationId: priorCoordinateObservation.id,
          priorObservationAt: priorTime.value,
          distanceMeters: Number(distanceMeters.toFixed(3)),
          elapsedMinutes: Number(elapsedMinutes.toFixed(3)),
          apparentSpeedKmh:
            apparentSpeedKmh === null
              ? null
              : Number(apparentSpeedKmh.toFixed(3)),
          assessment:
            distanceMeters <= 25 ? "NO_MATERIAL_CHANGE" : "COORDINATE_CHANGE",
        };
        apparentDistanceMeters += distanceMeters;
        endpointMovementSegmentCount += 1;
        maxApparentSpeedKmh =
          apparentSpeedKmh === null
            ? maxApparentSpeedKmh
            : Math.max(maxApparentSpeedKmh ?? 0, apparentSpeedKmh);
      } else if (hasValidCoordinates(observation)) {
        movementFromPrevious = null;
      }

      const exportObservation: RecoveryLocationExportObservation = {
        ...observation,
        observationNumber: index + 1,
        observationTimeBasis: currentTime.basis,
        movementFromPrevious,
      };
      endpointExportObservations.push(exportObservation);
      enriched.push(exportObservation);
      if (hasValidCoordinates(observation)) {
        priorCoordinateObservation = observation;
      }
    });

    const first = endpointObservations[0];
    const last = endpointObservations[endpointObservations.length - 1];
    endpointSummaries.push({
      endpointId: first.endpointId,
      deviceId:
        endpointObservations.find((observation) => observation.deviceId)
          ?.deviceId ?? null,
      computerNames: uniqueNonEmpty(
        endpointObservations.map((observation) => observation.computerName),
      ),
      organizationName: first.organizationName,
      observationCount: endpointObservations.length,
      coordinateObservationCount: endpointObservations.filter(
        hasValidCoordinates,
      ).length,
      firstObservationAt: observationTime(first).value,
      lastObservationAt: observationTime(last).value,
      firstCoordinate:
        coordinateText(
          endpointExportObservations.find(hasValidCoordinates) ?? first,
        ),
      lastCoordinate:
        coordinateText(
          [...endpointExportObservations]
            .reverse()
            .find(hasValidCoordinates) ?? last,
        ),
      apparentDistanceMeters: Number(apparentDistanceMeters.toFixed(3)),
      movementSegmentCount: endpointMovementSegmentCount,
      maxApparentSpeedKmh:
        maxApparentSpeedKmh === null
          ? null
          : Number((maxApparentSpeedKmh as number).toFixed(3)),
      locationStatuses: uniqueNonEmpty(
        endpointObservations.map((observation) => observation.locationStatus),
      ),
      integrityStates: uniqueNonEmpty(
        endpointObservations.map((observation) => observation.locationIntegrity),
      ),
      city: latestNonEmpty(endpointObservations, (observation) => observation.city),
      state: latestNonEmpty(endpointObservations, (observation) => observation.state),
      postalCode: latestNonEmpty(
        endpointObservations,
        (observation) => observation.postalCode,
      ),
      country: latestNonEmpty(
        endpointObservations,
        (observation) => observation.country,
      ),
      nearestAddress: latestNonEmpty(
        endpointObservations,
        (observation) => observation.nearestAddress,
      ),
      crossStreets: latestNonEmpty(
        endpointObservations,
        (observation) => observation.crossStreets,
      ),
    });
    totalApparentDistanceMeters += apparentDistanceMeters;
    movementSegmentCount += endpointMovementSegmentCount;
  }

  const observationTimes = sorted.map((observation) => observationTime(observation).value);
  return {
    observations: enriched,
    endpointSummaries: endpointSummaries.sort((left, right) =>
      left.endpointId.localeCompare(right.endpointId),
    ),
    totalApparentDistanceMeters: Number(totalApparentDistanceMeters.toFixed(3)),
    movementSegmentCount,
    firstObservationAt: observationTimes[0] ?? null,
    lastObservationAt: observationTimes.at(-1) ?? null,
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
        streetAddress: device.streetAddress,
        city: device.city,
        state: device.state,
        postalCode: device.postalCode,
        country: device.country,
        addressSource: device.addressSource,
        nearestAddress: device.nearestAddress,
        crossStreets: device.crossStreets,
        addressPrecision: device.addressPrecision,
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
  const sourceObservations = await listRecoveryLocationHistory(filters);
  const movementAnalysis =
    buildRecoveryLocationHistoryAnalysis(sourceObservations);
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
    summary: `Generated ${scope.toLowerCase()} location history export ${exportId} with ${sourceObservations.length} observation${sourceObservations.length === 1 ? "" : "s"}.`,
    metadata: {
      exportId,
      scope,
      endpointIds,
      from: filters.from?.toISOString() ?? null,
      to: filters.to?.toISOString() ?? null,
      observationCount: sourceObservations.length,
      endpointCount: movementAnalysis.endpointSummaries.length,
      movementSegmentCount: movementAnalysis.movementSegmentCount,
    },
  });
  return {
    exportId,
    schemaVersion: "les-recovery-location-history/v2",
    generatedAt: new Date(),
    source:
      "Action1 recovery observations captured by this console after history collection was enabled; this export does not represent live device tracking.",
    scope,
    endpointIds,
    from: filters.from ?? null,
    to: filters.to ?? null,
    observationCount: sourceObservations.length,
    observationOrdering: "GROUPED_BY_ENDPOINT_THEN_CHRONOLOGICAL_ASCENDING",
    coverage: {
      endpointCount: movementAnalysis.endpointSummaries.length,
      endpointsWithCoordinates: movementAnalysis.endpointSummaries.filter(
        (summary) => summary.coordinateObservationCount > 0,
      ).length,
      observationCount: sourceObservations.length,
      coordinateObservationCount: sourceObservations.filter(hasValidCoordinates)
        .length,
      movementSegmentCount: movementAnalysis.movementSegmentCount,
      firstObservationAt: movementAnalysis.firstObservationAt,
      lastObservationAt: movementAnalysis.lastObservationAt,
      totalApparentDistanceMeters:
        movementAnalysis.totalApparentDistanceMeters,
      endpointSummaries: movementAnalysis.endpointSummaries,
    },
    observations: movementAnalysis.observations,
    limitations: [
      `History retention is ${getRetentionDays()} days from capture time. Records before history collection was enabled do not exist.`,
      "Coordinates are last-known observations from Action1, not live tracking data. Powered-off or disconnected devices cannot report a new location.",
      "Action1 endpoint ID is the canonical management identifier. Device ID and hardware fields are included only when Action1 reported them for that observation.",
      "Computer names can be reused or duplicated; do not use a computer name alone as proof of physical device identity.",
      "Movement fields are calculated between chronologically ordered coordinate observations for the same Action1 endpoint. They describe apparent coordinate change, not a verified route, continuous path, possession, or travel by a person.",
      "Distances use a straight-line great-circle calculation. Accuracy, missing observations, delayed uploads, repeated coordinates, and source timestamps can materially affect distance and apparent-speed values.",
      "A coordinate change of 25 meters or less is labeled NO_MATERIAL_CHANGE as an investigative aid; retain and assess the raw coordinates, accuracy, integrity, and timestamps.",
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
    "record_type",
    "record_description",
    "export_id",
    "schema_version",
    "generated_at_utc",
    "scope",
    "requested_from_utc",
    "requested_to_utc",
    "source_description",
    "evidence_limitations",
    "export_observation_count",
    "observation_ordering",
    "export_endpoint_count",
    "export_coordinate_observation_count",
    "export_endpoints_with_coordinates",
    "export_first_observation_at_utc",
    "export_last_observation_at_utc",
    "export_apparent_distance_meters",
    "export_movement_segment_count",
    "endpoint_id",
    "device_id",
    "computer_name",
    "computer_names_seen",
    "serial_number",
    "manufacturer",
    "model",
    "organization_id",
    "organization_name",
    "operating_system",
    "agent_version",
    "endpoint_observation_count",
    "endpoint_coordinate_observation_count",
    "endpoint_first_observation_at_utc",
    "endpoint_last_observation_at_utc",
    "endpoint_first_coordinate",
    "endpoint_last_coordinate",
    "endpoint_apparent_distance_meters",
    "endpoint_movement_segment_count",
    "endpoint_max_apparent_speed_kmh",
    "endpoint_location_statuses_seen",
    "endpoint_integrity_states_seen",
    "endpoint_latest_city",
    "endpoint_latest_state",
    "endpoint_latest_postal_code",
    "endpoint_latest_country",
    "endpoint_latest_nearest_address",
    "endpoint_latest_cross_streets",
    "observation_id",
    "observation_number_for_endpoint",
    "observation_time_basis",
    "captured_at_utc",
    "source_refreshed_at_utc",
    "location_observed_at_utc",
    "last_seen_at_utc",
    "latitude",
    "longitude",
    "location_coordinates",
    "street_address",
    "city",
    "state",
    "postal_code",
    "country",
    "address_source",
    "nearest_address",
    "cross_streets",
    "address_precision",
    "accuracy",
    "location_status",
    "location_integrity",
    "location_quality",
    "location_source",
    "position_source",
    "location_permission",
    "location_sequence",
    "location_age_minutes",
    "location_error",
    "location_summary",
    "is_map_safe",
    "prior_coordinate_observation_id",
    "prior_coordinate_observation_at_utc",
    "apparent_distance_from_prior_meters",
    "elapsed_from_prior_minutes",
    "apparent_speed_kmh",
    "movement_assessment",
  ];
  const limitations = exportData.limitations.join(" | ");
  const commonExportValues = [
    exportData.exportId,
    exportData.schemaVersion,
    exportData.generatedAt,
    exportData.scope,
    exportData.from,
    exportData.to,
    exportData.source,
    limitations,
    exportData.coverage.observationCount,
    exportData.observationOrdering,
    exportData.coverage.endpointCount,
    exportData.coverage.coordinateObservationCount,
    exportData.coverage.endpointsWithCoordinates,
    exportData.coverage.firstObservationAt,
    exportData.coverage.lastObservationAt,
    exportData.coverage.totalApparentDistanceMeters,
    exportData.coverage.movementSegmentCount,
  ];
  const blankEndpointAndObservationValues = new Array(
    header.length - 2 - commonExportValues.length,
  ).fill("");
  const rows = [
    [
      "EXPORT_SUMMARY",
      "Case-file metadata and fleet coverage summary",
      ...commonExportValues,
      ...blankEndpointAndObservationValues,
    ],
    ...exportData.coverage.endpointSummaries.map((summary) => [
      "ENDPOINT_SUMMARY",
      "Per-endpoint identity, coverage, and apparent movement summary",
      ...commonExportValues,
      summary.endpointId,
      summary.deviceId,
      summary.computerNames.at(-1) ?? "",
      summary.computerNames.join(" | "),
      "",
      "",
      "",
      summary.organizationName,
      "",
      "",
      "",
      summary.observationCount,
      summary.coordinateObservationCount,
      summary.firstObservationAt,
      summary.lastObservationAt,
      summary.firstCoordinate,
      summary.lastCoordinate,
      summary.apparentDistanceMeters,
      summary.movementSegmentCount,
      summary.maxApparentSpeedKmh,
      summary.locationStatuses.join(" | "),
      summary.integrityStates.join(" | "),
      summary.city,
      summary.state,
      summary.postalCode,
      summary.country,
      summary.nearestAddress,
      summary.crossStreets,
      ...new Array(37).fill(""),
    ]),
    ...exportData.observations.map((observation) => {
      const endpointSummary = exportData.coverage.endpointSummaries.find(
        (summary) => summary.endpointId === observation.endpointId,
      );
      return [
        "OBSERVATION",
        "Chronologically ordered persisted last-known observation",
        ...commonExportValues,
        observation.endpointId,
        observation.deviceId,
        observation.computerName,
        endpointSummary?.computerNames.join(" | ") ?? observation.computerName,
        observation.serialNumber,
        observation.manufacturer,
        observation.model,
        observation.organizationId,
        observation.organizationName,
        observation.operatingSystem,
        observation.agentVersion,
        endpointSummary?.observationCount ?? "",
        endpointSummary?.coordinateObservationCount ?? "",
        endpointSummary?.firstObservationAt ?? "",
        endpointSummary?.lastObservationAt ?? "",
        endpointSummary?.firstCoordinate ?? "",
        endpointSummary?.lastCoordinate ?? "",
        endpointSummary?.apparentDistanceMeters ?? "",
        endpointSummary?.movementSegmentCount ?? "",
        endpointSummary?.maxApparentSpeedKmh ?? "",
        endpointSummary?.locationStatuses.join(" | ") ?? "",
        endpointSummary?.integrityStates.join(" | ") ?? "",
        endpointSummary?.city ?? "",
        endpointSummary?.state ?? "",
        endpointSummary?.postalCode ?? "",
        endpointSummary?.country ?? "",
        endpointSummary?.nearestAddress ?? "",
        endpointSummary?.crossStreets ?? "",
        observation.id,
        observation.observationNumber,
        observation.observationTimeBasis,
        observation.capturedAt,
        observation.sourceRefreshedAt,
        observation.locationObservedAt,
        observation.lastSeenAt,
        observation.latitude,
        observation.longitude,
        coordinateText(observation),
        observation.streetAddress,
        observation.city,
        observation.state,
        observation.postalCode,
        observation.country,
        observation.addressSource,
        observation.nearestAddress,
        observation.crossStreets,
        observation.addressPrecision,
        observation.accuracy,
        observation.locationStatus,
        observation.locationIntegrity,
        observation.locationQuality,
        observation.locationSource,
        observation.positionSource,
        observation.locationPermission,
        observation.locationSequence,
        observation.locationAgeMinutes,
        observation.locationError,
        observation.locationSummary,
        observation.isMapSafe,
        observation.movementFromPrevious?.priorObservationId ?? "",
        observation.movementFromPrevious?.priorObservationAt ?? "",
        observation.movementFromPrevious?.distanceMeters ?? "",
        observation.movementFromPrevious?.elapsedMinutes ?? "",
        observation.movementFromPrevious?.apparentSpeedKmh ?? "",
        observation.movementFromPrevious?.assessment ??
          (hasValidCoordinates(observation) ? "FIRST_COORDINATE" : ""),
      ];
    }),
  ];
  return [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      row
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
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
        <td>${escapeHtml(observation.locationCoordinates ?? "Unavailable")}<br><small>${escapeHtml(observation.nearestAddress ?? observation.crossStreets ?? ([observation.city, observation.state, observation.postalCode, observation.country].filter(Boolean).join(", ") || "Address unavailable"))} · ${escapeHtml(observation.accuracy ?? "Accuracy unavailable")}</small></td>
        <td>${escapeHtml(observation.locationStatus ?? "Unavailable")}<br><small>Integrity: ${escapeHtml(observation.locationIntegrity ?? "Unknown")}</small></td>
        <td>#${observation.observationNumber} · ${escapeHtml(observation.locationObservedAt?.toISOString() ?? observation.sourceRefreshedAt.toISOString())}<br><small>${escapeHtml(observation.observationTimeBasis)} · Captured: ${escapeHtml(observation.capturedAt.toISOString())}</small></td>
        <td>${
          observation.movementFromPrevious
            ? `${escapeHtml(observation.movementFromPrevious.distanceMeters)} m<br><small>${escapeHtml(observation.movementFromPrevious.elapsedMinutes ?? "Unknown")} min · ${escapeHtml(observation.movementFromPrevious.apparentSpeedKmh ?? "Unknown")} km/h · ${escapeHtml(observation.movementFromPrevious.assessment)}</small>`
            : hasValidCoordinates(observation)
              ? "Starting coordinate"
              : "No coordinate"
        }</td>
      </tr>`,
    )
    .join("");
  const endpointSummaryRows = exportData.coverage.endpointSummaries
    .map(
      (summary) => `<tr>
        <td>${escapeHtml(summary.computerNames.join(", ") || "Name unavailable")}<br><small>${escapeHtml(summary.endpointId)} · Device ID: ${escapeHtml(summary.deviceId ?? "Not reported")}</small></td>
        <td>${summary.observationCount} total · ${summary.coordinateObservationCount} with coordinates</td>
        <td>${escapeHtml(summary.firstObservationAt?.toISOString() ?? "Unavailable")}<br><small>through ${escapeHtml(summary.lastObservationAt?.toISOString() ?? "Unavailable")}</small></td>
        <td>${escapeHtml(summary.firstCoordinate ?? "Unavailable")}<br><small>to ${escapeHtml(summary.lastCoordinate ?? "Unavailable")}</small></td>
        <td>${escapeHtml(summary.apparentDistanceMeters)} m<br><small>${summary.movementSegmentCount} segment(s) · max apparent speed ${escapeHtml(summary.maxApparentSpeedKmh ?? "Unknown")} km/h</small></td>
        <td>${escapeHtml(summary.locationStatuses.join(", ") || "Unavailable")}<br><small>Integrity: ${escapeHtml(summary.integrityStates.join(", ") || "Unknown")}</small></td>
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
      h1 { margin-bottom: 4px; } h2 { margin-top: 28px; } .meta { color: #4b5563; font-size: 12px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
      .summary div { border: 1px solid #d1d5db; padding: 10px; }
      .summary strong { display: block; font-size: 18px; } .summary span { color: #4b5563; font-size: 10px; text-transform: uppercase; }
      .toolbar { display: flex; justify-content: flex-end; margin-bottom: 16px; }
      .toolbar button { background: #111827; color: white; border: 0; padding: 10px 16px; cursor: pointer; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: .08em; }
      small { color: #4b5563; } footer { margin-top: 28px; font-size: 11px; color: #4b5563; }
      @media print { body { margin: 12mm; } .toolbar { display: none; } }
    </style>
  </head>
  <body>
    <div class="toolbar"><button type="button" onclick="window.print()">Print this report</button></div>
    <h1>LES Location History Export</h1>
    <p class="meta">Export ID: ${escapeHtml(exportData.exportId)} · Generated UTC: ${escapeHtml(exportData.generatedAt.toISOString())} · Scope: ${escapeHtml(exportData.scope)} · Observations: ${exportData.observationCount}</p>
    <p class="meta">Requested range: ${escapeHtml(exportData.from?.toISOString() ?? "Beginning of retained history")} through ${escapeHtml(exportData.to?.toISOString() ?? "End of retained history")}</p>
    <div class="summary">
      <div><strong>${exportData.coverage.endpointCount}</strong><span>Endpoints</span></div>
      <div><strong>${exportData.coverage.coordinateObservationCount}</strong><span>Coordinate observations</span></div>
      <div><strong>${exportData.coverage.movementSegmentCount}</strong><span>Comparable segments</span></div>
      <div><strong>${escapeHtml(exportData.coverage.totalApparentDistanceMeters)} m</strong><span>Total apparent distance</span></div>
    </div>
    <h2>Endpoint case summary</h2>
    <table>
      <thead><tr><th>Canonical endpoint identity</th><th>Coverage</th><th>Observation period</th><th>First / last coordinate</th><th>Apparent movement</th><th>Status / integrity</th></tr></thead>
      <tbody>${endpointSummaryRows || '<tr><td colspan="6">No endpoints match this selection.</td></tr>'}</tbody>
    </table>
    <h2>Chronological observations by endpoint</h2>
    <table>
      <thead><tr><th>Endpoint identity</th><th>Hardware identity</th><th>Last-known location</th><th>Status</th><th>Observation time</th><th>Apparent change from prior coordinate</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No observations match this selection.</td></tr>'}</tbody>
    </table>
    <h2>Limitations</h2><ul>${limitations}</ul>
    <footer>${escapeHtml(exportData.source)}<br>Schema: ${escapeHtml(exportData.schemaVersion)}</footer>
  </body>
</html>`;
}