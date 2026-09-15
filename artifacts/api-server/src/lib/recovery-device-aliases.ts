import { eq } from "drizzle-orm";
import {
  db,
  recoveryDeviceAliasesTable,
  type RecoveryDeviceAlias,
} from "@workspace/db";
import type { RecoveryDevice } from "./action1-recovery";

const FRIENDLY_NAME_MAX_LENGTH = 120;

export function normalizeFriendlyName(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > FRIENDLY_NAME_MAX_LENGTH) {
    throw new Error(
      `A friendly name must be ${FRIENDLY_NAME_MAX_LENGTH} characters or fewer.`,
    );
  }
  return normalized;
}

export async function listRecoveryDeviceAliases(): Promise<
  RecoveryDeviceAlias[]
> {
  return db.select().from(recoveryDeviceAliasesTable);
}

export async function getRecoveryDeviceAlias(
  endpointId: string,
): Promise<RecoveryDeviceAlias | null> {
  const [alias] = await db
    .select()
    .from(recoveryDeviceAliasesTable)
    .where(eq(recoveryDeviceAliasesTable.endpointId, endpointId))
    .limit(1);
  return alias ?? null;
}

export async function upsertRecoveryDeviceAlias(
  endpointId: string,
  friendlyName: string | null,
): Promise<RecoveryDeviceAlias | null> {
  const normalized = normalizeFriendlyName(friendlyName);
  if (normalized === null) {
    return deleteRecoveryDeviceAlias(endpointId);
  }
  const [alias] = await db
    .insert(recoveryDeviceAliasesTable)
    .values({ endpointId, friendlyName: normalized })
    .onConflictDoUpdate({
      target: recoveryDeviceAliasesTable.endpointId,
      set: { friendlyName: normalized, updatedAt: new Date() },
    })
    .returning();
  return alias ?? null;
}

export async function deleteRecoveryDeviceAlias(
  endpointId: string,
): Promise<RecoveryDeviceAlias | null> {
  const [alias] = await db
    .delete(recoveryDeviceAliasesTable)
    .where(eq(recoveryDeviceAliasesTable.endpointId, endpointId))
    .returning();
  return alias ?? null;
}

export function mergeRecoveryDeviceAliases(
  devices: RecoveryDevice[],
  aliases: Array<{ endpointId: string; friendlyName: string | null }>,
): RecoveryDevice[] {
  const namesByEndpoint = new Map(
    aliases.map((alias) => [alias.endpointId, alias.friendlyName]),
  );
  return devices.map((device) => ({
    ...device,
    friendlyName: normalizeFriendlyName(
      namesByEndpoint.get(device.endpointId) ?? null,
    ),
  }));
}

export async function mergeCurrentRecoveryDeviceAliases(
  devices: RecoveryDevice[],
): Promise<RecoveryDevice[]> {
  return mergeRecoveryDeviceAliases(devices, await listRecoveryDeviceAliases());
}