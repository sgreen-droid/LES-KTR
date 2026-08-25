# LES Location Agent — Recovery Operations Runbook

This runbook is for authorized IT, security, and asset-management staff operating
LES Location Agent on **company-owned Windows 11 devices only**. It describes
last-known recovery telemetry; it is not a live tracking or remote-control
system.

## 1. Operating boundaries

- The agent reports only while Windows is running, the endpoint can execute an
  Action1 task, the Action1 service is reachable, and Windows can obtain a
  usable location.
- A powered-off, disconnected, wiped, sleeping-without-network, or
  location-disabled PC cannot be located by this system.
- A location timestamp is the endpoint's last successful reading. An Action1
  refresh timestamp is when the management system last returned endpoint data.
  Neither is a promise that the device is currently at that location.
- Never use a map point alone to approach a person, enter property, or recover
  equipment. Follow security, legal, insurance, and law-enforcement procedures.
- The system intentionally does not provide remote lock/wipe, covert
  surveillance, webcam or microphone access, keystroke capture, or Windows
  security bypasses.

## 2. Enrollment and deployment checklist

Complete this checklist before placing a device in the protected recovery
scope. The asset owner or IT manager signs off on the ownership and notice
items.

### Company and access controls

- [ ] Confirm the PC is company-owned or covered by a written organization
  device-management agreement.
- [ ] Record the asset tag, manufacturer serial number, assigned owner/cost
  center, and business unit in the organization's asset system.
- [ ] Confirm the Action1 endpoint is mapped to the same asset record. Record
  the Action1 endpoint identifier and the agent's stable `Device ID` after the
  first run.
- [ ] Give only authorized IT/security personnel access to Action1 location
  attributes and the Recovery Console. Use individual accounts and log
  administrative access; do not share the console password.
- [ ] Provide the organization's device-management and location notice before
  enabling collection. Record the applicable policy or notice version.

### Windows and agent prerequisites

- [ ] Confirm Windows 11 client edition, build 22000 or later, x64, with
  Windows Location Services enabled.
- [ ] Confirm **Let apps access your location** and **Let desktop apps access
  your location** are enabled by the approved organization policy.
- [ ] Confirm the device has a usable location source such as Wi-Fi scanning,
  cellular, or GPS. Accuracy depends on the hardware and environment.
- [ ] Install the approved, hash-verified MSI through the signed release or an
  approved Action1 deployment.
- [ ] Confirm the agent starts at the next interactive sign-in and writes
  `C:\ProgramData\LESLocationAgent\location.json`,
  `status.json`, and `agent-state.json`.
- [ ] Use the agent UI or Windows settings to complete the required location
  consent. Do not silently bypass a user-facing organization policy.
- [ ] Run `Action1-LESLocationAgent-Health.ps1` and retain the result with the
  asset onboarding record.

### Action1 attribute contract

Create these exact, case-sensitive **Text** custom attributes before the
production sync. The sync keeps its established core attributes working if
new optional recovery attributes have not yet been created, but the recovery
views and alerts are clearest when all are present.

| Group | Attributes |
| --- | --- |
| Location | `Latitude`, `Longitude`, `Location Accuracy`, `Location Quality`, `Location Source`, `Position Source`, `Location Permission`, `Location Updated`, `Location Status`, `Map Link`, `Location Coordinates`, `Location Summary` |
| Identity and integrity | `Device ID`, `Location Sequence`, `Location Integrity` |
| Health and freshness | `Agent Health`, `Agent Version`, `Last Attempt`, `Last Success`, `Location Age Minutes`, `Recovery Status`, `Location Error` |

The Action1 endpoint, serial number, hostname/computer name, asset tag, and
stable `Device ID` are complementary identifiers:

- Search by serial and asset tag for the authoritative inventory record.
- Search by hostname/computer name for the user-facing endpoint identity.
- Search by Action1 endpoint ID for the management record.
- Search by `Device ID` for the agent installation identity. It is random and
  is not derived from a serial number, MAC address, or user account.
- If an installation is replaced, record the new `Device ID` as a new
  installation identity rather than silently rewriting historical evidence.

## 3. Operational lifecycle and ownership

