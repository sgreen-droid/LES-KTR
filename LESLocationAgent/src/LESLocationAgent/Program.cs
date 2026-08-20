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
    private const string MinWindowsVersion = "Windows 10 version 1809 (October 2018 Update)";
    private static FileStream? _machineInstanceLock;

    [STAThread]
    private static void Main(string[] args)
    {
        // Very first thing — write to the startup log before any WinUI code runs.
        // If the app disappears silently, check C:\ProgramData\LESLocationAgent\startup.log
        App.StartupLog($"Main() entered — args: {string.Join(" ", args)}");

        try
        {
            if (!TryAcquireMachineInstanceLock())
            {
                App.StartupLog("Another LES Location Agent instance owns the machine recovery files; exiting.");
                return;
            }

            App.StartupLog("Calling XamlCheckProcessRequirements");
            // Verify WinUI 3 runtime requirements are met on this Windows version.
            // This call loads Microsoft.ui.xaml.dll; if the DLL is missing or
            // incompatible it throws DllNotFoundException / TypeLoadException here,
            // which we catch below before any WinUI type is touched.
            // On a host OS below the SDK's minimum supported version the call may
            // return false (rather than throwing), so we treat that as a failure too.
            if (!XamlCheckProcessRequirements())
            {
                HandleWindowsVersionError(
                    reason: "XamlCheckProcessRequirements() returned false",
                    detail: null);
                return; // HandleWindowsVersionError calls Environment.Exit; belt-and-braces.
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
                $"\n\nThe application requires {MinWindowsVersion} or later. " +
                "Windows 11 already meets this operating-system requirement." +
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
                $"Minimum required OS: {MinWindowsVersion}\n\n" +
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
            // exception (SEH) when the host Windows version is below the SDK's
            // minimum.  Catch it here before it becomes an unhandled crash.
            HandleWindowsVersionError(
                reason: "unmanaged exception from XamlCheckProcessRequirements()",
                detail: $"{ex.GetType().Name}: {ex.Message}\n\nStack trace:\n{ex.StackTrace}");
        }
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
    /// Surfaces a Windows-version incompatibility to the user and to the Event
    /// Log, then exits the process.  Called both from the <c>false</c>-return
    /// path and from the <see cref="SEHException"/> catch block.
    /// </summary>
    private static void HandleWindowsVersionError(string reason, string? detail)
    {
        string message =
            "LES Location Agent could not complete the Windows App SDK " +
            "requirements check." +
            $"\n\nRequired operating system: {MinWindowsVersion} or later. " +
            "Windows 11 meets this requirement." +
            "\n\nIf this PC runs Windows 10 version 1809 or later, reinstall the " +
            "latest LES Location Agent MSI, then download and run the Windows App " +
            "SDK runtime installer if the problem continues:" +
            $"\n\n{DownloadLink}" +
            "\n\nCheck the Windows Event Log (Event Viewer → Windows Logs → " +
            "Application) for an entry from \"LESLocationAgent\" with full details.";

        string logMessage =
            $"Startup failed — Windows App SDK requirements check did not succeed.\n" +
            $"Cause: {reason}\n" +
            $"Minimum required OS: {MinWindowsVersion}\n" +
            (detail is not null ? $"\n{detail}\n" : string.Empty) +
            $"\nDownload the runtime from: {DownloadLink}";

        WriteEventLogEntry(logMessage, EventLogEntryType.Error);

        MessageBox(
            nint.Zero,
            message,
            "LES Location Agent — Startup Error",
            MB_OK | MB_ICONERROR | MB_SETFOREGROUND);

        Environment.Exit(1);
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
