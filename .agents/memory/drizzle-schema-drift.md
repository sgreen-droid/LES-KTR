---
name: Drizzle schema drift
description: Safety constraint for development database schema pushes while an existing recovery cache table is outside the Drizzle schema.
---

Do not run the force variant of the Drizzle schema push while `recovery_geocoding_cache` remains outside the schema source of truth. A normal push identifies that existing table as a data-loss deletion.

**Why:** The development database contains live cache rows in that table, and forcing the inferred diff would delete them. An additive table needed for friendly names was created directly and then verified instead.

**How to apply:** Before future schema pushes, reconcile the cache table into the Drizzle schema or inspect the proposed diff. Never accept unrelated destructive statements just to apply an additive change.