using H.NotifyIcon;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
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

    private MainWindow? _mainWindow;
    private TaskbarIcon? _trayIcon;

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
            // Another instance is already running — signal it and exit
            Exit();
            return;
        }

        // Initialise tray icon from Application resources
        _trayIcon = (TaskbarIcon)Resources["TrayIcon"];
        WireTrayMenuHandlers();

        bool isFirstRun = !File.Exists(AppConfig.ConfigFilePath);

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

    private static bool ShouldStartVisible(LaunchActivatedEventArgs args)
    {
        // Check if launched with --startup flag (from Windows startup registry key)
        var cmdLine = Environment.CommandLine;
        return !cmdLine.Contains("--startup", StringComparison.OrdinalIgnoreCase);
    }
}
