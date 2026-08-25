using H.NotifyIcon;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Win32;

namespace LESLocationAgent;

/// <summary>
/// Application entry point. Handles single-instance enforcement and tray icon lifecycle.
/// </summary>
public partial class App : Application
{
    // Single-instance mutex — Global\ is fine for interactive users
    private static Mutex? _instanceMutex;

    // Named event: second instance signals this to bring the window forward.
    // Local\ is session-scoped and works without elevated privileges.
    private const string ShowWindowEventName =
        @"Local\LESLocationAgent_ShowWindow_{C7A3B2D1-E4F5-6789-ABCD-EF0123456789}";
    private const string MutexName =
        @"Global\LESLocationAgent_{C7A3B2D1-E4F5-6789-ABCD-EF0123456789}";

    private MainWindow? _mainWindow;
    private TaskbarIcon? _trayIcon;
    private Thread? _showWindowListenerThread;

    public static new App Current => (App)Application.Current;
    public MainWindow? MainWindowInstance => _mainWindow;

    public App()
    {
        InitializeComponent();

        // Catch any exception that escapes a XAML event handler.
        // Without this, WinUI calls FailFast and the process vanishes silently.
        UnhandledException += (_, e) =>
        {
            StartupLog($"UNHANDLED XAML EXCEPTION — {e.Exception?.GetType().Name}: {e.Exception?.Message}\n{e.Exception?.StackTrace}");
            e.Handled = true; // write the log, then keep running rather than crashing
        };
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        StartupLog("OnLaunched entered");

        // ── Auto-grant location consent for the current user ─────────────────
        // Must run BEFORE the single-instance check: on multi-user machines a
        // second user's launch exits early when another session already owns
        // the mutex, and their HKCU consent key still needs to be written.
        GrantLocationConsent();

        // ── Single-instance check ────────────────────────────────────────────
        bool ownsMutex = false;
        try
        {
            _instanceMutex = new Mutex(true, MutexName, out ownsMutex);
        }
        catch (Exception ex)
        {
            // Mutex creation failed (unusual) — log and continue without enforcement
            StartupLog($"Mutex creation failed: {ex.Message}");
            ownsMutex = true; // treat as first instance
        }

        if (!ownsMutex)
        {
            StartupLog("Another instance is already running — signalling it and exiting");
            // If the user launched manually (no --startup), tell the running
            // instance to show its window
            if (!IsStartupLaunch())
            {
                try
                {
                    using var ev = EventWaitHandle.OpenExisting(ShowWindowEventName);
                    ev.Set();
                }
                catch { }
            }
            Exit();
            return;
        }

        StartupLog("First instance — initialising");

        // ── Show-window listener for subsequent launches ─────────────────────
        StartShowWindowListener();

        // ── Tray icon (created entirely in code — ms-appx:// doesn't work for
        //    unpackaged apps, so the icon is loaded from an absolute path) ──────
        try
        {
            _trayIcon = BuildTrayIcon();
            WireTrayMenuHandlers();
            StartupLog("Tray icon initialised");
        }
        catch (Exception ex)
        {
            StartupLog($"Tray icon failed: {ex.Message}\n{ex.StackTrace}");
        }

        // ── Main window ──────────────────────────────────────────────────────
        try
        {
            _mainWindow = new MainWindow();
            StartupLog("MainWindow created");

            if (IsStartupLaunch())
            {
                // Launched by the Windows startup key — run in tray.
                // Only do this after the user has explicitly run the app at
                // least once (i.e. first-run flag is already set).
                if (CheckFirstRunFlagExists())
                {
                    StartupLog("Startup launch — minimising to tray");
                    _mainWindow.MinimizeToTray();
                }
                else
                {
                    // First ever launch (even via startup key) — show window
                    // so the user can grant location permission.
                    StartupLog("Startup launch but first-run — showing window");
                    MarkFirstRunComplete();
                    _mainWindow.Activate();
                }
            }
            else
            {
                // Manual launch — ALWAYS show the window.
                StartupLog("Manual launch — showing window");
                MarkFirstRunComplete();
                _mainWindow.Activate();
            }
        }
        catch (Exception ex)
        {
            StartupLog($"MainWindow creation/activation failed: {ex.Message}\n{ex.StackTrace}");
        }

        StartupLog("OnLaunched complete");
    }

    // ── Location consent auto-grant ──────────────────────────────────────────

    private const string LocationConsentKeyPath =
        @"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location";

