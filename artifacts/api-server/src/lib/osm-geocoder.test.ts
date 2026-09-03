import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpenStreetMapEmbedUrl,
  buildOpenStreetMapLink,
  mergeOsmAddressContext,
  parseNominatimResponse,
} from "./osm-geocoder";
import type { RecoveryDevice } from "./action1-recovery";

test("builds Google-free OpenStreetMap map URLs from validated coordinates", () => {
  const link = new URL(buildOpenStreetMapLink(40.8131, -73.9453));
  assert.equal(link.hostname, "www.openstreetmap.org");
  assert.equal(link.searchParams.get("mlat"), "40.813100");
  assert.equal(link.searchParams.get("mlon"), "-73.945300");
  assert.equal(link.hash, "#map=18/40.813100/-73.945300");

  const embed = new URL(buildOpenStreetMapEmbedUrl(40.8131, -73.9453));
  assert.equal(embed.hostname, "www.openstreetmap.org");
  assert.equal(embed.pathname, "/export/embed.html");
  assert.equal(embed.searchParams.get("layer"), "mapnik");
  assert.equal(embed.searchParams.get("marker"), "40.8131,-73.9453");
  assert.ok(embed.searchParams.get("bbox"));
});

test("normalizes a Nominatim reverse-geocoding response", () => {
  const result = parseNominatimResponse({
    display_name: "123 Main Street, Manhattan, New York, 10001, United States",
    address: {
      house_number: "123",
      road: "Main Street",
      city: "New York",
      state: "New York",
      postcode: "10001",
      country: "United States",
      country_code: "us",
    },
  });

  assert.deepEqual(result, {
    streetAddress: "123 Main Street",
    city: "New York",
    state: "New York",
    postalCode: "10001",
    country: "US",
    nearestAddress: "123 Main Street",
    crossStreets: null,
    addressPrecision: "ADDRESS",
    addressSource: "OSM_NOMINATIM",
  });
});

test("treats an empty Nominatim response as unavailable", () => {
  assert.equal(parseNominatimResponse([]), null);
});

test("OSM enrichment preserves cross streets reported by Action1", () => {
  const result = parseNominatimResponse({
    display_name: "123 Main Street, New York, NY 10001, United States",
    address: {
      house_number: "123",
      road: "Main Street",
      city: "New York",
      state: "New York",
      postcode: "10001",
      country_code: "us",
    },
  });
  assert.ok(result);

  const enriched = mergeOsmAddressContext(
    {
      crossStreets: "Main Street & First Avenue",
      streetAddress: null,
      nearestAddress: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      addressPrecision: null,
      addressSource: null,
    } as RecoveryDevice,
    result,
  );

  assert.equal(enriched.crossStreets, "Main Street & First Avenue");
  assert.equal(enriched.nearestAddress, "123 Main Street");
  assert.equal(enriched.addressSource, "OSM_NOMINATIM");
});