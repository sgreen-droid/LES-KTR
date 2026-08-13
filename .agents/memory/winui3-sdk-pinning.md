---
name: WinUI 3 SDK pinning on GitHub Actions
description: Why global.json is required for WinUI 3 apps on GitHub Actions windows-latest runners.
---

## Rule
Always include a `global.json` pinning the .NET SDK to `8.x` (rollForward: latestFeature) in any WinUI 3 / Windows App SDK project that builds on GitHub Actions.

**Why:** As of mid-2026, `windows-latest` GitHub Actions runners ship .NET SDK 10.0.x by default. The Windows App SDK PRI resource compiler task (`Microsoft.Build.Packaging.Pri.Tasks.ExpandPriContent`) is not compatible with SDK 10 — it fails with MSB4062 "could not be loaded from the assembly". The error message mentions `AppxPackage\Microsoft.Build.Packaging.Pri.Tasks.dll`.

**How to apply:** Place this file at the repo/project root (same directory as the `.sln`):

```json
{
  "sdk": {
    "version": "8.0.0",
    "rollForward": "latestFeature"
  }
}
```

`latestFeature` means "use the latest 8.x.y SDK installed" — it won't reject patch updates, only major/minor bumps.
