import { eq } from "drizzle-orm";
import { db, recoveryGeocodingCacheTable } from "@workspace/db";
import { logger } from "./logger";
import type { RecoveryDevice } from "./action1-recovery";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_INTERVAL_MS = 1_100;
const REQUEST_TIMEOUT_MS = 8_000;
const SUCCESS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const NOT_FOUND_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const FAILURE_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const DEFAULT_USER_AGENT = "LES Location Agent Recovery Console/1.0";

type OSMRecord = Record<string, unknown>;

export interface OSMGeocodeResult {
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  nearestAddress: string | null;
  crossStreets: null;
  addressPrecision: string;
  addressSource: "OSM_NOMINATIM";
}

const inFlightLookups = new Map<
  string,
  Promise<OSMGeocodeResult | null>
>();
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function asRecord(value: unknown): OSMRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as OSMRecord)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coordinateKey(latitude: number, longitude: number): string {
  return `nominatim-v2:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function getUserAgent(): string {
  return (
    process.env["OSM_NOMINATIM_USER_AGENT"]?.trim() || DEFAULT_USER_AGENT
  );
}

function isPublicGeocodingAllowed(): boolean {
  return process.env["OSM_NOMINATIM_ALLOW_PUBLIC"] === "true";
}

function isValidCoordinate(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isFresh(expiresAt: Date): boolean {
  return expiresAt.getTime() > Date.now();
}

function fromCache(
  row: typeof recoveryGeocodingCacheTable.$inferSelect,
): OSMGeocodeResult | null {
  if (row.status !== "SUCCESS") {
    return null;
  }
  return {
    streetAddress: row.streetAddress,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    nearestAddress: row.nearestAddress,
    crossStreets: null,
    addressPrecision: row.addressPrecision ?? "APPROXIMATE",
    addressSource: "OSM_NOMINATIM",
  };
}

async function readCache(
  key: string,
): Promise<OSMGeocodeResult | null | undefined> {
  const rows = await db
    .select()
    .from(recoveryGeocodingCacheTable)
    .where(eq(recoveryGeocodingCacheTable.coordinateKey, key))
    .limit(1);
  const row = rows[0];
  if (!row || !isFresh(row.expiresAt)) {
    return undefined;
  }
  return fromCache(row);
}

async function writeCache(
  key: string,
  latitude: number,
  longitude: number,
  result: OSMGeocodeResult | null,
  status: "SUCCESS" | "NOT_FOUND" | "FAILED",
  ttlMs: number,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  await db
    .insert(recoveryGeocodingCacheTable)
    .values({
      coordinateKey: key,
      latitude,
      longitude,
      streetAddress: result?.streetAddress ?? null,
      city: result?.city ?? null,
      state: result?.state ?? null,
      postalCode: result?.postalCode ?? null,
      country: result?.country ?? null,
      nearestAddress: result?.nearestAddress ?? null,
      addressPrecision: result?.addressPrecision ?? null,
      status,
      attemptedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: recoveryGeocodingCacheTable.coordinateKey,
      set: {
        latitude,
        longitude,
        streetAddress: result?.streetAddress ?? null,
        city: result?.city ?? null,
        state: result?.state ?? null,
        postalCode: result?.postalCode ?? null,
        country: result?.country ?? null,
        nearestAddress: result?.nearestAddress ?? null,
        addressPrecision: result?.addressPrecision ?? null,
        status,
        attemptedAt: now,
        expiresAt,
      },
    });
}

async function runAtNominatimRateLimit<T>(
  work: () => Promise<T>,
): Promise<T> {
  const result = requestQueue.then(async () => {
    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
    nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
    return work();
  });
  requestQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function getPrecision(result: OSMRecord, address: OSMRecord): string {
  if (text(address["house_number"]) && text(address["road"])) {
    return "ADDRESS";
  }
  if (text(address["road"])) {
    return "STREET";
  }
  const type = (
    text(result["addresstype"]) ??
    text(result["type"]) ??
    text(result["class"]) ??
    ""
  ).toLowerCase();

  if (["house", "building", "house_number", "amenity"].includes(type)) {
    return "ADDRESS";
  }
  if (["road", "residential", "street", "highway"].includes(type)) {
    return "STREET";
  }
  if (["neighbourhood", "suburb", "quarter"].includes(type)) {
    return "NEIGHBORHOOD";
  }
  if (["city", "town", "village", "municipality"].includes(type)) {
    return "CITY";
  }
  return "APPROXIMATE";
}

export function parseNominatimResponse(
  payload: unknown,
): OSMGeocodeResult | null {
  const result = asRecord(Array.isArray(payload) ? payload[0] : payload);
  if (!result) {
    return null;
  }
  const address = asRecord(result["address"]) ?? {};
  const road = text(address["road"]);
  const houseNumber = text(address["house_number"]);
  const streetAddress =
    [houseNumber, road].filter((part): part is string => Boolean(part)).join(" ") ||
    null;
  const displayName = text(result["display_name"]);
  const city =
    text(address["city"]) ??
    text(address["town"]) ??
    text(address["village"]) ??
    text(address["municipality"]);
  const countryCode = text(address["country_code"]);
  const country = countryCode?.toUpperCase() ?? text(address["country"]);
  const nearestAddress = streetAddress ?? displayName;

  if (!nearestAddress && !city && !text(address["state"]) && !country) {
    return null;
  }

  return {
    streetAddress,
    city,
    state: text(address["state"]) ?? text(address["state_district"]),
    postalCode: text(address["postcode"]),
    country,
    nearestAddress,
    crossStreets: null,
    addressPrecision: getPrecision(result, address),
    addressSource: "OSM_NOMINATIM",
  };
}

export function mergeOsmAddressContext(
  device: RecoveryDevice,
  result: OSMGeocodeResult,
): RecoveryDevice {
  return {
    ...device,
    streetAddress: result.streetAddress ?? device.streetAddress,
    city: result.city ?? device.city,
    state: result.state ?? device.state,
    postalCode: result.postalCode ?? device.postalCode,
    country: result.country ?? device.country,
    nearestAddress: result.nearestAddress ?? device.nearestAddress,
    // Nominatim reverse geocoding does not reliably return a pair of
    // intersecting roads. Retain cross streets reported by Action1 instead.
    crossStreets: device.crossStreets,
    addressPrecision: result.addressPrecision,
    addressSource: result.addressSource,
  };
}

async function fetchFromNominatim(
  latitude: number,
  longitude: number,
): Promise<OSMGeocodeResult | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": getUserAgent(),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Nominatim returned HTTP ${response.status}.`);
    }
    return parseNominatimResponse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupCoordinate(
  latitude: number,
  longitude: number,
  key: string,
): Promise<OSMGeocodeResult | null> {
  if (!isPublicGeocodingAllowed()) {
    return null;
  }
  const cached = await readCache(key);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const result = await runAtNominatimRateLimit(() =>
      fetchFromNominatim(latitude, longitude),
    );
    await writeCache(
      key,
      latitude,
      longitude,
      result,
      result ? "SUCCESS" : "NOT_FOUND",
      result ? SUCCESS_CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS,
    );
    return result;
  } catch (error) {
    logger.warn(
      {
        reason: error instanceof Error ? error.message : "Unknown Nominatim error",
      },
      "OpenStreetMap reverse geocoding failed",
    );
    try {
      await writeCache(
        key,
        latitude,
        longitude,
        null,
        "FAILED",
        FAILURE_CACHE_TTL_MS,
      );
    } catch (cacheError) {
      logger.warn(
        { error: cacheError },
        "OpenStreetMap geocoding failure could not be cached",
      );
    }
    return null;
  }
}

