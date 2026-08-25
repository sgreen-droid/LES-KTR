namespace LESLocationAgent.Core.Helpers;

/// <summary>
/// Classifies startup evidence collected before WinUI starts. This contains no
/// Windows API calls so the decision rules can be tested on any build runner.
/// </summary>
public static class StartupDiagnosticClassifier
{
    public const int ErrorModuleNotFound = 126;
    public const int ErrorBadExeFormat = 193;
    public const int ErrorExeMachineTypeMismatch = 216;

    public static StartupDiagnosticResult Classify(StartupDiagnosticEvidence evidence)
    {
        if (!evidence.XamlDllExists)
        {
            return new StartupDiagnosticResult(
                StartupFailureKind.MissingPackagedXamlDll,
                "The packaged Microsoft.ui.xaml.dll file is missing.",
                "Reinstall the latest LES Location Agent MSI. Do not launch a copied EXE outside its install folder.",
                IsSpecific: true);
        }

        if (!evidence.WindowsAppRuntimeDllExists)
        {
            return new StartupDiagnosticResult(
                StartupFailureKind.MissingPackagedWindowsAppRuntimeDll,
                "The packaged Microsoft.WindowsAppRuntime.dll file is missing.",
                "Reinstall the latest LES Location Agent MSI. Do not launch a copied EXE outside its install folder.",
                IsSpecific: true);
        }

        if (!evidence.Is64BitOperatingSystem || !evidence.Is64BitProcess ||
            !string.Equals(evidence.XamlDllArchitecture, "x64", StringComparison.OrdinalIgnoreCase))
        {
            var explicitMismatch =
                !evidence.Is64BitOperatingSystem ||
                !evidence.Is64BitProcess ||
                string.Equals(evidence.XamlDllArchitecture, "x86", StringComparison.OrdinalIgnoreCase);

            return new StartupDiagnosticResult(
                StartupFailureKind.IncompatibleArchitecture,
                explicitMismatch
                    ? "The agent or its XAML runtime does not match the required x64 architecture."
                    : "Windows could not verify that the XAML runtime is the required x64 architecture.",
                "Install the x64 LES Location Agent MSI on a 64-bit Windows 11 PC.",
                IsSpecific: explicitMismatch);
        }

        if (evidence.NativeLoaderErrorCode.HasValue)
        {
            return new StartupDiagnosticResult(
                StartupFailureKind.NativeDependencyLoadFailure,
                "Windows could not load Microsoft.ui.xaml.dll or one of its native dependencies.",
                "Reinstall the latest LES Location Agent MSI. If the diagnostic says the x64 Visual C++ runtime is not detected, repair that Microsoft runtime next.",
                IsSpecific: false);
        }

        if (evidence.XamlRequirementsExportErrorCode.HasValue)
        {
            return new StartupDiagnosticResult(
                StartupFailureKind.MissingXamlRequirementsExport,
                "The installed Microsoft.ui.xaml.dll does not provide the required XamlCheckProcessRequirements startup export.",
                "Reinstall the latest LES Location Agent MSI. The installed XAML runtime is incomplete or incompatible.",
                IsSpecific: true);
        }

        if (evidence.XamlRequirementsSatisfied is false)
        {
            return new StartupDiagnosticResult(
                StartupFailureKind.WindowsAppSdkRequirementsFailed,
                "Microsoft.ui.xaml.dll loaded, but its startup requirement check did not complete successfully.",
                "Reinstall the latest LES Location Agent MSI, then review the startup diagnostic record.",
                IsSpecific: false);
        }

        if (evidence.XamlRequirementsSatisfied is true)
        {
            return new StartupDiagnosticResult(
                StartupFailureKind.None,
                "All pre-WinUI startup checks passed.",
                string.Empty,
                IsSpecific: true);
        }

        return new StartupDiagnosticResult(
            StartupFailureKind.UnknownStartupFailure,
            "The startup diagnostic did not identify a failing dependency.",
            "Reinstall the latest LES Location Agent MSI and review the diagnostic record.",
            IsSpecific: false);
    }
}

public sealed record StartupDiagnosticEvidence(
    bool XamlDllExists,
    bool WindowsAppRuntimeDllExists,
    string XamlDllArchitecture,
    bool Is64BitProcess,
    bool Is64BitOperatingSystem,
    bool VisualCppRuntimeDetected,
    int? NativeLoaderErrorCode,
    string? NativeLoaderErrorMessage,
    int? XamlRequirementsExportErrorCode,
    string? XamlRequirementsExportErrorMessage,
    bool? XamlRequirementsSatisfied);

public sealed record StartupDiagnosticResult(
    StartupFailureKind FailureKind,
    string Summary,
    string RecommendedAction,
    bool IsSpecific);

public enum StartupFailureKind
{
    None,
    MissingPackagedXamlDll,
    MissingPackagedWindowsAppRuntimeDll,
    IncompatibleArchitecture,
    NativeDependencyLoadFailure,
    MissingXamlRequirementsExport,
    WindowsAppSdkRequirementsFailed,
    UnknownStartupFailure
}