---
name: Replit database publish override
description: Replit publish behavior when DATABASE_URL is present as a secret override
---

When Replit reports “External database detected,” a manually present `DATABASE_URL` secret can prevent database-aware publishing. Removing the override lets Replit use its managed PostgreSQL connection; confirm the managed database contains the project’s records first.

**Why:** Removing the secret changes the connection source even though it does not delete database rows. Publishing then applies the development-to-production schema diff, which is required when the API starts selecting newly added columns.

**How to apply:** Before removing the secret, verify the managed database has the expected tables and non-empty recovery data. After removal, restart services, run the development schema push, publish, and verify both the live API health endpoint and a representative data export.