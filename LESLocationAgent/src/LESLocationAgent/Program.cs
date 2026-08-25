// LES Location Agent — application entry point for unpackaged WinUI 3.
// DISABLE_XAML_GENERATED_MAIN is defined in the .csproj to suppress the
// auto-generated entry point so this class is the sole entry point.

using System.Diagnostics;
using System.Runtime.InteropServices;
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

    // ── Windows App SDK entry-point requirement ──────────────────────────────
    [DllImport("Microsoft.ui.xaml.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool XamlCheckProcessRequirements();

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

            StartupLogger.Write("Calling XamlCheckProcessRequirements");
            // Verify WinUI 3 runtime requirements are met on this Windows version.
            // This call loads Microsoft.ui.xaml.dll; if the DLL is missing or
            // incompatible it throws DllNotFoundException / TypeLoadException here,
            // which we catch below before any WinUI type is touched.
            // A runtime or deployment incompatibility can return false rather than
            // throwing, so surface that as a Windows App SDK failure.
            if (!XamlCheckProcessRequirements())
            {
                HandleWindowsAppSdkRequirementsError(
                    reason: "XamlCheckProcessRequirements() returned false",
                    detail: windowsVersion.DisplayName);
                return; // HandleWindowsAppSdkRequirementsError calls Environment.Exit; belt-and-braces.
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
        catch (Exception ex) when (ex is DllNotFoundException or TypeLoadException)
        {
            // The Windows App SDK runtime (or a self-contained DLL) failed to
            // load.  Surface a clear, actionable error rather than silently
            // crashing so that end users and IT staff can self-diagnose.

            string dllHint = ex is DllNotFoundException dne
                ? $"\n\nMissing DLL: {dne.Message}"
                : $"\n\nType load failure: {ex.Message}";

            string message =
                "LES Location Agent could not start because a required Windows " +
                "App SDK component failed to load." +
                dllHint +
                "\n\nWindows 11 was detected, so the operating-system requirement " +
                "is met." +
                "\n\nThis usually means the installation is incomplete, the " +
                "application was launched outside its install folder, or the " +
                "Windows App SDK runtime is unavailable." +
                "\n\nFirst reinstall the latest LES Location Agent MSI. If the " +
                "problem persists, download and run the Windows App SDK runtime " +
                "installer on this PC, then try again:" +
                $"\n\n{DownloadLink}" +
                "\n\nIf the problem persists, check the Windows Event Log " +
                "(Event Viewer → Windows Logs → Application) for an entry " +
                "from \"LESLocationAgent\" with full details.";

            // 1. Write to the Windows Application Event Log so IT staff can
            //    investigate without needing to reproduce the crash interactively.
            WriteEventLogEntry(
                $"Startup failed — Windows App SDK component could not be loaded.\n" +
                $"{ex.GetType().Name}: {ex.Message}\n\n" +
                "Windows 11 was detected before the WinUI startup check.\n\n" +
                $"Stack trace:\n{ex.StackTrace}\n\n" +
                $"Download the runtime from: {DownloadLink}",
                EventLogEntryType.Error);

            // 2. Show a user-visible dialog.  We use the Win32 MessageBox API
            //    directly because WinUI may not be available at this point.
            MessageBox(
                nint.Zero,
                message,
                "LES Location Agent — Startup Error",
                MB_OK | MB_ICONERROR | MB_SETFOREGROUND);

            Environment.Exit(1);
        }
        catch (Exception ex) when (ex is System.Runtime.InteropServices.SEHException)
        {
            // XamlCheckProcessRequirements() can raise an unmanaged structured
            // exception. Catch it here before it becomes an unhandled crash.
            HandleWindowsAppSdkRequirementsError(
                reason: "unmanaged exception from XamlCheckProcessRequirements()",
                detail: $"{ex.GetType().Name}: {ex.Message}\n\nStack trace:\n{ex.StackTrace}");
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

    private static void HandleWindowsAppSdkRequirementsError(string reason, string? detail)
    {
        var windowsVersion = GetActualWindowsVersion();
        var message =
            "LES Location Agent could not complete its Windows App SDK " +
            "startup check." +
            $"\n\n{windowsVersion.DisplayName}. " +
            $"This meets the {MinWindowsVersion} requirement." +
            "\n\nThe issue is likely an unavailable, incompatible, or incomplete " +
            "Windows App SDK installation—not an unsupported Windows version." +
            "\n\nReinstall the latest LES Location Agent MSI. If the problem " +
            "continues, install the Windows App SDK runtime and check the " +
            "Windows Application Event Log for the full error.";

        WriteEventLogEntry(
            $"Startup failed — Windows App SDK requirements check did not succeed.\n" +
            $"Cause: {reason}\n" +
            $"Detected: {windowsVersion.DisplayName}\n" +
            (detail is not null ? $"\n{detail}\n" : string.Empty) +
            $"\nDownload the runtime from: {DownloadLink}",
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
            // CreateEventSource requires elevation the first time; skip silently
            // if we cannot register.  The log is still visible from a prior run
            // that did have access (e.g. the MSI install step runs as admin and
            // could pre-register the source via a custom action if desired).
            if (!EventLog.SourceExists(EventSourceName))
                EventLog.CreateEventSource(EventSourceName, "Application");

            EventLog.WriteEntry(EventSourceName, message, type, eventID: 1000);
        }
        catch
        {
            // Best-effort — do not throw.
        }
    }
}