    private static void GrantLocationConsent()
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(LocationConsentKeyPath, writable: true);
            var current = key.GetValue("Value") as string;
            if (!string.Equals(current, "Allow", StringComparison.OrdinalIgnoreCase))
            {
                key.SetValue("Value", "Allow", RegistryValueKind.String);
                StartupLog("Location consent registry set to Allow");
            }
            else
            {
                StartupLog("Location consent already Allow");
            }
        }
        catch (Exception ex)
        {
            StartupLog($"Location consent write failed: {ex.Message}");
        }
    }

    // ── Startup flag helpers ─────────────────────────────────────────────────

    private static bool IsStartupLaunch() =>
        Environment.CommandLine.Contains("--startup", StringComparison.OrdinalIgnoreCase);

    private static bool CheckFirstRunFlagExists()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(AppConfig.UserRegistryKeyPath);
            return key?.GetValue(AppConfig.HasRunBeforeValueName) is not null;
        }
        catch { return false; }
    }

    private static void MarkFirstRunComplete()
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(
                AppConfig.UserRegistryKeyPath, writable: true);
            key.SetValue(AppConfig.HasRunBeforeValueName, 1, RegistryValueKind.DWord);
        }
        catch { }
    }

    // ── Show-window listener ─────────────────────────────────────────────────

    private void StartShowWindowListener()
    {
        // Capture the UI-thread dispatcher queue before spawning the background thread.
        var uiQueue = Microsoft.UI.Dispatching.DispatcherQueue.GetForCurrentThread();

        EventWaitHandle? showEvent = null;
        try
        {
            showEvent = new EventWaitHandle(
                false, EventResetMode.AutoReset, ShowWindowEventName);
        }
        catch (Exception ex)
        {
            StartupLog($"ShowWindowListener event creation failed: {ex.Message}");
            return; // tray right-click Open still works
        }

        var capturedEvent = showEvent;
        _showWindowListenerThread = new Thread(() =>
        {
            while (true)
            {
                capturedEvent.WaitOne();
                uiQueue?.TryEnqueue(ShowMainWindow);
            }
        })
        {
            IsBackground = true,
            Name = "ShowWindowListener"
        };
        _showWindowListenerThread.Start();
    }

    // ── Tray menu ────────────────────────────────────────────────────────────

    private static TaskbarIcon BuildTrayIcon()
    {
        var icon = new TaskbarIcon
        {
            ToolTipText = "LES Location Agent",
            ContextMenuMode = H.NotifyIcon.ContextMenuMode.SecondWindow,
            // No IconSource — ms-appx:// doesn't resolve in unpackaged apps and
            // BitmapImage→System.Drawing.Icon conversion throws in H.NotifyIcon v2.1.
            // The tray shows a blank icon; the context menu and tooltip still work.
        };

        // Build context menu
        var open   = new MenuFlyoutItem { Name = "TrayMenuOpen",   Text = "Open LES Location Agent" };
        var update = new MenuFlyoutItem { Name = "TrayMenuUpdate", Text = "Update Location" };
        var status = new MenuFlyoutItem { Name = "TrayMenuStatus", Text = "Location Status", IsEnabled = false };
        var exit   = new MenuFlyoutItem { Name = "TrayMenuExit",   Text = "Exit" };

        var flyout = new MenuFlyout();
        flyout.Items.Add(open);
        flyout.Items.Add(update);
        flyout.Items.Add(status);
        flyout.Items.Add(new MenuFlyoutSeparator());
        flyout.Items.Add(exit);

        icon.ContextFlyout = flyout;
        return icon;
    }

    private void WireTrayMenuHandlers()
    {
        if (_trayIcon?.ContextFlyout is not MenuFlyout flyout) return;

        foreach (var item in flyout.Items)
        {
            if (item is not MenuFlyoutItem mi) continue;

            mi.Click += mi.Name switch
            {
                "TrayMenuOpen"   => (_, _) => ShowMainWindow(),
                "TrayMenuUpdate" => async (_, _) => await TriggerLocationUpdateAsync(),
                "TrayMenuExit"   => (_, _) => ExitApplication(),
                _                => (_, _) => { }
            };
        }
    }

    internal void ShowMainWindow()
    {
        if (_mainWindow is null) return;
        _mainWindow.ShowFromTray();
        _mainWindow.Activate();
        _mainWindow.BringToFront();
    }

    internal async Task TriggerLocationUpdateAsync()
    {
        if (_mainWindow is not null)
            await _mainWindow.GetLocationAsync();
    }

    internal void UpdateTrayStatus(string statusText)
    {
        if (_trayIcon?.ContextFlyout is not MenuFlyout flyout) return;
        foreach (var item in flyout.Items)
        {
            if (item is MenuFlyoutItem { Name: "TrayMenuStatus" } mi)
            {
                mi.DispatcherQueue.TryEnqueue(() => mi.Text = statusText);
                return;
            }
        }
    }

    private void ExitApplication()
    {
        _trayIcon?.Dispose();
        try { _instanceMutex?.ReleaseMutex(); } catch { }
        Exit();
    }

    // ── Startup log ──────────────────────────────────────────────────────────
    // Written to C:\ProgramData\LESLocationAgent\startup.log.
    // Lets IT staff diagnose silent startup failures without attaching a debugger.

    internal static void StartupLog(string message)
    {
        StartupLogger.Write(message);
    }
}
