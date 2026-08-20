# LES Location Agent

A small Windows 11 desktop application that obtains the most accurate GPS/Wi-Fi/cellular location Windows can provide, stores it locally, and makes it readable by **Action1 RMM**.

---

## Quick Summary

| What you do | How long |
|---|---|
| Push project to GitHub | ~2 minutes |
| Run GitHub Actions build | ~10–15 minutes |
| Download & install on Windows | ~2 minutes |
| Click Enable Location + Get Location | ~30 seconds |
| Action1 reads the coordinates | Automatic |

---

## STEP 1 — Put the project on GitHub

1. Go to [github.com/new](https://github.com/new) and create a **new private repository** named `LESLocationAgent`.
2. Download the project folder from Replit (use the Download as ZIP option).
3. Extract the ZIP. You should see folders like `src/`, `scripts/`, `installer/`, `.github/`.
4. Open a terminal or PowerShell window in that extracted folder.
5. Run these commands (replace `YOUR-USERNAME` with your GitHub username):

```
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/LESLocationAgent.git
git branch -M main
git push -u origin main
```

---

## STEP 2 — Open GitHub Actions

1. Go to your repository on GitHub.
2. Click the **Actions** tab at the top.
3. You will see a workflow named **Windows Build**.

---

## STEP 3 — Run the Windows Build

1. Click **Windows Build** in the left panel.
2. Click the **Run workflow** button (top-right of the workflow list).
3. Leave the branch as `main`.
4. Click the green **Run workflow** button.

> The build also runs automatically every time you push code to `main`.

---

## STEP 4 — Wait for the build to finish

- A green circle ✓ means success.
- A red circle ✗ means failure — click the run to see the error log.
- Expected build time: **10–15 minutes** (GitHub is downloading and compiling everything).

---

## STEP 5 — Open the completed build

1. Click the finished build run (green ✓).
2. Scroll to the bottom of the page.
3. Find the **Artifacts** section.

---

## STEP 6 — Download the installer

1. Click **LESLocationAgent-Windows** to download a ZIP file.
2. Save it to your computer.

---

## STEP 7 — Extract the installer

Open the downloaded ZIP. It contains:

```
LESLocationAgent.msi                       ← The installer
SHA256-MANIFEST.txt                        ← Hash for verification
Action1-Location-Sync.ps1                  ← Action1 sync script
Action1-Install-LESLocationAgent.ps1       ← Action1 remote deployment script
Action1-LESLocationAgent-Health.ps1        ← Action1 health check script
```

---

## STEP 8 — Move the installer to your Windows test PC

Copy `LESLocationAgent.msi` to the Windows 11 PC where you want to test.

---

## STEP 9 — Install LES Location Agent

Double-click `LESLocationAgent.msi`.

- A standard Windows installer dialog will appear.
- Click through and accept the default settings.
- The application will launch automatically after installation.

**Silent install** (for IT deployment):
```
msiexec /i LESLocationAgent.msi /quiet /norestart
```

**Silent uninstall:**
```
msiexec /x LESLocationAgent.msi /quiet /norestart
```

---

## STEP 10 — Open LES Location Agent

The application should open automatically. If not, find **LES Location Agent** in the Start Menu.

You will see:

```
Location Permission:      —
Windows Location Status:  —
Latitude:                 —
Longitude:                —
Accuracy:                 —
Altitude:                 —
Location Source:          Windows Geolocation
Position Source:          —
Last Updated:             —

[Enable Location]  [Get Location]  [Open Location Settings]

Status: Ready
```

---

## STEP 11 — Turn on Windows Location Services

Before clicking anything, make sure Windows Location is enabled:

1. Click **Open Location Settings** (or go to Settings → Privacy & Security → Location).
2. Turn on **Location services** (the top toggle).
3. Turn on **Let apps access your location**.

---

## STEP 12 — Click Enable Location

Click **[Enable Location]**.

Windows will display a permission dialog asking whether to allow LES Location Agent to access your location.

Click **Yes** / **Allow**.

The app will display: `✓ Allowed`

---

## STEP 13 — Click Get Location

Click **[Get Location]**.

The status bar will say "Requesting location…"

The app collects up to 3 readings over approximately 15–30 seconds and keeps the most accurate one.

---

## STEP 14 — Verify the coordinates

After the request completes, confirm you see:

| Field | Expected |
|---|---|
| **Latitude** | A number like `40.817391` |
| **Longitude** | A number like `-73.941502` |
| **Accuracy** | A number followed by "meters" and a quality label |
| **Location Source** | Windows Geolocation |
| **Position Source** | WiFi, Cellular, Satellite, or similar |
| **Last Updated** | The current date and time |

**Accuracy quality labels:**

| Label | Accuracy |
|---|---|
| EXCELLENT | ≤ 25 meters |
| GOOD | 26 – 100 meters |
| APPROXIMATE | 101 – 1,000 meters |
| LOW | > 1,000 meters |

> **Note:** Accuracy depends on what positioning hardware Windows can access.
> On a laptop with Wi-Fi, expect 15–150 meters. On a desktop without Wi-Fi, expect worse.

---

## STEP 15 — Verify location.json

Open File Explorer and navigate to:

```
C:\ProgramData\LESLocationAgent\
```

Open `location.json`. It should look like:

```json
{
  "latitude": 40.817391,
  "longitude": -73.941502,
  "accuracyMeters": 28.4,
  "accuracyQuality": "GOOD",
  "altitudeMeters": null,
  "altitudeAccuracyMeters": null,
  "headingDegrees": null,
  "speedMetersPerSecond": null,
  "positionSource": "WiFi",
  "locationSource": "Windows Geolocation",
  "permissionStatus": "Allowed",
  "timestampUtc": "2026-08-11T18:35:42Z",
  "computerName": "LES-LAPTOP-001",
  "agentVersion": "1.1.3",
  "deviceId": "d2719f71-a1cb-4ae2-b2fb-4ee88a008620",
  "recordSequence": 42,
  "integrityAlgorithm": "HMAC-SHA256-IEEE754LE",
  "integrityHmac": "..."
}
```

Also check `status.json`:

```json
{
  "lastAttemptUtc": "2026-08-11T18:35:42Z",
  "lastSuccessUtc": "2026-08-11T18:35:42Z",
  "permissionStatus": "Allowed",
  "locationStatus": "Success",
  "error": null,
  "lastHeartbeatUtc": "2026-08-11T18:35:42Z",
  "deviceId": "d2719f71-a1cb-4ae2-b2fb-4ee88a008620",
  "agentVersion": "1.1.0",
  "recordSequence": 42,
  "integrityStatus": "VALID",
  "agentHealth": "HEALTHY"
}
```

---

## STEP 16 — Set up Action1 Custom Attributes

In the **Action1 portal**, create these Custom Attributes (exact names, case-sensitive):

| Attribute Name | Type |
|---|---|
| Latitude | Text |
| Longitude | Text |
| Location Accuracy | Text |
| Location Quality | Text |
| Location Source | Text |
| Position Source | Text |
| Location Permission | Text |
| Location Updated | Text |
| Location Status | Text |
| Map Link | Text |
| Location Coordinates | Text |
| Location Summary | Text |
| Device ID | Text |
| Location Sequence | Text |
| Location Integrity | Text |
| Agent Health | Text |
| Agent Version | Text |
| Last Attempt | Text |
| Last Success | Text |
| Location Age Minutes | Text |
| Recovery Status | Text |
| Location Error | Text |

---

## STEP 17 — Run the Action1 sync script on your test endpoint

1. In the Action1 portal, go to **Automation → Scripts → Add Script**.
2. Upload `Action1-Location-Sync.ps1` (from the downloaded artifact).
3. Run it against your test PC.
4. Confirm the location and recovery Custom Attributes populate on the endpoint record.

**Location Status values:**

| Status | Meaning |
|---|---|
| ACTIVE | Location acquired, ≤ 30 minutes old |
| STALE | Location acquired, > 30 minutes old |
| NO LOCATION | No location has ever been acquired |
| PERMISSION DENIED | Windows location access is denied |
| ERROR | Missing file, bad JSON, or invalid coordinates |

**Recovery attributes**

- `Device ID` is a random installation identity. It is not derived from a
  serial number, MAC address, or user account.
- `Location Sequence` only increases for new successful location records. A
  gap is safer than reusing a record number after an interrupted write.
- `Location Integrity` is `VALID` when the agent can verify the current
  record, `LEGACY` for pre-1.1 records, `MISSING` before the first fix, and
  `INVALID` when the current file does not verify. It is an
  unexpected-change indicator, not proof against the active local user.
- `Agent Health`, `Last Attempt`, `Last Success`, `Location Age Minutes`, and
  `Recovery Status` are the recommended fields for Action1 alert policies.

---

## Automatic Location Updates

After the first successful location is acquired, the app:

- **Runs automatically when the user signs into Windows** (stored in the Windows startup registry under the user's account — no admin rights needed at runtime).
- **Refreshes the location every 15 minutes** by default.
- **Normally runs minimised to the system tray.** Look for the LES Location Agent icon near the clock.

**Tray icon menu:**
- **Open LES Location Agent** — brings the window to the front
- **Update Location** — triggers an immediate refresh
- **Location Status** — shows the last update time
- **Exit** — closes the application

### Changing the refresh interval

Edit (or create) `C:\ProgramData\LESLocationAgent\config.json`:

```json
{
  "refreshMinutes": 15,
  "desiredAccuracyMeters": 10,
  "locationTimeoutSeconds": 30
}
```

Minimum permitted refresh interval: **5 minutes**.

---

## Deploying via Action1

Use `Action1-Install-LESLocationAgent.ps1` to deploy silently to many PCs:

1. Host `LESLocationAgent.msi` on an internal HTTPS server (or GitHub Releases).
2. For a tagged GitHub release, download the included
   `Action1-Install-LESLocationAgent.ps1` without editing it. It is already
   pinned to that release and its exact SHA-256 hash.
3. For a privately hosted MSI, set both the trusted HTTPS URL and the
   SHA-256 value in the script before uploading it to Action1.
4. Upload the script to Action1 and run it as a software deployment task.

The script will:
- Download the MSI from your URL
- Verify the SHA-256 hash (prevents tampered installers from running)
- Install silently
- Start the agent at the next interactive user sign-in
- Report SUCCESS or FAILURE

---

## Health Check

Run `Action1-LESLocationAgent-Health.ps1` on any endpoint to report:

- Installed: YES/NO
- Agent version
- Last successful location time
- Location age
- Permission status
- Latitude, longitude, accuracy, quality

---

## Recovery Operations

Use Action1 to create alert policies from the recovery attributes:

| Condition | Recommended Action1 response |
|---|---|
| `Recovery Status = STALE` or `Location Age Minutes > 30` | Investigate connectivity, power state, and whether the device is still assigned. |
| `Recovery Status = NO LOCATION` | Confirm Windows Location Services and the device's Wi-Fi/GPS capability. |
| `Location Permission = Denied` | Contact the assigned user or apply the organization-approved Windows location policy. |
| `Location Integrity = INVALID` | Treat the displayed coordinates as untrusted. Preserve the endpoint record and investigate the device. |
| `Agent Health = ERROR` or missing agent fields | Run the health check, confirm the agent version, then reinstall through the approved Action1 deployment if necessary. |

For a missing or stolen device:

1. Search Action1 using `Device ID`, device serial number, and computer name.
2. Review `Last Success`, `Location Updated`, and `Map Link` as the **last
   known** location—not a live guarantee.
3. Preserve the Action1 record and associated IT/security case information.
4. Follow your organization’s incident-response, legal, and law-enforcement
   procedures. Do not attempt recovery based solely on location data.

The agent can report only while Windows is running, the endpoint can execute
the Action1 task, and Windows can obtain a usable location. It cannot locate a
powered-off, offline, wiped, or otherwise unreachable device.

The MSI registers the agent for every user at sign-in, but the agent keeps a
machine-wide file lease so only one active tray process writes the shared
recovery files at a time.

### Privacy and access policy

Deploy this only to organization-owned devices under a written device-management
notice. Limit Action1 location access to authorized IT/security staff, document
retention and deletion periods, and collect only the fields needed for recovery.
The agent does not provide remote control, lock/wipe, keystroke capture,
webcam/microphone access, or location collection outside Windows Location
Services.

---

## Code Signing (Production)

The test build is **unsigned**. Windows SmartScreen may warn users when they run the MSI.

For production deployment:
1. Obtain a code-signing certificate from a certificate authority (e.g. DigiCert, Sectigo, GlobalSign). EV certificates remove SmartScreen warnings immediately; OV certificates build reputation over time. Cost is typically $200–$500/year.
2. Export the certificate as a `.pfx` file and base64-encode it:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('cert.pfx')) | clip
   ```
3. In your GitHub repository, go to **Settings → Secrets and Variables → Actions**.
4. Add two secrets:
   - `CODE_SIGN_PFX` — the base64-encoded `.pfx` content
   - `CODE_SIGN_PASSWORD` — the password protecting the `.pfx`
5. Push any commit to `main` (or trigger **Run workflow** manually).

The **Sign MSI (production)** step in the workflow runs automatically whenever `CODE_SIGN_PFX` is present. Development builds that lack the secret are left unsigned without any code change. After signing, the workflow also runs `signtool verify` to confirm the signature is valid before the MSI is packaged into the release artifact.

Signed installers show your publisher name in Windows SmartScreen instead of "Unknown publisher" and are required for enterprise deployment without Group Policy exceptions.

---

## Troubleshooting

### Location is inaccurate

- Make sure Wi-Fi is enabled (even if not connected to a network — Wi-Fi scanning improves location).
- If indoors, move near a window.
- Location accuracy depends on what Windows can see: GPS satellite, nearby Wi-Fi networks, and cellular towers all contribute.
- Desktop PCs without Wi-Fi adapters will typically show LOW or APPROXIMATE accuracy — this is a hardware limitation.
- Click **Get Location** again; a second attempt sometimes yields better results.

### Permission denied

1. Click **Open Location Settings** (or go to Settings → Privacy & Security → Location).
2. Make sure **Location services** is ON.
3. Make sure **Let desktop apps access your location** is ON (scroll down on that settings page).
4. Click **Enable Location** in the app again.
5. If the problem persists, restart the app.

### Location unavailable

- Check that Windows Location Services is enabled (Settings → Privacy & Security → Location).
- If the PC has no GPS, Wi-Fi, or cellular modem, Windows cannot determine location.
- Check `C:\ProgramData\LESLocationAgent\status.json` for the `locationStatus` and `error` fields.
- Review the Windows Event Log for Location-related errors.

### App won't start after installation

If the installer completes but double-clicking the EXE (or the Start Menu shortcut) does nothing, or the app crashes immediately, the most likely cause is a missing or incompatible Windows App SDK runtime. Windows 11 already meets the agent's minimum operating-system requirement, so this message does **not** mean that a Windows 11 PC needs an OS upgrade.

**What you will see (starting with current builds):**

When the app detects a load failure it shows a dialog like:

> *LES Location Agent could not start because a required Windows App SDK component failed to load.*
> *Missing DLL: Unable to load DLL 'Microsoft.ui.xaml.dll' …*
> *To fix this, download and run the Windows App SDK runtime installer on this PC …*

The same information is written to the **Windows Application Event Log** so IT staff can investigate without needing to reproduce the crash interactively.

**How to read the Event Log entry:**

1. Open **Event Viewer** (press `Win + R`, type `eventvwr`, press Enter).
2. Expand **Windows Logs → Application**.
3. Filter by **Source = LESLocationAgent** (Action pane → Filter Current Log…).
4. Look for **Event ID 1000** with Level = Error.

The entry contains:
- The exception type (`DllNotFoundException` or `TypeLoadException`)
- The exact DLL name or type that failed to load
- A full stack trace for deeper diagnosis

**Fix — Option A (preferred): reinstall the latest MSI and launch it from its Start Menu shortcut.**

The CI pipeline verifies that `Microsoft.ui.xaml.dll` is bundled in every build. A build that passed CI includes the required WinUI runtime DLL. Do not copy only `LESLocationAgent.exe` to another folder; it must run with the files installed beside it. If you downloaded the MSI before this check was added, rebuild from `main`.

**Fix — Option B: install the Windows App SDK runtime manually.**

Download and run the Windows App SDK runtime installer from Microsoft:

```
https://aka.ms/windowsappsdk/1.6/latest/windowsappruntimeinstall-x64.exe
```

Run it once on the affected PC, then launch LES Location Agent again.

**Fix — Option C: check that you are running the x64 build on an x64 PC.**

The MSI targets Windows x64. ARM64 PCs without x64 emulation may fail to load the bundled DLLs. Contact your administrator.

---

### App does not start with Windows

- Open the app manually, then close it to the tray. The startup entry is written on the first launch.
- Or run this PowerShell command:
  ```powershell
  Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' `
      -Name 'LESLocationAgent' -Value '"C:\Program Files\LES Location Agent\LESLocationAgent.exe" --startup'
  ```

### location.json not found

- Run **Get Location** at least once. The file is not created until a successful fix is obtained.
- Check `status.json` to see the last attempt result and any error messages.

---

## Publishing a release for Action1 deployment

When you are ready to deploy to endpoints, publish a tagged GitHub Release so Action1 can download the MSI from a permanent public URL.

### Step 1 — Tag and push

Run these commands locally (or in any terminal with git access):

```powershell
git tag v1.1.3
git push origin v1.1.3
```

That's it. GitHub Actions detects the `v*.*.*` tag, builds the MSI, and automatically creates a GitHub Release with the following files attached:

| File | Purpose |
|---|---|
| `LESLocationAgent.msi` | The installer — Action1 downloads this |
| `SHA256-MANIFEST.txt` | SHA-256 hash for integrity verification |
| `Action1-Install-LESLocationAgent.ps1` | Ready-to-use Action1 install script |
| `Action1-Location-Sync.ps1` | Action1 location sync script |
| `Action1-LESLocationAgent-Health.ps1` | Action1 health check script |

### Step 2 — Use the preconfigured installer script

For a tagged release, download `Action1-Install-LESLocationAgent.ps1` from the
release assets and paste it directly into Action1 → Automation → Scripts. The
release build injects the exact release URL and the **final** SHA-256 after any
optional code signing.

For private hosting, use `SHA256-MANIFEST.txt` and update both the installer URL
and hash together. The installer deliberately fails if either value is missing
or the hash does not match.

### For future releases

Each new build gets a new tag with a higher version number:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

Then update `$InstallerUrl` and `$ExpectedSha256` in your Action1 script to match the new release.

---

## Project Structure

```
LESLocationAgent/
├── src/
│   ├── LESLocationAgent.Core/     ← Platform-agnostic models, services, helpers
│   └── LESLocationAgent/          ← WinUI 3 desktop application
├── installer/
│   ├── Package.wxs                ← WiX v5 MSI definition
│   └── LESLocationAgent.wixproj  ← WiX project file
├── scripts/
│   ├── Action1-Location-Sync.ps1
│   ├── Action1-Install-LESLocationAgent.ps1
│   └── Action1-LESLocationAgent-Health.ps1
├── tests/
│   └── LESLocationAgent.Tests/    ← xUnit tests (run on any OS)
├── .github/
│   └── workflows/
│       └── windows-build.yml      ← GitHub Actions CI pipeline
└── README.md                      ← This file
```

---

## Data files written to disk

| File | Purpose |
|---|---|
| `C:\ProgramData\LESLocationAgent\location.json` | Latest successful coordinates |
| `C:\ProgramData\LESLocationAgent\status.json` | Status of every attempt |
| `C:\ProgramData\LESLocationAgent\config.json` | Configuration (refresh interval, etc.) |
| `C:\ProgramData\LESLocationAgent\agent-state.json` | Machine-local recovery identity, sequence counter, and integrity key. Do not edit or copy between devices; it detects unexpected changes but is not a defense against a user who can read and replace this file. |

All writes are **atomic** (written to a temp file, then renamed) to prevent Action1 from reading a partially-written file.

---

*LES Location Agent collects only the device's geographic location as reported by Windows Location Services. It does not collect screenshots, keystrokes, browser history, files, camera data, microphone data, or any personal information.*
