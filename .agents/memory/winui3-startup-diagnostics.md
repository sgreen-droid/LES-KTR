---
name: WinUI 3 startup diagnostics
description: Reliable native preflight checks for the self-contained unpackaged WinUI 3 agent.
---

For a self-contained unpackaged WinUI 3 agent, inspect `Microsoft.ui.xaml.dll` architecture by parsing its PE header; do not use `GetBinaryType`, which can report `ERROR_BAD_EXE_FORMAT` (193) for a DLL that Windows successfully loads. `XamlCheckProcessRequirements` must be invoked with a `void` return signature, not read as a Boolean.

**Why:** Treating a DLL like an executable creates a false x64 diagnostic, and reading a return value from the void WinUI check produces an undefined false readiness result that blocks healthy installations.

**How to apply:** Parse the DOS/PE/COFF machine fields with bounds checks, only call a loader-format mismatch specific when the PE evidence identifies the XAML DLL itself as non-x64, and make CI require both runtime DLLs beside the EXE. Keep `WindowsAppSDKSelfContained` in project configuration as well as publish verification.