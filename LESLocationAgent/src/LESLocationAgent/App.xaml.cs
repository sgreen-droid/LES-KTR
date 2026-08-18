using H.NotifyIcon;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Win32;
using System.Diagnostics;

namespace LESLocationAgent;

/// <summary>
/// Application entry point. Handles single-instance enforcement, first-run detection,
/// and tray icon lifecycle.
/// </summary>
public partial class App : Application
{
    // Single-instance mutex — system-wide unique name
    private static readonly Mutex _instanceMutex =
        new(true, @"Global\LESLocationAgent_{C7A3B2D1-E4F5-6789-ABCD-EF0123456789}");

    // Named event: second instance signals this to tell the first instance to show its window
    private const string ShowWindowEventName =
        @"Global\LESLocationAgent_ShowWindow_{C7A3B2D1-E4F5-6789-ABCD-EF0123456789}";

    private MainWindow? _mainWindow;
    private TaskbarIcon? _trayIcon;
    private Thread? _showWindowListenerThread;

    public static new App Current => (App)Application.Current;
    public MainWindow? MainWindowInstance => _mainWindow;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        // Enforce single instance
        if (!_instanceMutex.WaitOne(TimeSpan.Zero, true))
        {
            // Another instance is already running.
            // If the user launched us manually (no --startup flag), tell the
            // running instance to bring its window forward, then exit.
            if (!Environment.CommandLine.Contains("--startup", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    using var ev = EventWaitHandle.OpenExisting(ShowWindowEventName);
                    ev.Set();
                }
                catch { /* Running instance may not have created the event yet — ignore */ }
            }
            Exit();
            return;
        }

        // First (and only) instance — create the named show-window event and
        // start a background thread that listens for signals from future launches.
        StartShowWindowListener();

        // Initialise tray icon from Application resources
        _trayIcon = (TaskbarIcon)Resources["TrayIcon"];
        WireTrayMenuHandlers();

        bool isFirstRun = CheckAndMarkFirstRunForCurrentUser();

        _mainWindow = new MainWindow();

        if (isFirstRun || ShouldStartVisible(args))
        {
            // Always visible on first run so Windows can prompt for location permission
            _mainWindow.Activate();
        }
        else
        {
            // Subsequent auto-starts run minimised to tray
            _mainWindow.MinimizeToTray();
        }
    }

    private void StartShowWindowListener()
    {
        // Create (or open) the named event — auto-reset so each signal is consumed once.
        var showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowWindowEventName);

        _showWindowListenerThread = new Thread(() =>
        {
            while (true)
            {
                showEvent.WaitOne(); // blocks until a second instance signals us
                DispatcherQueue.GetForCurrentThread()?.TryEnqueue(() => ShowMainWindow());
            }
        })
        {
            IsBackground = true, // don't keep the process alive on exit
            Name = "ShowWindowListener"
        };
        _showWindowListenerThread.Start();
    }

    // ---------------------------------------------------------------
    // Tray icon menu handlers
    // ---------------------------------------------------------------

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
        _mainWindow.Show();
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
        _instanceMutex.ReleaseMutex();
        Exit();
    }

    /// <summary>
    /// Returns <see langword="true"/> the very first time the current Windows user
    /// launches the app, and atomically sets the per-user HKCU flag so subsequent
    /// launches return <see langword="false"/>.
    ///
    /// Using HKCU instead of the machine-wide config file ensures that every user
    /// account on a shared/managed machine receives the Windows location-permission
    /// prompt on their own first launch — even if another user has already created
    /// the machine-wide config file.
    /// </summary>
    private static bool CheckAndMarkFirstRunForCurrentUser()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(AppConfig.UserRegistryKeyPath);
            if (key?.GetValue(AppConfig.HasRunBeforeValueName) is not null)
                return false; // Flag already set — not first run for this user
        }
        catch { /* Fall through and treat as first run */ }

        // Flag absent — first run for this user account. Mark it now so the next
        // launch (e.g. after a crash/reboot) starts in tray mode as expected.
        try
        {
            using var writeKey = Registry.CurrentUser.CreateSubKey(
                AppConfig.UserRegistryKeyPath, writable: true);
            writeKey.SetValue(
                AppConfig.HasRunBeforeValueName, 1, RegistryValueKind.DWord);
        }
        catch { /* Non-fatal; window will be shown again next launch if write fails */ }

        return true;
    }

    private static bool ShouldStartVisible(LaunchActivatedEventArgs args)
    {
        // Check if launched with --startup flag (from Windows startup registry key)
        var cmdLine = Environment.CommandLine;
        return !cmdLine.Contains("--startup", StringComparison.OrdinalIgnoreCase);
    }
}
