// LES Location Agent — application entry point for unpackaged WinUI 3.
// DISABLE_XAML_GENERATED_MAIN is defined in the .csproj to suppress the
// auto-generated entry point so this class is the sole entry point.

using System.Diagnostics;
using System.Runtime.InteropServices;
using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using WinRT;

namespace LESLocationAgent;

internal static class Program
{
    // ── Win32 MessageBox (no WinUI dependency — safe to call before the XAML
    //    runtime is initialised, which is exactly the failure scenario we need
    //    to surface to the user). ──────────────────────────────────────────────
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    private static extern int MessageBox(nint hWnd, string text, string caption, uint type);

    private const uint MB_OK              = 0x00000000u;
    private const uint MB_ICONERROR       = 0x00000010u;
    private const uint MB_SETFOREGROUND   = 0x00010000u;

    // ── Event Log source name (written to Windows Logs → Application) ────────
    private const string EventSourceName  = "LESLocationAgent";
    private const string DownloadLink     =
        "https://aka.ms/windowsappsdk/1.6/latest/windowsappruntimeinstall-x64.exe";
    private const string MinWindowsVersion = "Windows 11 version 21H2 (build 22000)";
    private const uint MinimumWindows11Build = 22000;
    private const byte VerNtWorkstation = 1;
    private static FileStream? _machineInstanceLock;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct RtlOsVersionInfoEx
    {
        public uint OsVersionInfoSize;
        public uint MajorVersion;
        public uint MinorVersion;
        public uint BuildNumber;
        public uint PlatformId;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string CsdVersion;

        public ushort ServicePackMajor;
        public ushort ServicePackMinor;
        public ushort SuiteMask;
        public byte ProductType;
        public byte Reserved;
    }

    [DllImport("ntdll.dll", CharSet = CharSet.Unicode)]
    private static extern int RtlGetVersion(ref RtlOsVersionInfoEx versionInfo);

    private readonly record struct WindowsVersionInfo(
        uint Major,
        uint Minor,
        uint Build,
        byte ProductType)
    {
        public bool IsWorkstation => ProductType == VerNtWorkstation;
        public bool IsWindows11OrLater =>
            IsWorkstation && Build >= MinimumWindows11Build;

        public string DisplayName =>
            IsWindows11OrLater
                ? $"Windows 11 detected (build {Build})"
                : IsWorkstation
                    ? $"Windows client detected (version {Major}.{Minor}, build {Build})"
                    : $"Windows Server or non-client edition detected (version {Major}.{Minor}, build {Build})";
    }

    [STAThread]
    private static void Main(string[] args)
    {
        // Very first thing — write to the startup log before any WinUI code runs.
        // If the app disappears silently, check C:\ProgramData\LESLocationAgent\startup.log
        StartupLogger.Write($"Main() entered — args: {string.Join(" ", args)}");

        try
        {
            if (!TryAcquireMachineInstanceLock())
            {
                StartupLogger.Write("Another LES Location Agent instance owns the machine recovery files; exiting.");
                return;
            }

            var windowsVersion = GetActualWindowsVersion();
            StartupLogger.Write(windowsVersion.DisplayName);
            if (!windowsVersion.IsWindows11OrLater)
            {
                HandleUnsupportedWindowsError(windowsVersion);
                return;
            }

            var startupInspection = StartupDiagnosticProbe.InspectAndCheckRequirements();
            var startupDiagnostic = StartupDiagnosticClassifier.Classify(startupInspection.Evidence);
            StartupLogger.Write(startupInspection.ToLogText(startupDiagnostic));

            if (!startupInspection.RequirementsSatisfied)
            {
                HandleStartupDiagnosticFailure(
                    windowsVersion,
                    startupInspection,
                    startupDiagnostic);
                return; // HandleStartupDiagnosticFailure calls Environment.Exit; belt-and-braces.
            }

            // Required for WinUI 3 unpackaged apps
            ComWrappersSupport.InitializeComWrappers();

            Application.Start((p) =>
            {
                // Set up the dispatcher queue synchronisation context so that
                // async/await continuations run on the UI thread
                var context = new DispatcherQueueSynchronizationContext(
                    DispatcherQueue.GetForCurrentThread());
                SynchronizationContext.SetSynchronizationContext(context);

                _ = new App();
            });
        }
        catch (Exception ex)
        {
            HandleUnexpectedStartupFailure(ex);
        }
    }

