---
name: Published environment refresh
description: Shared environment changes require a republish before live deployment verification.
---

An already-running published artifact does not pick up changed environment values merely because its development workflow was restarted; republish before validating live behavior.

**Why:** The development API and the public `.replit.app` process run separately, so live requests can continue using the previous environment until a new deployment is published.

**How to apply:** After changing secrets or non-secret environment variables, restart the relevant development workflow for local checks, then republish before testing the public URL.