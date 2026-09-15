# Legacy geocoding cache lifecycle

## Decision

`recovery_geocoding_cache` is retained legacy data. The current Recovery
Console must not read from it, write to it, prune it, or send new public
reverse-geocoding requests.

The table remains in the Drizzle schema so routine schema updates preserve it.
Its rows must not be deleted without an explicit, reviewed data-removal change.

Review this decision after **2026-10-09**, when the newest existing cache entry
across development and production has passed its original expiration time.

## Why the table exists

An earlier development branch implemented OpenStreetMap Nominatim reverse
geocoding in the API server. That implementation:

- rounded coordinates into cache keys;
- cached successful lookups for 30 days;
- cached not-found and failed lookups for shorter periods;
- merged derived address fields into copies of Action1 endpoint records.

That branch was not merged into the current main lineage. The current API has
no geocoder module and no runtime reference to this table.

Current human-readable location fields come from the Windows agent or other
approved metadata already synchronized through Action1. The Recovery Console
parses those fields and preserves them in location observations and incident
evidence. It does not derive addresses from this legacy cache.

## Data review

The development and production tables were reviewed on 2026-09-15 using
aggregate queries only; no cached addresses were exported or displayed.

Development:

- 12 total rows;
- all 12 have `SUCCESS` status;
- attempts occurred on 2026-09-01;
- all entries expire on 2026-10-01;

Production:

- 11 total rows;
- all 11 have `SUCCESS` status;
- attempts occurred from 2026-09-01 through 2026-09-08;
- entries expire from 2026-10-01 through 2026-10-08.

No current source-code consumer exists in either environment.

## Removal requirements

After the review date, removal is optional, not automatic. A future change may
remove the table only when all of the following are true:

1. The project owner explicitly approves deletion.
2. Production is checked separately for consumers and row counts.
3. Any required backup is exported to access-controlled storage and its
   retention period is documented.
4. The schema migration names the table explicitly and is reviewed as a
   destructive change.
5. Development and production deletion are handled independently.

Until then, preserve the table and its rows.

## Reintroducing reverse geocoding

Do not reconnect this cache merely because the schema is available. A new
reverse-geocoding feature requires a separate decision covering provider terms,
privacy, request volume, rate limits, retention, failure caching, and address
provenance. Raw coordinates must remain the evidence source; any derived
address must be clearly labeled.