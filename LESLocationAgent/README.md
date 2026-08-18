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
  "agentVersion": "1.0.0"
}
```

Also check `status.json`:

```json
{
  "lastAttemptUtc": "2026-08-11T18:35:42Z",
  "lastSuccessUtc": "2026-08-11T18:35:42Z",
  "permissionStatus": "Allowed",
  "locationStatus": "Success",
  "error": null
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

---

## STEP 17 — Run the Action1 sync script on your test endpoint

1. In the Action1 portal, go to **Automation → Scripts → Add Script**.
2. Upload `Action1-Location-Sync.ps1` (from the downloaded artifact).
3. Run it against your test PC.
4. Confirm the 9 Custom Attributes populate on the endpoint record.

**Location Status values:**

| Status | Meaning |
|---|---|
| ACTIVE | Location acquired, ≤ 30 minutes old |
| STALE | Location acquired, > 30 minutes old |
| NO LOCATION | No location has ever been acquired |
| PERMISSION DENIED | Windows location access is denied |
| ERROR | Missing file, bad JSON, or invalid coordinates |

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
2. Open `Action1-Install-LESLocationAgent.ps1` in a text editor.
3. Update these two lines:

```powershell
$InstallerUrl   = 'https://your-host.example.com/releases/LESLocationAgent.msi'
$ExpectedSha256 = 'PASTE_SHA256_FROM_SHA256-MANIFEST.txt'
```

4. Upload the script to Action1 and run it as a software deployment task.

The script will:
- Download the MSI from your URL
- Verify the SHA-256 hash (prevents tampered installers from running)
- Install silently
- Launch the app visibly for the logged-in user so Windows can prompt for location permission
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

If the installer completes but double-clicking the EXE (or the Start Menu shortcut) does nothing, or the app crashes immediately, the most likely cause is a missing or incompatible Windows App SDK runtime.

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

**Fix — Option A (preferred): re-download the installer from the latest GitHub Actions build.**

The CI pipeline verifies that `Microsoft.ui.xaml.dll` is bundled in every build. A build that passed CI is guaranteed to be self-contained. If you downloaded the MSI before this check was added, rebuild from `main`.

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
git tag v1.0.0
git push origin v1.0.0
```

That's it. GitHub Actions detects the `v*.*.*` tag, builds the MSI, and automatically creates a GitHub Release with the following files attached:

| File | Purpose |
|---|---|
| `LESLocationAgent.msi` | The installer — Action1 downloads this |
| `SHA256-MANIFEST.txt` | SHA-256 hash for integrity verification |
| `Action1-Install-LESLocationAgent.ps1` | Ready-to-use Action1 install script |
| `Action1-Location-Sync.ps1` | Action1 location sync script |
| `Action1-LESLocationAgent-Health.ps1` | Action1 health check script |

### Step 2 — Copy the SHA-256

Open `SHA256-MANIFEST.txt` from the release assets. Copy the long hash next to `SHA-256`.

### Step 3 — Update the install script

Open `Action1-Install-LESLocationAgent.ps1` and edit the two lines at the top:

```powershell
$InstallerUrl   = 'https://github.com/sgreen-droid/LES-KTR/releases/download/v1.0.0/LESLocationAgent.msi'
$ExpectedSha256 = 'PASTE-YOUR-HASH-HERE'
```

Then paste this updated script into Action1 → Automation → Scripts.

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

All writes are **atomic** (written to a temp file, then renamed) to prevent Action1 from reading a partially-written file.

---

*LES Location Agent collects only the device's geographic location as reported by Windows Location Services. It does not collect screenshots, keystrokes, browser history, files, camera data, microphone data, or any personal information.*
