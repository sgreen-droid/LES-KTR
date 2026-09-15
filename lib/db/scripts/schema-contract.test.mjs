import assert from "node:assert/strict";
import test from "node:test";
import {
  compareContracts,
  potentiallyDestructiveTypeChange,
} from "./schema-contract.mjs";

function contractWithFriendlyName(type = "character varying(120)") {
  return {
    version: 1,
    scope: "public.recovery_*",
    tables: {
      recovery_device_aliases: {
        columns: [
          {
            name: "endpoint_id",
            type: "text",
            nullable: false,
            default: null,
          },
          {
            name: "friendly_name",
            type,
            nullable: false,
            default: null,
          },
        ],
        constraints: [],
        indexes: [],
      },
    },
  };
}

test("classifies a removed managed table as destructive", () => {
  const changes = compareContracts(contractWithFriendlyName(), {
    version: 1,
    scope: "public.recovery_*",
    tables: {},
  });

  assert.deepEqual(changes.destructive, [
    "table removed: recovery_device_aliases",
  ]);
});

test("classifies a narrowing varchar change as destructive", () => {
  const changes = compareContracts(
    contractWithFriendlyName(),
    contractWithFriendlyName("character varying(50)"),
  );

  assert.deepEqual(changes.destructive, [
    "recovery_device_aliases.friendly_name: type changed from character varying(120) to character varying(50)",
  ]);
  assert.equal(
    potentiallyDestructiveTypeChange(
      "character varying(120)",
      "character varying(50)",
    ),
    true,
  );
});

test("reports a new column as additive drift", () => {
  const expected = contractWithFriendlyName();
  const actual = structuredClone(expected);
  actual.tables.recovery_device_aliases.columns.push({
    name: "notes",
    type: "text",
    nullable: true,
    default: null,
  });

  const changes = compareContracts(expected, actual);

  assert.deepEqual(changes.additive, [
    "recovery_device_aliases: column added: notes",
  ]);
  assert.deepEqual(changes.destructive, []);
});