| State | Entry condition | Primary owner | Required handoff |
| --- | --- | --- | --- |
| Enrolling | Asset is company-owned and prerequisites are being checked | IT asset manager | Asset record, Action1 endpoint, owner, and notice confirmation |
| Verified | Healthy check-in, valid integrity, and expected version | Endpoint operations | Routine Action1 health automation |
| Attention required | Stale, no location, denied permission, error, invalid integrity, or version drift | Endpoint operations | Create/attach an incident when loss, tampering, or material risk is suspected |
| Missing/stolen | Owner reports the PC missing or security identifies loss | Service desk or security | Preserve evidence, notify security/asset owner, and open an incident |
| Escalated | Security determines legal, insurance, or law-enforcement involvement is appropriate | Security lead | Case number, evidence export, chain of custody, and approved communications |
| Recovered | Asset is physically recovered and custody is documented | Asset owner + security | Preserve the incident, inspect/reimage as policy requires, and record recovery time |
| Replaced/decommissioned | Asset is retired, wiped, or replaced | IT asset manager | Retain evidence per policy, revoke access, and remove from active alert scope |

## 4. Action1 operations pack

Create saved searches or equivalent scheduled automations using the following
conditions. Run routine checks at least every 15 minutes when the organization
needs timely freshness detection; use a longer interval only when approved by
the endpoint operations owner.

| Search/automation | Condition and threshold | Recommended action |
| --- | --- | --- |
| Fresh and healthy | `Recovery Status = ACTIVE`, `Location Status = ACTIVE`, `Location Integrity = VALID`, and `Agent Health` is healthy | No incident action. Record the scheduled check result. |
| Stale telemetry | `Recovery Status = STALE` or `Location Age Minutes > 30` | At 30 minutes, verify network, power, assignment, and Action1 task execution. At 120 minutes, notify endpoint operations. At 24 hours, treat as offline/missing until confirmed and contact the asset owner. |
| No location | `Recovery Status = NO LOCATION` or `Location Status = NO LOCATION` | Check Location Services, desktop-app access, hardware capability, and the local status file. Do not create a map link from an absent reading. |
| Permission denied | `Location Permission = Denied` or `Location Status = PERMISSION DENIED` | Confirm the approved Windows policy and user notice. Do not instruct staff to bypass policy. Remediate through approved IT policy or record the device as unable to provide location. |
| Integrity failure | `Location Integrity = INVALID` or `Agent Health = INTEGRITY FAILED` | Treat coordinates as untrusted. Preserve the Action1 record, open a security review, and reinstall or inspect only through approved procedures. |
| Agent error | `Recovery Status = ERROR`, `Agent Health = ERROR`, or `Location Error` is populated | Run the read-only health script, check installed version and files, then use the hash-pinned deployment path if reinstall is approved. |
| Version drift | `Agent Version` does not equal the organization's approved release | Schedule an approved update after checking the release hash and compatibility. Keep the endpoint in attention-required state until the health check passes. |
| Action1 access failure | The scheduled automation cannot authenticate, cannot read endpoints, or the Recovery Console reports Action1 unavailable | Stop repeated credential probing. Check the Action1 role, connector status, and provider cooldown; honor any `Retry-After` period. Record the outage separately because missing Action1 data is not evidence that an endpoint is powered off. |

Keep notification recipients limited to the endpoint operations queue, security
on-call, and the asset owner or delegate. Do not send coordinates to broad
mailing lists or include them in ordinary chat channels.

## 5. Missing or stolen PC response

### First 15 minutes: identify and preserve

1. Confirm the report is for a company-owned asset and record the reporter,
   time received, asset tag, serial number, assigned owner, and location of
   last custody.
2. Search Action1 by **serial number**, **hostname/computer name**, **Action1
   endpoint ID**, and **stable Device ID**. Resolve conflicting matches with
   the asset system; do not assume a hostname alone is unique.
3. Review `Last Success`, `Location Updated`, `Last Attempt`, `Location Age
   Minutes`, `Recovery Status`, `Endpoint Status`, and `Location Integrity`.
4. Read `Location Accuracy`, `Location Quality`, `Position Source`, and
   `Location Summary` together. A low-quality or old point is an uncertain
   last-known observation, not a live location.
5. Create a Recovery Console incident and select the matching endpoint. Use a
   clear title, the organization's case number, the accountable owner, and a
   factual initial note. The incident captures a database snapshot of the
   Action1 data and its source refresh time.
6. Export JSON for machine-readable case systems and CSV for administrative
   use. Use the print-ready export when a signed or physically retained
   report is required. Record who exported it and when.

### Escalation decision

- Notify the security lead immediately for suspected theft, tampering,
  sensitive-data exposure, an integrity failure, or an unknown custodian.