    private static WindowsVersionInfo GetActualWindowsVersion()
    {
        var versionInfo = new RtlOsVersionInfoEx
        {
            OsVersionInfoSize = (uint)Marshal.SizeOf<RtlOsVersionInfoEx>(),
            CsdVersion = string.Empty
        };

        if (RtlGetVersion(ref versionInfo) == 0)
        {
            return new WindowsVersionInfo(
                versionInfo.MajorVersion,
                versionInfo.MinorVersion,
                versionInfo.BuildNumber,
                versionInfo.ProductType);
        }

        var fallback = Environment.OSVersion.Version;
        return new WindowsVersionInfo(
            (uint)Math.Max(0, fallback.Major),
            (uint)Math.Max(0, fallback.Minor),
            (uint)Math.Max(0, fallback.Build),
            ProductType: 0);
    }

    private static void HandleUnsupportedWindowsError(WindowsVersionInfo windowsVersion)
    {
        var message =
            "LES Location Agent could not start because this PC does not meet " +
            $"the minimum operating-system requirement.\n\nRequired: {MinWindowsVersion} " +
            $"or later.\n\nDetected: {windowsVersion.DisplayName}." +
            "\n\nUse a supported Windows 11 client edition (21H2 or later), then " +
            "install the latest LES Location Agent MSI.";

        WriteEventLogEntry(
            $"Startup blocked — unsupported Windows version.\n" +
            $"Required: {MinWindowsVersion}\n" +
            $"Detected: {windowsVersion.DisplayName}",
            EventLogEntryType.Error);

        MessageBox(
            nint.Zero,
            message,
            "LES Location Agent — Startup Error",
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND);

        Environment.Exit(1);
    }

    private static void HandleStartupDiagnosticFailure(
        WindowsVersionInfo windowsVersion,
        StartupDiagnosticInspection inspection,
        StartupDiagnosticResult diagnostic)
    {
        var diagnosticDetail = BuildDiagnosticDetail(inspection);
        var remediationLink = diagnostic.FailureKind switch
        {
            StartupFailureKind.WindowsAppSdkRequirementsFailed =>
                $"\n\nWindows App SDK Runtime (x64):\n{DownloadLink}",
            _ => string.Empty
        };
        var specificityNote = diagnostic.IsSpecific
            ? "Windows provided enough evidence to identify this failure."
            : "Windows did not identify one specific missing dependency; the checks below show exactly what was found.";
        var message =
            "LES Location Agent could not start." +
            $"\n\n{windowsVersion.DisplayName}. " +
            $"This meets the {MinWindowsVersion} requirement." +
            $"\n\nProblem: {diagnostic.Summary}" +
            $"\n\n{diagnosticDetail}" +
            $"\n\n{specificityNote}" +
            $"\n\nWhat to do: {diagnostic.RecommendedAction}" +
            remediationLink +
            "\n\nThe complete non-sensitive diagnostic was written to the LESLocationAgent startup log and Windows Application Event Log.";

        WriteEventLogEntry(
            $"Startup failed — {windowsVersion.DisplayName}\n\n" +
            inspection.ToLogText(diagnostic),
            EventLogEntryType.Error);

        MessageBox(
            nint.Zero,
            message,
            "LES Location Agent — Startup Error",
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND);

        Environment.Exit(1);
    }

