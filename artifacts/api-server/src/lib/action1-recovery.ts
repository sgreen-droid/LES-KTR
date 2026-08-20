import { logger } from "./logger";

const DEFAULT_ACTION1_BASE_URL = "https://app.action1.com/api/3.0";
const CACHE_TTL_MS = 60 * 1000;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_ORGANIZATION = 100;

type UnknownRecord = Record<string, unknown>;

interface Action1Organization {
  id: string;
  name: string;
}

interface RecoveryDevice {
  accuracy: string | null;
  agentHealth: string | null;
  agentVersion: string | null;
  computerName: string;
  deviceId: string | null;
  endpointId: string;
  endpointStatus: string;
  isMapSafe: boolean;
  lastAttempt: string | null;
  lastSeen: string | null;
  lastSuccess: string | null;
  latitude: number | null;
  locationAgeMinutes: string | null;
  locationCoordinates: string | null;
  locationError: string | null;
  locationIntegrity: string | null;
  locationPermission: string | null;
  locationQuality: string | null;
  locationSequence: string | null;
  locationSource: string | null;
  locationStatus: string | null;
  locationSummary: string | null;
  locationUpdated: string | null;
  longitude: number | null;
  mapEmbedUrl: string | null;
  mapLink: string | null;
  operatingSystem: string;
  organizationId: string;
  organizationName: string;
  positionSource: string | null;
  recoveryStatus: string | null;
}

interface RecoverySnapshot {
  devices: RecoveryDevice[];
  refreshedAt: string;
  source: string;
}

export interface Action1Readiness {
  checkedAt: string;
  message: string;
  status: "NOT_READY" | "READY";
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

class Action1UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Action1UnavailableError";
  }
}

let tokenCache: TokenCache | null = null;
let snapshotCache: RecoverySnapshot | null = null;
let snapshotExpiresAt = 0;
let snapshotPromise: Promise<RecoverySnapshot> | null = null;