- Notify the asset owner and service desk for assignment confirmation,
  accidental loss, or a stale endpoint requiring a welfare/check-in call.
- Involve legal, insurance, or law enforcement according to the organization's
  incident policy and jurisdiction. Provide the preserved incident export,
  asset ownership record, and custody timeline; do not represent telemetry as
  proof of a person's location.
- Do not send staff to a map point or contact a suspected possessor based only
  on this system.

### Offline and powered-off interpretation

If the endpoint has no recent Action1 check-in, the last successful reading is
still only historical evidence. A powered-off or disconnected PC cannot run the
Action1 task or obtain a new Windows location. Record the uncertainty and
continue through asset, security, insurance, and law-enforcement channels.

## 6. Dashboard-to-runbook field check

The Recovery Console should be used as follows:

- **Fleet Radar** is the current Action1 snapshot. Its refresh time is the
  management-data retrieval time, not a device location time.
- **Endpoint status** and `Recovery Status` describe check-in/recovery
  conditions. `Location Status` distinguishes `ACTIVE`, `STALE`, `NO
  LOCATION`, `PERMISSION DENIED`, and `ERROR`.
- **Location Integrity** is an unexpected-change indicator. `VALID` means the
  agent verified the current record; it is not proof against the active local
  user or proof that a map point is live.
- **Endpoint detail** shows the available map and the reported update time.
  If integrity is invalid or coordinates are unavailable, treat the map as
  unavailable/untrusted.
- **Incident evidence** is immutable captured evidence. It is explicitly
  labeled last-known and includes both evidence capture time and the Action1
  source refresh time.
- **Incident audit** records creation, edits, notes, and exports. Use the
  export controls rather than copying credentials or provider internals into
  a case.

## 7. Privacy, retention, and access

- Collect only the fields needed for company-asset recovery. Do not add
  webcam, microphone, keystroke, or covert-surveillance data.
- Publish a clear employee/device-management notice describing Windows
  Location Services, the company-owned-device scope, access roles, purpose,
  and retention period before deployment.
- Grant Action1 and Recovery Console access by least privilege. Separate
  endpoint operators, security investigators, asset managers, and auditors
  where the organization's controls support it.
- Set and document retention periods for Action1 attributes, incident
  snapshots, audit records, and exported files. Store exports only in the
  approved case repository, with access logging and secure deletion at the
  end of the retention period.
- Do not put location data in public issue trackers, unrestricted email, or
  chat. Redact unnecessary personal data from reports shared outside the
  response team.
- Preserve the original incident export when required by legal hold or
  insurance procedure; otherwise follow the organization's approved deletion
  schedule.

## 8. Acceptance checklist

Run this checklist on a company-owned test endpoint or a controlled Action1
fixture. Record the Action1 run ID, test time, agent version, and expected
result. Do not use a real employee's private device as a test fixture.

| Scenario | Setup | Expected result |
| --- | --- | --- |
| Healthy endpoint | Windows running; location allowed; valid signed record; recent Action1 sync | `ACTIVE`, valid coordinates, accuracy/source fields populated, no warning; dashboard says last-known rather than live |
| Stale/disconnected endpoint | Stop successful updates or use a record older than 30 minutes | `STALE`; old timestamp and age visible; operator is told to investigate connectivity/power and not live-track |
| Permission denied | Disable Windows location access under the approved policy | `PERMISSION DENIED`; no new map point; remediation points to policy/settings, not a bypass |
| Invalid/tampered data | Alter a signed location field or use out-of-range/NaN/infinite coordinates | `ERROR`/integrity failure; map fields are not refreshed; coordinates are treated as untrusted |
| Action1 access failure | Use a controlled provider outage/invalid role fixture | Safe unavailable error; no fabricated endpoint state; retry cooldown is honored and the outage is recorded |
| Powered-off PC | Power off the test endpoint and wait beyond the freshness threshold | No new reading; last successful reading remains historical; operator is explicitly told the PC cannot be located while powered off |
| Incident preservation | Select the fixture endpoint and create an incident | Incident survives reload; evidence includes Action1 source refresh time; audit includes creation |
| Evidence handoff | Update status/owner/note and export JSON, CSV, and print formats | Audit entries are present; exports contain no credentials or HMAC keys; CSV opens as data, not executable formulas |

Record failures as operational defects and do not mark the deployment ready
until the expected interpretation—not merely a non-empty coordinate—is shown.