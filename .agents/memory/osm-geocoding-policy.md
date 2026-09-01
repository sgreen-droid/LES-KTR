---
name: OpenStreetMap geocoding policy
description: Why recovery location enrichment is Google-free and how OSM public-service limits are applied.
---

Use OpenStreetMap/Nominatim as the recovery console's address source and OpenStreetMap for map links and embeds. Do not add Google mapping or geocoding APIs without a new explicit decision.

**Why:** The approved direction avoids Google API keys and billing while the testing fleet performs low-volume hourly collection.

**How to apply:** Preserve raw coordinates as evidence, label derived addresses `OSM_NOMINATIM`, cache results persistently, serialize public Nominatim requests below one per second, cache failures, and move to a self-hosted or approved OSM provider before high-volume recurring use.