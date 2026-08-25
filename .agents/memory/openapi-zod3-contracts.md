---
name: OpenAPI Zod 3 contract compatibility
description: Portable schema conventions for this workspace's generated Zod validators.
---

Use portable string and number schema declarations for generated request and response contracts rather than OpenAPI annotations that cause the generator to emit unavailable Zod helpers.

**Why:** This workspace's generated server validators use Zod 3. OpenAPI UUID and integer annotations can generate `z.uuid()` and `z.int()` calls, which are not available in that version and break contract generation.

**How to apply:** When adding OpenAPI fields in this project, verify the generated Zod output. Use regular strings and numbers unless the active generator/version explicitly supports a more specific helper.