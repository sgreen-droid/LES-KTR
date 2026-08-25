---
name: Action1 timestamp formats
description: Handling non-ISO timestamps returned by Action1 recovery device data.
---

Action1 device fields can contain UTC timestamps in the form `YYYY-MM-DD_HH-MM-SS` rather than ISO 8601.

**Why:** Strict ISO parsing rejects this form; passing the resulting invalid `Date` to a formatter throws `Invalid time value` and can crash a recovery-console page.

**How to apply:** Normalize this specific provider shape to a UTC ISO timestamp at the display boundary, validate it before formatting, and render a clear unavailable fallback for any unparseable value. Do not let a provider timestamp failure abort the entire device list.