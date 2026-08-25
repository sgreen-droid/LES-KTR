---
name: WinUI 3 startup diagnostics
description: Reliable native preflight checks for the self-contained unpackaged WinUI 3 agent.
---

For a self-contained unpackaged WinUI 3 agent, inspect `Microsoft.ui.xaml.dll` architecture by parsing its PE header; do not use `GetBinaryType`, which can report `ERROR_BAD_EXE_FORMAT` (193) for a DLL that Windows successfully loads. Do not manually invoke `XamlCheckProcessRequirements` through a native function pointer as a startup gate.

**Why:** Treating a DLL like an executable creates a false x64 diagnostic. Windows App SDK documents `XamlCheckProcessRequirements` as a retained no-op for binary compatibility on supported current runtimes; manually invoking the export can still produce a false readiness failure after Windows successfully loads the packaged XAML DLL.

**How to apply:** Parse the DOS/PE/COFF machine fields with bounds checks, use a restricted absolute-path native load as the actual runtime preflight, and only call a loader-format mismatch specific when the PE evidence identifies the XAML DLL itself as non-x64. Make CI require both runtime DLLs beside the EXE and keep `WindowsAppSDKSelfContained` in project configuration as well as publish verification.