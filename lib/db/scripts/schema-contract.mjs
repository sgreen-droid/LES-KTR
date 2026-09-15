import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const contractPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../schema-contract.json",
);
const writeMode = process.argv.includes("--write");

function normalizeDefinition(value) {
  return value?.replaceAll(/public\./g, "").replaceAll(/\s+/g, " ").trim() ?? null;
}

async function readDatabaseContract(client) {
  const columns = await client.query(`
    SELECT
      cls.relname AS table_name,
      attr.attname AS column_name,
      attr.attnum AS ordinal_position,
      format_type(attr.atttypid, attr.atttypmod) AS data_type,
      NOT attr.attnotnull AS nullable,
      pg_get_expr(def.adbin, def.adrelid) AS column_default
    FROM pg_class cls
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    JOIN pg_attribute attr ON attr.attrelid = cls.oid
    LEFT JOIN pg_attrdef def
      ON def.adrelid = cls.oid
      AND def.adnum = attr.attnum
    WHERE nsp.nspname = 'public'
      AND cls.relkind = 'r'
      AND cls.relname LIKE 'recovery\\_%' ESCAPE '\\'
      AND attr.attnum > 0
      AND NOT attr.attisdropped
    ORDER BY cls.relname, attr.attnum
  `);
  const constraints = await client.query(`
    SELECT
      cls.relname AS table_name,
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relname LIKE 'recovery\\_%' ESCAPE '\\'
    ORDER BY cls.relname, con.conname
  `);
  const indexes = await client.query(`
    SELECT
      tbl.relname AS table_name,
      idx.relname AS index_name,
      pg_get_indexdef(idx.oid) AS definition
    FROM pg_index ind
    JOIN pg_class idx ON idx.oid = ind.indexrelid
    JOIN pg_class tbl ON tbl.oid = ind.indrelid
    JOIN pg_namespace nsp ON nsp.oid = tbl.relnamespace
    LEFT JOIN pg_constraint con ON con.conindid = idx.oid
    WHERE nsp.nspname = 'public'
      AND tbl.relname LIKE 'recovery\\_%' ESCAPE '\\'
      AND con.oid IS NULL
    ORDER BY tbl.relname, idx.relname
  `);

  const tables = {};
  for (const row of columns.rows) {
    tables[row.table_name] ??= { columns: [], constraints: [], indexes: [] };
    tables[row.table_name].columns.push({
      name: row.column_name,
      type: row.data_type,
      nullable: row.nullable,
      default: normalizeDefinition(row.column_default),
    });
  }
  for (const row of constraints.rows) {
    tables[row.table_name] ??= { columns: [], constraints: [], indexes: [] };
    tables[row.table_name].constraints.push({
      name: row.constraint_name,
      type: row.constraint_type,
      definition: normalizeDefinition(row.definition),
    });
  }
  for (const row of indexes.rows) {
    tables[row.table_name] ??= { columns: [], constraints: [], indexes: [] };
    tables[row.table_name].indexes.push({
      name: row.index_name,
      definition: normalizeDefinition(row.definition),
    });
  }

  return {
    version: 1,
    scope: "public.recovery_*",
    tables,
  };
}

function indexed(items) {
  return new Map(items.map((item) => [item.name, item]));
}

function varcharLength(type) {
  const match = type.match(/^(?:character varying|varchar)\((\d+)\)$/);
  return match ? Number(match[1]) : null;
}

export function potentiallyDestructiveTypeChange(expected, actual) {
  if (expected === actual) return false;
  if (expected === "text" && varcharLength(actual) !== null) return true;
  const expectedLength = varcharLength(expected);
  const actualLength = varcharLength(actual);
  return (
    expectedLength !== null &&
    actualLength !== null &&
    actualLength < expectedLength
  );
}

function compareNamedItems(kind, tableName, expectedItems, actualItems, changes) {
  const expected = indexed(expectedItems);
  const actual = indexed(actualItems);
  for (const [name, item] of expected) {
    if (!actual.has(name)) {
      changes.destructive.push(`${tableName}: ${kind} removed: ${name}`);
    } else if (JSON.stringify(item) !== JSON.stringify(actual.get(name))) {
      changes.destructive.push(`${tableName}: ${kind} changed: ${name}`);
    }
  }
  for (const name of actual.keys()) {
    if (!expected.has(name)) {
      changes.additive.push(`${tableName}: ${kind} added: ${name}`);
    }
  }
}