    private static string BuildDiagnosticDetail(StartupDiagnosticInspection inspection)
    {
        var loaderResult = !inspection.Evidence.XamlDllExists
            ? "not attempted because Microsoft.ui.xaml.dll is missing."
            : inspection.Evidence.NativeLoaderErrorCode.HasValue
                ? $"Windows loader error {inspection.Evidence.NativeLoaderErrorCode}: " +
                  inspection.Evidence.NativeLoaderErrorMessage
                : "Windows loaded Microsoft.ui.xaml.dll for inspection.";

        return
            $"Microsoft.ui.xaml.dll: {(inspection.Evidence.XamlDllExists ? "present" : "missing")} " +
            $"({inspection.Evidence.XamlDllArchitecture})" +
            $"\nMicrosoft.WindowsAppRuntime.dll: {(inspection.Evidence.WindowsAppRuntimeDllExists ? "present" : "missing")}" +
            $"\nWindows loader: {loaderResult}" +
            $"\nXAML startup export: {(inspection.Evidence.XamlRequirementsExportErrorCode.HasValue
                ? $"Windows error {inspection.Evidence.XamlRequirementsExportErrorCode}: {inspection.Evidence.XamlRequirementsExportErrorMessage}"
                : "XamlCheckProcessRequirements found")}" +
            $"\nVisual C++ x64 runtime: {(inspection.Evidence.VisualCppRuntimeDetected ? "detected" : "not detected")}" +
            $"\nWindows App SDK readiness: {(inspection.Evidence.XamlRequirementsSatisfied.HasValue
                ? inspection.Evidence.XamlRequirementsSatisfied.Value ? "passed" : "returned false"
                : "not called")}" +
            (inspection.NativeProbeException is null
                ? string.Empty
                : $"\nNative startup exception: {inspection.NativeProbeException}");
    }

    private static void HandleUnexpectedStartupFailure(Exception exception)
    {
        var message =
            "LES Location Agent could not complete startup." +
            "\n\nAn unexpected error occurred after the dependency checks." +
            $"\n\n{exception.GetType().Name}: {exception.Message}" +
            "\n\nThe error was written to the LESLocationAgent startup log and Windows Application Event Log.";

        StartupLogger.Write(
            $"Unexpected startup failure:\n{exception.GetType().Name}: {exception.Message}\n{exception.StackTrace}");
        WriteEventLogEntry(
            $"Unexpected startup failure:\n{exception.GetType().Name}: {exception.Message}\n{exception.StackTrace}",
            EventLogEntryType.Error);
        MessageBox(
            nint.Zero,
            message,
            "LES Location Agent — Startup Error",
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND);
        Environment.Exit(1);
    }

    /// <summary>
    /// Keeps one tray agent active per machine, including when HKLM Run starts
    /// apps in different interactive sessions. A file handle is used instead of
    /// a global named event because it is visible across sessions without
    /// requiring a global-object security descriptor.
    /// </summary>
    private static bool TryAcquireMachineInstanceLock()
    {
        try
        {
            var directory = Path.GetDirectoryName(AppConfig.LocationFilePath)
                ?? throw new InvalidOperationException("The application data path is invalid.");
            Directory.CreateDirectory(directory);
            _machineInstanceLock = new FileStream(
                Path.Combine(directory, "agent.instance.lock"),
                FileMode.OpenOrCreate,
                FileAccess.ReadWrite,
                FileShare.None);
            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>
    /// Writes <paramref name="message"/> to the Windows Application Event Log
    /// under the source "LESLocationAgent".  Silently swallows any logging
    /// errors so that a failure to write the log never masks the original error.
    /// </summary>
    private static void WriteEventLogEntry(string message, EventLogEntryType type)
    {
        try
        {
            if (!EventLog.SourceExists(EventSourceName))
            {
                StartupLogger.Write(
                    "Windows Application Event Log source is not registered. " +
                    "Reinstall the LES Location Agent MSI to restore it.");
                return;
            }

            EventLog.WriteEntry(EventSourceName, message, type, eventID: 1000);
        }
        catch (Exception ex)
        {
            StartupLogger.Write(
                $"Windows Application Event Log write failed: {ex.GetType().Name}: {ex.Message}");
        }
    }
}
