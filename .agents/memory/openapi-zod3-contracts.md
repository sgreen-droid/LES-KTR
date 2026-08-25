---
name: OpenAPI Zod 3 contract compatibility
description: Portable schema conventions for this workspace's generated Zod validators.
---

Use portable string and number schema declarations for generated request and response contracts rather than OpenAPI annotations that cause the generator to emit unavailable Zod helpers.

**Why:** This workspace's generated server validators use Zod 3. OpenAPI UUID and integer annotations can generate `z.uuid()` and `z.int()` calls, which are not available in that version and break contract generation.

**How to apply:** When adding OpenAPI fields in this project, verify the generated Zod output. Use regular strings and numbers unless the active generator/version explicitly supports a more specific helper.

For date-time query parameters, configure Orval to coerce `date` query values so browser URL strings validate as `z.coerce.date()` rather than requiring an in-memory `Date`.

**Why:** HTTP query parameters always arrive as strings; a non-coerced generated `z.date()` rejects otherwise valid URL date ranges.

**How to apply:** After adding a date-based filter, regenerate the contract and inspect the generated query validator before wiring the Express route or client hook.