export function compareContracts(expected, actual) {
  const changes = { destructive: [], additive: [], other: [] };
  const expectedTables = new Map(Object.entries(expected.tables));
  const actualTables = new Map(Object.entries(actual.tables));

  for (const [tableName, expectedTable] of expectedTables) {
    const actualTable = actualTables.get(tableName);
    if (!actualTable) {
      changes.destructive.push(`table removed: ${tableName}`);
      continue;
    }
    const expectedColumns = indexed(expectedTable.columns);
    const actualColumns = indexed(actualTable.columns);
    for (const [columnName, expectedColumn] of expectedColumns) {
      const actualColumn = actualColumns.get(columnName);
      if (!actualColumn) {
        changes.destructive.push(
          `${tableName}: column removed: ${columnName}`,
        );
        continue;
      }
      if (expectedColumn.type !== actualColumn.type) {
        const bucket = potentiallyDestructiveTypeChange(
          expectedColumn.type,
          actualColumn.type,
        )
          ? changes.destructive
          : changes.other;
        bucket.push(
          `${tableName}.${columnName}: type changed from ${expectedColumn.type} to ${actualColumn.type}`,
        );
      }
      if (expectedColumn.nullable && !actualColumn.nullable) {
        changes.destructive.push(
          `${tableName}.${columnName}: changed from nullable to NOT NULL`,
        );
      } else if (expectedColumn.nullable !== actualColumn.nullable) {
        changes.other.push(
          `${tableName}.${columnName}: nullability changed`,
        );
      }
      if (expectedColumn.default !== actualColumn.default) {
        changes.other.push(`${tableName}.${columnName}: default changed`);
      }
    }
    for (const columnName of actualColumns.keys()) {
      if (!expectedColumns.has(columnName)) {
        changes.additive.push(`${tableName}: column added: ${columnName}`);
      }
    }
    compareNamedItems(
      "constraint",
      tableName,
      expectedTable.constraints,
      actualTable.constraints,
      changes,
    );
    compareNamedItems(
      "index",
      tableName,
      expectedTable.indexes,
      actualTable.indexes,
      changes,
    );
  }
  for (const tableName of actualTables.keys()) {
    if (!expectedTables.has(tableName)) {
      changes.additive.push(`table added: ${tableName}`);
    }
  }
  return changes;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the schema contract check.");
  }
  if (
    writeMode &&
    (process.env.CI === "true" ||
      process.env.ALLOW_SCHEMA_CONTRACT_WRITE !== "1")
  ) {
    throw new Error(
      "Contract updates require ALLOW_SCHEMA_CONTRACT_WRITE=1 and are disabled in CI.",
    );
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let actual;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    actual = await readDatabaseContract(client);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }

  if (writeMode) {
    await fs.writeFile(contractPath, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`Updated reviewed schema contract: ${contractPath}`);
    return;
  }

  const expected = JSON.parse(await fs.readFile(contractPath, "utf8"));
  const changes = compareContracts(expected, actual);
  const count =
    changes.destructive.length + changes.additive.length + changes.other.length;
  if (count === 0) {
    console.log(
      `Schema contract matches (${Object.keys(actual.tables).length} recovery tables).`,
    );
    return;
  }

  console.error("Database schema differs from the reviewed contract.");
  for (const [label, items] of [
    ["DESTRUCTIVE OR BREAKING", changes.destructive],
    ["ADDITIVE", changes.additive],
    ["OTHER", changes.other],
  ]) {
    if (items.length === 0) continue;
    console.error(`\n${label}:`);
    for (const item of items) console.error(`- ${item}`);
  }
  console.error(
    "\nReview the change. If intentional, update the contract explicitly with " +
      "ALLOW_SCHEMA_CONTRACT_WRITE=1 pnpm --filter @workspace/db run schema:contract:update.",
  );
  process.exitCode = 1;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(
      `Schema contract check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}