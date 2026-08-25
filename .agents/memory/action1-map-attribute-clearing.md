---
name: Action1 map attribute clearing
description: Preventing stale or untrusted map values from surviving an invalid recovery record.
---

When recovery telemetry is missing, malformed, out of range, or fails integrity validation, explicitly clear Action1's map-derived attributes (`Map Link`, coordinates, and summary) instead of merely skipping their update.

**Why:** Action1 retains prior custom-attribute values. Leaving an old map value in place after a new invalid or untrusted record can make historical, untrusted data look current to operators.

**How to apply:** Keep map-derived attributes optional for staged rollout, but set them to empty values on every error/no-location/untrusted path. Maintain a stateful test that begins with existing map values and verifies they are removed.