import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { potentiallyDestructiveTypeChange } from "./schema-contract.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.resolve(scriptDirectory, "../drizzle-schema.sql");
const packageDirectory = path.resolve(scriptDirectory, "..");
const writeMode = process.argv.includes("--write");

function normalizeSql(sql) {
  return `${sql
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()}\n`;
}

function normalizeType(type) {
  return type.replace(/^varchar\(/, "character varying(");
}

export function parseSchemaSql(sql) {
  const tables = new Map();
  const tablePattern = /CREATE TABLE "([^"]+)" \(\n([\s\S]*?)\n\);/g;
  for (const match of sql.matchAll(tablePattern)) {
    const columns = new Map();
    for (const rawLine of match[2].split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      const column = line.match(/^"([^"]+)"\s+(.+)$/);
      if (!column) continue;
      const type = column[2]
        .split(/\s+(?:DEFAULT|NOT NULL|PRIMARY KEY|UNIQUE)\b/, 1)[0]
        .trim();
      columns.set(column[1], normalizeType(type));
    }
    tables.set(match[1], columns);
  }
  return tables;
}

export function describeSourceChanges(expectedSql, actualSql) {
  const expected = parseSchemaSql(expectedSql);
  const actual = parseSchemaSql(actualSql);
  const destructive = [];
  const additive = [];
  const other = [];

  for (const [tableName, expectedColumns] of expected) {
    const actualColumns = actual.get(tableName);
    if (!actualColumns) {
      destructive.push(`table removed from Drizzle schema: ${tableName}`);
      continue;
    }
    for (const [columnName, expectedType] of expectedColumns) {
      const actualType = actualColumns.get(columnName);
      if (!actualType) {
        destructive.push(
          `${tableName}: column removed from Drizzle schema: ${columnName}`,
        );
      } else if (expectedType !== actualType) {
        const message =
          `${tableName}.${columnName}: type changed from ` +
          `${expectedType} to ${actualType}`;
        if (potentiallyDestructiveTypeChange(expectedType, actualType)) {
          destructive.push(message);
        } else {
          other.push(message);
        }
      }
    }
    for (const columnName of actualColumns.keys()) {
      if (!expectedColumns.has(columnName)) {
        additive.push(
          `${tableName}: column added to Drizzle schema: ${columnName}`,
        );
      }
    }
  }
  for (const tableName of actual.keys()) {
    if (!expected.has(tableName)) {
      additive.push(`table added to Drizzle schema: ${tableName}`);
    }
  }
  return { destructive, additive, other };
}

function exportDrizzleSql() {
  const binary = path.resolve(
    packageDirectory,
    `node_modules/.bin/drizzle-kit${process.platform === "win32" ? ".cmd" : ""}`,
  );
  const result = spawnSync(
    binary,
    ["export", "--config", "./drizzle.export.config.ts"],
    {
      cwd: packageDirectory,
      encoding: "utf8",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Drizzle schema export failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return normalizeSql(result.stdout);
}

async function main() {
  if (
    writeMode &&
    (process.env.CI === "true" ||
      process.env.ALLOW_SCHEMA_CONTRACT_WRITE !== "1")
  ) {
    throw new Error(
      "Source contract updates require ALLOW_SCHEMA_CONTRACT_WRITE=1 and are disabled in CI.",
    );
  }
  const actual = exportDrizzleSql();
  if (writeMode) {
    await fs.writeFile(contractPath, actual);
    console.log(`Updated reviewed Drizzle source contract: ${contractPath}`);
    return;
  }

  const expected = normalizeSql(await fs.readFile(contractPath, "utf8"));
  if (expected === actual) {
    console.log("Drizzle source matches the reviewed SQL contract.");
    return;
  }

  const changes = describeSourceChanges(expected, actual);
  console.error("Drizzle schema differs from the reviewed SQL contract.");
  for (const [label, items] of [
    ["DESTRUCTIVE OR BREAKING", changes.destructive],
    ["ADDITIVE", changes.additive],
    ["OTHER", changes.other],
  ]) {
    if (items.length === 0) continue;
    console.error(`\n${label}:`);
    for (const item of items) console.error(`- ${item}`);
  }
  if (
    changes.destructive.length +
      changes.additive.length +
      changes.other.length ===
    0
  ) {
    console.error(
      "\nOTHER:\n- constraints, indexes, defaults, or generated SQL changed",
    );
  }
  console.error(
    "\nReview the generated SQL. If intentional, update the source contract " +
      "explicitly with ALLOW_SCHEMA_CONTRACT_WRITE=1 " +
      "pnpm --filter @workspace/db run schema:source:update.",
  );
  process.exitCode = 1;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(
      `Drizzle source contract check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}