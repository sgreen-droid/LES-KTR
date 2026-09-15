import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Retained legacy data. See LESLocationAgent/docs/GEOCODING-CACHE-LIFECYCLE.md
// before adding a consumer, cleanup job, or destructive migration.
export const recoveryGeocodingCacheTable = pgTable(
  "recovery_geocoding_cache",
  {
    coordinateKey: text("coordinate_key").primaryKey(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    streetAddress: text("street_address"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    nearestAddress: text("nearest_address"),
    addressPrecision: text("address_precision"),
    status: text("status").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("recovery_geocoding_cache_expires_at_idx").on(table.expiresAt),
  ],
);

export const insertRecoveryGeocodingCacheSchema = createInsertSchema(
  recoveryGeocodingCacheTable,
);
export type InsertRecoveryGeocodingCache = z.infer<
  typeof insertRecoveryGeocodingCacheSchema
>;
export type RecoveryGeocodingCache =
  typeof recoveryGeocodingCacheTable.$inferSelect;