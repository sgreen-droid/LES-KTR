using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using LESLocationAgent.Core.Helpers;
using Microsoft.Win32;

namespace LESLocationAgent;

/// <summary>
/// Collects startup evidence before any WinUI type is referenced. All native
/// loads use an absolute path and restricted Windows search flags.
/// </summary>
internal static class StartupDiagnosticProbe
{
    private const uint LoadLibrarySearchDllLoadDir = 0x00000100;
    private const uint LoadLibrarySearchDefaultDirs = 0x00001000;
    private const uint Scs32BitBinary = 0;
    private const uint Scs64BitBinary = 6;
    private const int ErrorProcNotFound = 127;

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private delegate bool XamlCheckProcessRequirementsDelegate();

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern nint LoadLibraryEx(
        string lpFileName,
        nint hFile,
        uint dwFlags);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FreeLibrary(nint hLibModule);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern nint GetProcAddress(nint hModule, string procName);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetBinaryType(string lpApplicationName, out uint lpBinaryType);

    internal static StartupDiagnosticInspection InspectAndCheckRequirements()
    {
        var applicationDirectory = AppContext.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar);
        var xamlDllPath = Path.Combine(applicationDirectory, "Microsoft.ui.xaml.dll");
        var appRuntimeDllPath = Path.Combine(applicationDirectory, "Microsoft.WindowsAppRuntime.dll");
        var xamlDllExists = File.Exists(xamlDllPath);
        var appRuntimeDllExists = File.Exists(appRuntimeDllPath);
        var visualCpp = InspectVisualCppRuntime();

        var evidence = new StartupDiagnosticEvidence(
            XamlDllExists: xamlDllExists,
            WindowsAppRuntimeDllExists: appRuntimeDllExists,
            XamlDllArchitecture: xamlDllExists ? GetBinaryArchitecture(xamlDllPath) : "not present",
            Is64BitProcess: Environment.Is64BitProcess,
            Is64BitOperatingSystem: Environment.Is64BitOperatingSystem,
            VisualCppRuntimeDetected: visualCpp.Detected,
            NativeLoaderErrorCode: null,
            NativeLoaderErrorMessage: null,
            XamlRequirementsExportErrorCode: null,
            XamlRequirementsExportErrorMessage: null,
            XamlRequirementsSatisfied: null);

        if (!xamlDllExists)
        {
            return new StartupDiagnosticInspection(
                evidence,
                applicationDirectory,
                xamlDllPath,
                null,
                appRuntimeDllExists,
                visualCpp.Evidence,
                NativeProbeException: null);
        }

        var xamlDllVersion = TryGetFileVersion(xamlDllPath);
        var library = LoadLibraryEx(
            xamlDllPath,
            nint.Zero,
            LoadLibrarySearchDllLoadDir | LoadLibrarySearchDefaultDirs);

        if (library == nint.Zero)
        {
            var errorCode = Marshal.GetLastWin32Error();
            return new StartupDiagnosticInspection(
                evidence with
                {
                    NativeLoaderErrorCode = errorCode,
                    NativeLoaderErrorMessage = DescribeWindowsError(errorCode)
                },
                applicationDirectory,
                xamlDllPath,
                xamlDllVersion,
                appRuntimeDllExists,
                visualCpp.Evidence,
                NativeProbeException: null);
        }

