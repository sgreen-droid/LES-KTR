---
name: WinUI3 XBF loader failure
description: LoadComponent "XAML parsing failed" in self-contained unpackaged WinUI 3 apps, and Windows location consent auto-grant.
---

## Rule
In a self-contained unpackaged WinUI 3 app (`WindowsPackageType=None`, `WindowsAppSDKSelfContained=true`), `Application.LoadComponent` (called by `InitializeComponent`) can fail with "XAML parsing failed" **independent of XAML content**. Four content edits (fonts, ThemeResource keys, resource removal) all crashed identically.

**Fix:** Bypass XBF entirely — delete the window's `.xaml`, make the class non-partial, construct all controls in C# in the constructor, set `this.Content = rootGrid`. Look up styles at runtime with `Application.Current.Resources.TryGetValue("AccentButtonStyle", ...)` — never `{StaticResource}` at parse time.

**Why:** The XBF binary loader is the failure point; no XAML content change can fix it. Code-built UI removes the loader from the path entirely.

**How to apply:** If "XAML parsing failed" at `InitializeComponent` survives 2+ content edits in an unpackaged WinUI 3 app, stop editing XAML and rebuild the window in code.

## Location consent auto-grant
Pre-grant Windows location permission (no OS dialog) by writing:
`HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location` → `Value = "Allow"` (string).
- Write it at app startup AND in the installer; on multi-user machines write it **before** any single-instance early exit, or second-user sessions never get it.
- A per-machine MSI's HKCU write only affects the installing identity (often SYSTEM under RMM deployment) — the app-startup write is the reliable path.

## Geolocation numeric values
Treat every numeric value from `Windows.Devices.Geolocation` as untrusted before JSON serialization. A WiFi/IP position can report `NaN` or positive/negative infinity for optional telemetry (altitude, altitude accuracy, heading, speed) and occasionally accuracy.

**Rule:** At the location-file boundary, retain only finite optional values and omit the rest. Reject non-finite coordinates; map a non-finite accuracy to `0` with `UNKNOWN` quality so a good coordinate update is not discarded.

**Why:** `System.Text.Json` rejects non-finite numbers by default, and one unsupported metadata field otherwise prevents the whole `location.json` update.

**How to apply:** Keep both the Windows mapping guard and the final file-writing guard. The latter is the fail-safe for future location providers or model changes.
