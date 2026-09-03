---
name: OpenStreetMap geocoding policy
description: Why recovery mapping is Google-free and public Nominatim requires explicit approval.
---

Use OpenStreetMap for recovery map links and embeds. Public Nominatim reverse geocoding is disabled by default and requires explicit low-volume approval; do not add Google mapping or geocoding APIs without a new explicit decision.

**Why:** Exact recovery coordinates are sensitive. Avoiding Google remains an approved constraint, but a public geocoder can retain coordinates in third-party logs even when requests are cached and rate-limited.

**How to apply:** Preserve raw coordinates as evidence. Enable public Nominatim only for approved testing, label its results `OSM_NOMINATIM`, persistently cache and serialize requests below one per second, cache failures, and use a self-hosted or approved provider for production.