function getAction1BaseUrl(): string {
  const configuredUrl = process.env["ACTION1_BASE_URL"]?.trim();
  if (!configuredUrl) {
    return DEFAULT_ACTION1_BASE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Action1UnavailableError(
      "ACTION1_BASE_URL must be a valid Action1 API URL.",
    );
  }

  const isAction1Host =
    parsed.hostname === "app.action1.com" ||
    parsed.hostname.endsWith(".action1.com");
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (
    parsed.protocol !== "https:" ||
    !isAction1Host ||
    normalizedPath !== "/api/3.0" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Action1UnavailableError(
      "ACTION1_BASE_URL must use HTTPS and point to an Action1 /api/3.0 endpoint.",
    );
  }

  return `${parsed.origin}${normalizedPath}`;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function getString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractAttributeValues(value: unknown): Map<string, string> {
  const attributes = new Map<string, string>();
  const visited = new Set<object>();

  const visit = (current: unknown, depth: number): void => {
    if (depth > 5 || current === null || current === undefined) {
      return;
    }
    if (Array.isArray(current)) {
      for (const entry of current) {
        visit(entry, depth + 1);
      }
      return;
    }
    const record = asRecord(current);
    if (!record || visited.has(record)) {
      return;
    }
    visited.add(record);

    const namedAttribute = getString(record["name"]);
    const namedValue =
      getString(record["value"]) ??
      getString(record["display_value"]) ??
      getString(record["displayValue"]);
    if (namedAttribute && namedValue) {
      attributes.set(normalizeKey(namedAttribute), namedValue);
    }

    for (const [key, nested] of Object.entries(record)) {
      const stringValue = getString(nested);
      if (stringValue) {
        attributes.set(normalizeKey(key), stringValue);
      } else {
        visit(nested, depth + 1);
      }
    }
  };

  visit(value, 0);
  return attributes;
}

function pick(
  attributes: Map<string, string>,
  aliases: string[],
): string | null {
  for (const alias of aliases) {
    const result = attributes.get(normalizeKey(alias));
    if (result) {
      return result;
    }
  }
  return null;
}

function parseCoordinate(
  value: string | null,
  min: number,
  max: number,
): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function normalizeEndpoint(
  endpoint: UnknownRecord,
  organization: Action1Organization,
): RecoveryDevice | null {
  const endpointId =
    getString(endpoint["id"]) ?? getString(endpoint["endpoint_id"]);
  if (!endpointId) {
    return null;
  }
  const attributes = extractAttributeValues(endpoint);
  const latitude = parseCoordinate(pick(attributes, ["Latitude"]), -90, 90);
  const longitude = parseCoordinate(
    pick(attributes, ["Longitude"]),
    -180,
    180,
  );
  const locationIntegrity = pick(attributes, ["Location Integrity"]);
  const isMapSafe =
    latitude !== null &&
    longitude !== null &&
    locationIntegrity?.toUpperCase() !== "INVALID";
  const coordinateText = isMapSafe
    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : null;
  const mapQuery = isMapSafe
    ? encodeURIComponent(`${latitude},${longitude}`)
    : null;

  return {
    accuracy: pick(attributes, ["Location Accuracy"]),
    agentHealth: pick(attributes, ["Agent Health"]),
    agentVersion: pick(attributes, ["Agent Version", "agent_version"]),
    computerName:
      getString(endpoint["name"]) ??
      pick(attributes, ["Computer Name"]) ??
      endpointId,
    deviceId: pick(attributes, ["Device ID"]),
    endpointId,
    endpointStatus:
      getString(endpoint["status"]) ??
      pick(attributes, ["Endpoint Status"]) ??
      "Unknown",
    isMapSafe,
    lastAttempt: pick(attributes, ["Last Attempt"]),
    lastSeen:
      getString(endpoint["last_seen"]) ??
      getString(endpoint["lastSeen"]) ??
      null,
    lastSuccess: pick(attributes, ["Last Success"]),
    latitude,
    locationAgeMinutes: pick(attributes, ["Location Age Minutes"]),
    locationCoordinates:
      pick(attributes, ["Location Coordinates"]) ?? coordinateText,
    locationError: pick(attributes, ["Location Error"]),
    locationIntegrity,
    locationPermission: pick(attributes, ["Location Permission"]),
    locationQuality: pick(attributes, ["Location Quality"]),
    locationSequence: pick(attributes, ["Location Sequence"]),
    locationSource: pick(attributes, ["Location Source"]),
    locationStatus: pick(attributes, ["Location Status"]),
    locationSummary: pick(attributes, ["Location Summary"]),
    locationUpdated: pick(attributes, ["Location Updated"]),
    longitude,
    mapEmbedUrl: mapQuery
      ? `https://www.google.com/maps?q=${mapQuery}&output=embed`
      : null,
    mapLink: mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${mapQuery}`
      : null,
    operatingSystem:
      getString(endpoint["OS"]) ??
      getString(endpoint["os"]) ??
      getString(endpoint["platform"]) ??
      "Unknown",
    organizationId: organization.id,
    organizationName: organization.name,
    positionSource: pick(attributes, ["Position Source"]),
    recoveryStatus: pick(attributes, ["Recovery Status"]),
  };
}

function getAction1Credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env["ACTION1_CLIENT_ID"]?.trim();
  const clientSecret = process.env["ACTION1_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) {
    throw new Action1UnavailableError(
      "Action1 API credentials are not configured.",
    );
  }
  return { clientId, clientSecret };
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now() + 45_000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = getAction1Credentials();
  const action1BaseUrl = getAction1BaseUrl();
  let response: Response;
  try {
    response = await fetch(`${action1BaseUrl}/oauth2/token`, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Action1UnavailableError(
      "Action1 authentication could not be reached.",
    );
  }

  if (!response.ok) {
    throw new Action1UnavailableError(
      "Action1 did not accept the configured API credentials.",
    );
  }

  const payload = asRecord(await response.json().catch(() => null));
  const accessToken = getString(payload?.["access_token"]);
  const expiresIn = Number(payload?.["expires_in"]);
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Action1UnavailableError(
      "Action1 returned an invalid authentication response.",
    );
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return accessToken;
}

async function getAction1Json(
  path: string,
  options: { forceRefresh?: boolean; retry?: boolean } = {},
): Promise<unknown> {
  const token = await getAccessToken(options.forceRefresh);
  const action1BaseUrl = getAction1BaseUrl();
  let response: Response;
  try {
    response = await fetch(`${action1BaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      method: "GET",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Action1UnavailableError("Action1 could not be reached.");
  }

  if (response.status === 401 && options.retry !== false) {
    tokenCache = null;
    return getAction1Json(path, { forceRefresh: true, retry: false });
  }
  if (!response.ok) {
    throw new Action1UnavailableError(
      `Action1 endpoint query failed with status ${response.status}.`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Action1UnavailableError("Action1 returned an invalid response.");
  }
}

async function getPaginatedItems(path: string): Promise<UnknownRecord[]> {
  const results: UnknownRecord[] = [];
  let offset = 0;
  let totalItems: number | null = null;

  for (let page = 0; page < MAX_PAGES_PER_ORGANIZATION; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = asRecord(
      await getAction1Json(
        `${path}${separator}from=${offset}&limit=${PAGE_SIZE}`,
      ),
    );
    const pageItems = Array.isArray(response?.["items"])
      ? response["items"]
          .map(asRecord)
          .filter((item): item is UnknownRecord => item !== null)
      : [];
    results.push(...pageItems);

    const reportedTotal = Number(response?.["total_items"]);
    if (Number.isFinite(reportedTotal) && reportedTotal >= 0) {
      totalItems = reportedTotal;
    }
    if (
      pageItems.length === 0 ||
      pageItems.length < PAGE_SIZE ||
      (totalItems !== null && results.length >= totalItems)
    ) {
      return results;
    }
    offset += pageItems.length;
  }

  throw new Action1UnavailableError(
    "Action1 returned too many endpoint result pages.",
  );
}

async function collectSnapshot(forceFreshAuthentication = false): Promise<RecoverySnapshot> {
  if (forceFreshAuthentication) {
    tokenCache = null;
    await getAccessToken(true);
  }

  const organizations = (await getPaginatedItems("/organizations"))
    .map((organization): Action1Organization | null => {
      const id = getString(organization["id"]);
      if (!id) {
        return null;
      }
      return {
        id,
        name: getString(organization["name"]) ?? "Unnamed organization",
      };
    })
    .filter(
      (organization): organization is Action1Organization => organization !== null,
    );

  const endpointPages = await Promise.all(
    organizations.map(async (organization) => ({
      endpoints: await getPaginatedItems(
        `/endpoints/managed/${encodeURIComponent(organization.id)}?fields=*`,
      ),
      organization,
    })),
  );
  const devices = endpointPages.flatMap(({ endpoints, organization }) =>
    endpoints
      .map((endpoint) => normalizeEndpoint(endpoint, organization))
      .filter((device): device is RecoveryDevice => device !== null),
  );
  const snapshot = {
    devices: devices.sort((left, right) =>
      left.computerName.localeCompare(right.computerName),
    ),
    refreshedAt: new Date().toISOString(),
    source: "Action1",
  };
  logger.info(
    { deviceCount: snapshot.devices.length, organizationCount: organizations.length },
    "Action1 recovery snapshot refreshed",
  );
  return snapshot;
}

export async function getRecoverySnapshot(): Promise<RecoverySnapshot> {
  if (snapshotCache && snapshotExpiresAt > Date.now()) {
    return snapshotCache;
  }
  if (!snapshotPromise) {
    snapshotPromise = collectSnapshot()
      .then((snapshot) => {
        snapshotCache = snapshot;
        snapshotExpiresAt = Date.now() + CACHE_TTL_MS;
        return snapshot;
      })
      .finally(() => {
        snapshotPromise = null;
      });
  }
  return snapshotPromise;
}

export async function getAction1Readiness(): Promise<Action1Readiness> {
  const checkedAt = new Date().toISOString();
  try {
    await collectSnapshot(true);
    return {
      checkedAt,
      message: "Action1 authentication and recovery read access are ready.",
      status: "READY",
    };
  } catch (error) {
    logger.warn(
      {
        failureType:
          error instanceof Action1UnavailableError ? "unavailable" : "unexpected",
      },
      "Action1 recovery readiness check failed",
    );
    return {
      checkedAt,
      message:
        "Update the Action1 API credentials to grant recovery read access, then retry the readiness check.",
      status: "NOT_READY",
    };
  }
}

export function filterRecoveryDevices(
  devices: RecoveryDevice[],
  filters: {
    agentHealth?: string;
    freshness?: "ACTIVE" | "STALE" | "ALL";
    integrity?: string;
    recoveryStatus?: string;
    search?: string;
  },
): RecoveryDevice[] {
  const search = filters.search?.trim().toLowerCase();
  return devices.filter((device) => {
    if (
      search &&
      ![
        device.computerName,
        device.deviceId,
        device.endpointId,
        device.organizationName,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search))
    ) {
      return false;
    }
    if (
      filters.recoveryStatus &&
      device.recoveryStatus?.toUpperCase() !==
        filters.recoveryStatus.toUpperCase()
    ) {
      return false;
    }
    if (
      filters.agentHealth &&
      device.agentHealth?.toUpperCase() !== filters.agentHealth.toUpperCase()
    ) {
      return false;
    }
    if (
      filters.integrity &&
      device.locationIntegrity?.toUpperCase() !== filters.integrity.toUpperCase()
    ) {
      return false;
    }
    if (
      filters.freshness &&
      filters.freshness !== "ALL" &&
      device.locationStatus?.toUpperCase() !== filters.freshness
    ) {
      return false;
    }
    return true;
  });
}

export function buildRecoverySummary(
  devices: RecoveryDevice[],
  refreshedAt: string,
): {
  activeLocations: number;
  attentionRequired: number;
  integrityIssues: number;
  refreshedAt: string;
  staleLocations: number;
  totalDevices: number;
} {
  const activeLocations = devices.filter(
    (device) => device.locationStatus?.toUpperCase() === "ACTIVE",
  ).length;
  const staleLocations = devices.filter(
    (device) => device.locationStatus?.toUpperCase() === "STALE",
  ).length;
  const integrityIssues = devices.filter(
    (device) => device.locationIntegrity?.toUpperCase() === "INVALID",
  ).length;
  const attentionRequired = devices.filter((device) => {
    const status = device.recoveryStatus?.toUpperCase();
    const health = device.agentHealth?.toUpperCase();
    return (
      device.locationIntegrity?.toUpperCase() === "INVALID" ||
      ["STALE", "NO LOCATION", "PERMISSION DENIED", "ERROR"].includes(
        status ?? "",
      ) ||
      ["ERROR", "INTEGRITY FAILED"].includes(health ?? "")
    );
  }).length;

  return {
    activeLocations,
    attentionRequired,
    integrityIssues,
    refreshedAt,
    staleLocations,
    totalDevices: devices.length,
  };
}

export { Action1UnavailableError };