async function lookupWithCache(
  latitude: number,
  longitude: number,
): Promise<OSMGeocodeResult | null> {
  const key = coordinateKey(latitude, longitude);
  const existing = inFlightLookups.get(key);
  if (existing) {
    return existing;
  }
  const promise = lookupCoordinate(latitude, longitude, key).finally(() => {
    inFlightLookups.delete(key);
  });
  inFlightLookups.set(key, promise);
  return promise;
}

function hasCompleteAddress(device: RecoveryDevice): boolean {
  const source = device.addressSource?.toUpperCase() ?? "";
  if (source === "ACTION1_APPROX_LOCATION") {
    return false;
  }
  return Boolean(
    (device.nearestAddress || device.streetAddress) &&
      (device.city || device.state || device.postalCode || device.country),
  );
}

export async function enrichRecoveryDevices(
  devices: RecoveryDevice[],
): Promise<RecoveryDevice[]> {
  return Promise.all(
    devices.map(async (device) => {
      if (!device.isMapSafe || hasCompleteAddress(device)) {
        return device;
      }
      const result = await lookupWithCache(device.latitude!, device.longitude!);
      if (!result) {
        return device;
      }
      return mergeOsmAddressContext(device, result);
    }),
  );
}

export function buildOpenStreetMapLink(
  latitude: number,
  longitude: number,
): string {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}

export function buildOpenStreetMapEmbedUrl(
  latitude: number,
  longitude: number,
): string {
  const delta = 0.003;
  const minLatitude = Math.max(-90, latitude - delta);
  const maxLatitude = Math.min(90, latitude + delta);
  const minLongitude = Math.max(-180, longitude - delta);
  const maxLongitude = Math.min(180, longitude + delta);
  const params = new URLSearchParams({
    bbox: `${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`,
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}