# LES Location Agent Threat Model

## Project Overview

LES Location Agent is a recovery system for authorized, company-owned Windows endpoints. A self-contained Windows agent records last-known location and health data under `C:\ProgramData\LESLocationAgent`; an Action1 automation validates and publishes selected attributes; a TypeScript/Express API reads Action1, enriches locations through OpenStreetMap Nominatim, persists location history and immutable incident evidence in PostgreSQL, and serves a React Recovery Console.

The system handles unusually sensitive data: exact endpoint coordinates, addresses, movement-derived information, device and organization identifiers, incident records, and administrative credentials. It is a recovery tool, not a live-tracking or covert-surveillance system.

## Assets

- **Exact and historical location data** — coordinates, addresses, cross streets, timestamps, accuracy, apparent movement, and map links can reveal the whereabouts and history of company devices and potentially people near them.
- **Endpoint identity** — Action1 endpoint IDs, device IDs, serial numbers, computer names, organization names, models, operating systems, and health metadata can support targeting or impersonation.
- **Incident evidence and audit history** — incident snapshots, notes, exports, and audit events must remain confidential, complete, and attributable.
- **Administrative access** — Recovery Console credentials and sessions permit fleet-wide reads, exports, and incident mutations.
- **Application secrets** — Action1 credentials, database credentials, session signing material, and the dashboard password can expose the entire system if disclosed.
- **Agent integrity material** — the endpoint HMAC key and sequence state establish the authenticity and ordering of local observations.
- **Release trust** — the signing certificate, MSI, installer scripts, hashes, GitHub workflow, and release assets determine what code reaches managed endpoints.

## Trust Boundaries

- **Windows user/process to agent data directory** — untrusted local users and processes must not read integrity keys or alter trusted location/state files.
- **Windows agent to Action1 automation** — local files cross into a management platform through a privileged script; invalid or legacy data must not be treated as verified.
- **Action1 to API server** — externally supplied endpoint attributes are untrusted input even when retrieved with valid API credentials.
- **API server to PostgreSQL** — the server can persist and retrieve fleet-wide sensitive records; queries and retention operations must be bounded and authorized.
- **API server to Nominatim/OpenStreetMap** — exact coordinates sent for geocoding or mapping leave the controlled environment and may enter third-party logs.
- **Browser to API server** — the browser and all request fields are untrusted; authentication, authorization, validation, rate limiting, and export controls belong on the server.
- **Authenticated operator to privileged operation** — viewing current data, viewing history, exporting evidence, and modifying incidents carry different disclosure and integrity risks.
- **Development to production** — test data, debug behavior, development dependencies, and non-production credentials must not cross into production.
- **GitHub build to endpoint installation** — source, dependencies, build actions, signing, release publication, checksum verification, and Action1 deployment form one supply chain.

## Scan Anchors

- API entry and request middleware: `artifacts/api-server/src/app.ts`
- Authentication, sessions, route protection, exports: `artifacts/api-server/src/lib/recovery-session.ts`, `artifacts/api-server/src/routes/recovery.ts`
- Action1 ingestion and third-party geocoding: `artifacts/api-server/src/lib/action1-recovery.ts`, `artifacts/api-server/src/lib/osm-geocoder.ts`
- Sensitive persistence and evidence generation: `lib/db/src/schema/recovery-incidents.ts`, `artifacts/api-server/src/lib/recovery-history.ts`, `artifacts/api-server/src/lib/recovery-incidents.ts`
- Endpoint integrity and Action1 publication: `LESLocationAgent/src`, `LESLocationAgent/scripts/Action1-Location-Sync.ps1`
- Installer and release supply chain: `LESLocationAgent/installer/Package.wxs`, `.github/workflows/windows-build.yml`
- Public surface: Recovery Console login is public; all recovery data routes are session-protected but currently share one administrative privilege level.
- Dev-only surfaces: `artifacts/mockup-sandbox`, generated test fixtures, and Vite development servers must not be production-routable.

## Threat Categories

### Spoofing

A shared password and bearer-style signed cookie do not identify an individual operator. A stolen cookie remains valid until expiry because sessions are not server-revocable. Process-local login throttling resets on restart and does not coordinate across replicas.

