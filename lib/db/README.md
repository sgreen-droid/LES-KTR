# Database schema validation

Drizzle table definitions in `src/schema/` are the source of truth. The
reviewed `drizzle-schema.sql` records Drizzle's generated SQL, while
`schema-contract.json` records the resulting PostgreSQL structure for all
`public.recovery_*` tables.

## Read-only development check

```sh
pnpm run check:db-schema
```

The first check exports Drizzle SQL without connecting to a database and
compares it with the reviewed SQL contract. The second reads development
catalog metadata inside a `READ ONLY` transaction. Neither check executes DDL
or changes rows.

The check fails on every unreviewed difference and labels missing tables,
missing columns, narrowing varchar changes, new `NOT NULL` requirements, and
changed constraints or indexes as destructive or breaking.

The comparator's destructive and additive classifications have direct tests:

```sh
pnpm --filter @workspace/db run schema:test
```

## Intentional schema changes

1. Apply the reviewed Drizzle change to development.
2. Run the checks and review every reported difference.
3. Update both contracts explicitly:

   ```sh
   ALLOW_SCHEMA_CONTRACT_WRITE=1 \
     pnpm --filter @workspace/db run schema:source:update
   ALLOW_SCHEMA_CONTRACT_WRITE=1 \
     pnpm --filter @workspace/db run schema:contract:update
   ```

4. Review the contract diff with the code change.
5. Run `schema:check` again.

Contract updates are disabled when `CI=true`.

The Drizzle source check needs no database and can run in any CI environment.
If CI also runs the catalog check, it must supply a disposable database rather
than development or production credentials.