        try
        {
            var export = GetProcAddress(library, "XamlCheckProcessRequirements");
            if (export == nint.Zero)
            {
                var errorCode = Marshal.GetLastWin32Error();
                return new StartupDiagnosticInspection(
                    evidence with
                    {
                        XamlRequirementsExportErrorCode = errorCode == 0 ? ErrorProcNotFound : errorCode,
                        XamlRequirementsExportErrorMessage = DescribeWindowsError(
                            errorCode == 0 ? ErrorProcNotFound : errorCode)
                    },
                    applicationDirectory,
                    xamlDllPath,
                    xamlDllVersion,
                    appRuntimeDllExists,
                    visualCpp.Evidence,
                    NativeProbeException: null);
            }

            try
            {
                var check = Marshal.GetDelegateForFunctionPointer<XamlCheckProcessRequirementsDelegate>(export);
                var requirementsSatisfied = check();
                return new StartupDiagnosticInspection(
                    evidence with { XamlRequirementsSatisfied = requirementsSatisfied },
                    applicationDirectory,
                    xamlDllPath,
                    xamlDllVersion,
                    appRuntimeDllExists,
                    visualCpp.Evidence,
                    NativeProbeException: null);
            }
            catch (Exception ex) when (ex is SEHException or TypeLoadException)
            {
                return new StartupDiagnosticInspection(
                    evidence,
                    applicationDirectory,
                    xamlDllPath,
                    xamlDllVersion,
                    appRuntimeDllExists,
                    visualCpp.Evidence,
                    NativeProbeException: $"{ex.GetType().Name}: {ex.Message}");
            }
        }
        finally
        {
            FreeLibrary(library);
        }
    }

    private static string GetBinaryArchitecture(string filePath)
    {
        if (!GetBinaryType(filePath, out var binaryType))
        {
            return $"unknown (Windows error {Marshal.GetLastWin32Error()})";
        }

        return binaryType switch
        {
            Scs64BitBinary => "x64",
            Scs32BitBinary => "x86",
            _ => $"unknown (binary type {binaryType})"
        };
    }

    private static string? TryGetFileVersion(string filePath)
    {
        try
        {
            return FileVersionInfo.GetVersionInfo(filePath).FileVersion;
        }
        catch
        {
            return null;
        }
    }

    private static VisualCppRuntimeInfo InspectVisualCppRuntime()
    {
        const string runtimeKeyPath = @"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64";
        var expectedFiles = new[] { "vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll" };
        var presentFiles = expectedFiles
            .Where(file => File.Exists(Path.Combine(Environment.SystemDirectory, file)))
            .ToArray();

        bool registryReportsInstalled = false;
        string? version = null;
        try
        {
            using var localMachine = RegistryKey.OpenBaseKey(
                RegistryHive.LocalMachine,
                RegistryView.Registry64);
            using var key = localMachine.OpenSubKey(runtimeKeyPath, writable: false);
            registryReportsInstalled = Convert.ToInt32(key?.GetValue("Installed") ?? 0) == 1;
            version = key?.GetValue("Version") as string;
        }
        catch
        {
            // Treat an inaccessible registry key as unavailable evidence, not a
            // missing runtime. The files remain a second independent signal.
        }

        var detected = registryReportsInstalled || presentFiles.Length == expectedFiles.Length;
        var evidence =
            $"Visual C++ x64 registry: {(registryReportsInstalled ? "installed" : "not detected")}" +
            (string.IsNullOrWhiteSpace(version) ? string.Empty : $" ({version})") +
            $"; system runtime files: {presentFiles.Length}/{expectedFiles.Length} present";

        return new VisualCppRuntimeInfo(detected, evidence);
    }

    private static string DescribeWindowsError(int errorCode)
    {
        try
        {
            return new Win32Exception(errorCode).Message;
        }
        catch
        {
            return "Windows did not provide a readable error message.";
        }
    }

    private sealed record VisualCppRuntimeInfo(bool Detected, string Evidence);
}

internal sealed record StartupDiagnosticInspection(
    StartupDiagnosticEvidence Evidence,
    string ApplicationDirectory,
    string XamlDllPath,
    string? XamlDllVersion,
    bool WindowsAppRuntimeDllExists,
    string VisualCppRuntimeEvidence,
    string? NativeProbeException)
{
    internal bool RequirementsSatisfied =>
        Evidence.XamlRequirementsSatisfied is true &&
        Evidence.NativeLoaderErrorCode is null &&
        Evidence.XamlRequirementsExportErrorCode is null &&
        Evidence.XamlDllExists &&
        Evidence.WindowsAppRuntimeDllExists &&
        Evidence.Is64BitProcess &&
        Evidence.Is64BitOperatingSystem &&
        string.Equals(Evidence.XamlDllArchitecture, "x64", StringComparison.OrdinalIgnoreCase) &&
        NativeProbeException is null;

    internal string ToLogText(StartupDiagnosticResult result) =>
        "Startup diagnostic:\n" +
        $"Classification: {result.FailureKind}\n" +
        $"Summary: {result.Summary}\n" +
        $"Application directory: {ApplicationDirectory}\n" +
        $"Microsoft.ui.xaml.dll: {(Evidence.XamlDllExists ? "present" : "missing")} at {XamlDllPath}" +
        (string.IsNullOrWhiteSpace(XamlDllVersion) ? string.Empty : $" (version {XamlDllVersion})") + "\n" +
        $"Microsoft.ui.xaml.dll architecture: {Evidence.XamlDllArchitecture}\n" +
        $"Microsoft.WindowsAppRuntime.dll: {(WindowsAppRuntimeDllExists ? "present" : "not found beside the application")}\n" +
        $"Process architecture: {(Evidence.Is64BitProcess ? "x64" : "x86")}; OS architecture: {(Evidence.Is64BitOperatingSystem ? "x64" : "x86")}\n" +
        $"{VisualCppRuntimeEvidence}\n" +
        $"Windows loader result: {DescribeLoaderResult()}\n" +
        $"XAML startup export: {DescribeXamlStartupExport()}\n" +
        $"Windows App SDK readiness: {(Evidence.XamlRequirementsSatisfied.HasValue
            ? Evidence.XamlRequirementsSatisfied.Value ? "passed" : "returned false"
            : "not called")}" +
        (NativeProbeException is null ? string.Empty : $"\nNative startup exception: {NativeProbeException}") +
        $"\nRecommended action: {result.RecommendedAction}";

    private string DescribeLoaderResult() =>
        !Evidence.XamlDllExists
            ? "not attempted because Microsoft.ui.xaml.dll is missing"
            : Evidence.NativeLoaderErrorCode.HasValue
                ? $"{Evidence.NativeLoaderErrorCode}: {Evidence.NativeLoaderErrorMessage}"
                : "Microsoft.ui.xaml.dll loaded for inspection";

    private string DescribeXamlStartupExport() =>
        Evidence.XamlRequirementsExportErrorCode.HasValue
            ? $"{Evidence.XamlRequirementsExportErrorCode}: {Evidence.XamlRequirementsExportErrorMessage}"
            : "XamlCheckProcessRequirements found";
}