The system MUST use individually attributable operator identities with MFA. Every privileged request MUST validate a short-lived, server-revocable session. Login and abuse controls MUST use a trusted proxy configuration and a shared, bounded rate-limit store.

### Tampering

The agent signs observations with HMAC-SHA256 and the sync script rejects invalid records, but an attacker who can read or replace the local integrity key can generate valid-looking observations. Ordinary runtime file creation under ProgramData does not by itself guarantee restrictive ACLs. Action1 values and all browser inputs remain untrusted.

The agent data directory MUST grant only SYSTEM, administrators, and the minimum required service identities access. Integrity keys MUST be machine-protected, preferably with DPAPI or a non-exportable machine key. Startup MUST validate directory and file ACLs. API inputs MUST remain schema-validated, database access MUST remain parameterized, and immutable incident snapshots MUST not be rewritten.

### Repudiation

A shared console identity prevents reliable attribution. Current audit records can say that an operator acted, but cannot prove which operator viewed, exported, or changed evidence.

Every login, sensitive read, export, incident change, and administrative action MUST record an immutable event tied to a verified operator identity, timestamp, request identifier, action, scope, and outcome. Audit records MUST exclude secrets and unnecessary location payloads and MUST have separate retention and access controls.

### Information Disclosure

The API, database, Action1 attributes, reports, and local agent files contain exact location and endpoint identity. Public Nominatim requests and OpenStreetMap links disclose exact coordinates to a third party. Exported CSV, JSON, and print files can escape server controls after download. Application errors and operational logs can become secondary leak paths.

Access MUST follow least privilege and organization/endpoint scope. Exact coordinates, address detail, history, and exports MUST require explicit permissions. Responses and Action1 field requests MUST be minimized. Public geocoding MUST be disabled for sensitive production use unless formally approved; an approved or self-hosted provider is preferred. Logs MUST redact credentials, cookies, request bodies, exact coordinates, addresses, and provider responses. Sensitive responses MUST use `no-store`; exports MUST be audited, classified, optionally watermarked, and governed by secure handling and deletion rules.

### Denial of Service

Authentication and export throttles are process-local, some protected read and mutation routes are not rate-limited, and history/geocoding operations can be expensive. Vulnerable parser and build dependencies can introduce memory or CPU exhaustion paths.

All externally reachable routes MUST have shared rate limits and request-cost bounds. Query date ranges, endpoint counts, result counts, request bodies, parser depth, external-call concurrency, and timeouts MUST be capped. Production dependencies MUST be scanned continuously, and releases MUST block on unresolved critical or exploitable high-severity findings.

### Elevation of Privilege

Any valid Recovery Console session currently receives fleet-wide read, export, and incident-management authority. There is no server-side role or organization scope to prevent a lower-privilege operator from accessing every endpoint or exporting all history.

The API MUST enforce server-side RBAC and organization/endpoint scope on every route and database query. Viewing current status, viewing exact history, exporting evidence, changing incidents, and administering access MUST be separate permissions. Frontend checks MUST never be treated as authorization.

### Supply-Chain Compromise

Release builds can currently publish unsigned MSI assets when signing secrets are absent. Build and release run in one job with repository write permission, third-party actions use floating major tags, and release trust depends on the same runner that builds and publishes the files.

Tagged releases MUST fail closed unless the MSI is signed and the signature verifies. Build and publication SHOULD use separate jobs with least privilege and protected environments. Third-party actions SHOULD be pinned to reviewed commit hashes. Dependencies and tools SHOULD be locked and verified. Releases SHOULD include an SBOM and signed provenance, and Action1 deployment MUST verify both the expected signer and exact release hash before installation.

## Required Security Guarantees

- No secret, session token, password, integrity key, or database credential may be committed, returned to the browser, included in an export, or written to logs.
- Exact location and history may be accessed only by an authenticated, authorized, individually attributable operator with explicit scope.
- Sensitive reads and exports must be auditable without duplicating the sensitive payload in the audit log.
- Location, geocoding-cache, incident, audit, and export records must have documented retention and deletion rules; legal holds must be explicit.
- Third-party location disclosure must be documented, approved, minimized, and disableable.
- Endpoint observations marked valid must be bound to protected machine integrity material and a monotonic sequence.
- Production releases must be reproducible enough to identify source, dependencies, signer, hash, and provenance, and must fail closed when required verification is absent.