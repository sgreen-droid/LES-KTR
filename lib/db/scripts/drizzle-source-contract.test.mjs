import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSourceChanges,
  parseSchemaSql,
} from "./drizzle-source-contract.mjs";

const reviewed = `CREATE TABLE "recovery_device_aliases" (
"endpoint_id" text PRIMARY KEY NOT NULL,
"friendly_name" varchar(120) NOT NULL
);
`;

test("parses tables and normalizes varchar types", () => {
  const parsed = parseSchemaSql(reviewed);

  assert.equal(
    parsed.get("recovery_device_aliases")?.get("friendly_name"),
    "character varying(120)",
  );
});

test("reports a removed Drizzle table as destructive", () => {
  const changes = describeSourceChanges(reviewed, "");

  assert.deepEqual(changes.destructive, [
    "table removed from Drizzle schema: recovery_device_aliases",
  ]);
});

test("reports a narrowing Drizzle type as destructive", () => {
  const changed = reviewed.replace("varchar(120)", "varchar(50)");
  const changes = describeSourceChanges(reviewed, changed);

  assert.deepEqual(changes.destructive, [
    "recovery_device_aliases.friendly_name: type changed from character varying(120) to character varying(50)",
  ]);
});