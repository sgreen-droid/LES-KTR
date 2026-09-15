import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const recoveryDeviceAliasesTable = pgTable("recovery_device_aliases", {
  endpointId: text("endpoint_id").primaryKey(),
  friendlyName: varchar("friendly_name", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRecoveryDeviceAliasSchema = createInsertSchema(
  recoveryDeviceAliasesTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertRecoveryDeviceAlias = z.infer<
  typeof insertRecoveryDeviceAliasSchema
>;
export type RecoveryDeviceAlias =
  typeof recoveryDeviceAliasesTable.$inferSelect;