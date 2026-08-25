---
name: Action1 API rate limiting
description: How to handle extended Action1 OAuth token rate limits during operational work.
---

When Action1 returns HTTP 429 from its OAuth token endpoint, honor the `Retry-After`
header exactly and do not probe or retry during that window, even when the delay is
many hours.

**Why:** Repeated authentication attempts can prolong the provider lockout and block
both read access and endpoint actions such as deployment.

**How to apply:** Record the returned cooldown, stop Action1 calls, and resume the
deployment or recovery operation only after the specified time has elapsed.