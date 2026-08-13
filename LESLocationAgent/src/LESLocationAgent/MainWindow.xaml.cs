using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Services;
using LESLocationAgent.Services;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Windows.Devices.Geolocation;
using Windows.System;

namespace LESLocationAgent;

/// <summary>
/// Main application window.
/// Handles location acquisition, display, auto-refresh timer, and tray integration.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly LocationService _locationService;
    private readonly LocationFileService _fileService;
    private readonly StartupService _startupService;

    // Not readonly — assigned in StartRefreshTimer() which is called from ctor
    private DispatcherTimer _refreshTimer = null!;

    private AppConfig _config;
    private string _currentPermissionStatus = "Unknown";

    public MainWindow()
    {
        InitializeComponent();

        _locationService = new LocationService();
        _fileService     = new LocationFileService();
        _startupService  = new StartupService();
        _config          = AppConfig.LoadOrDefault();

        ConfigureWindow();
        StartRefreshTimer();

        // Register startup so the agent auto-launches on sign-in
        _startupService.Enable();

        // Request permission immediately on load (non-blocking)
        _ = CheckPermissionOnLoadAsync();
    }

    // ---------------------------------------------------------------
    // Window configuration
    // ---------------------------------------------------------------

    private void ConfigureWindow()
    {
        var appWindow = GetAppWindow();
        if (appWindow is null) return;

        appWindow.Title = "LES Location Agent";
        appWindow.Resize(new Windows.Graphics.SizeInt32(560, 500));

        // Centre on primary monitor
        if (DisplayArea.GetFromWindowId(appWindow.Id, DisplayAreaFallback.Primary) is { } display)
        {
            var x = (display.WorkArea.Width  - 560) / 2 + display.WorkArea.X;
            var y = (display.WorkArea.Height - 500) / 2 + display.WorkArea.Y;
            appWindow.Move(new Windows.Graphics.PointInt32(x, y));
        }

        // Closing → minimize to tray instead of quit
        appWindow.Closing += (_, e) =>
        {
            e.Cancel = true;
            MinimizeToTray();
        };
    }

    private AppWindow? GetAppWindow()
    {
        var hWnd      = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var windowId  = Win32Interop.GetWindowIdFromWindow(hWnd);
        return AppWindow.GetFromWindowId(windowId);
    }

    // ---------------------------------------------------------------
    // Show / hide (called by App.xaml.cs tray menu)
    // ---------------------------------------------------------------

    public void MinimizeToTray()
    {
        // WinUI 3 Window has no Hide() method — hide via AppWindow instead
        GetAppWindow()?.Hide();
    }

    public void BringToFront()
    {
        GetAppWindow()?.MoveInZOrderAtTop();
    }

    // ---------------------------------------------------------------
    // Permission check on load
    // ---------------------------------------------------------------

    private async Task CheckPermissionOnLoadAsync()
    {
        try
        {
            var status = await Geolocator.RequestAccessAsync();
            UpdatePermissionDisplay(status);
        }
        catch (Exception ex)
        {
            SetStatus($"Permission check failed: {ex.Message}");
        }
    }

    // ---------------------------------------------------------------
    // Button handlers
    // ---------------------------------------------------------------

    private async void EnableLocationButton_Click(object sender, RoutedEventArgs e)
    {
        SetStatus("Requesting location permission…");
        try
        {
            var status = await Geolocator.RequestAccessAsync();
            UpdatePermissionDisplay(status);
        }
        catch (Exception ex)
        {
            SetStatus($"Error: {ex.Message}");
        }
    }

    private async void GetLocationButton_Click(object sender, RoutedEventArgs e)
    {
        await GetLocationAsync();
    }

    private async void OpenSettingsButton_Click(object sender, RoutedEventArgs e)
    {
        await Launcher.LaunchUriAsync(new Uri("ms-settings:privacy-location"));
    }

    // ---------------------------------------------------------------
    // Location acquisition (called by button, timer, and tray menu)
    // ---------------------------------------------------------------

    public async Task GetLocationAsync()
    {
        SetStatus("Requesting location…");
        SetButtonsEnabled(false);
        UpdateWindowsLocationStatus("Requesting location…");

        try
        {
            var result = await _locationService.GetBestLocationAsync(_config);

            if (result.Reading is not null)
            {
                UpdateLocationDisplay(result.Reading);
                _fileService.WriteLocation(result.Reading, _currentPermissionStatus);
                _fileService.WriteStatus(
                    "Success",
                    _currentPermissionStatus,
                    lastSuccess: result.Reading.Timestamp);

                var quality = AccuracyClassifier.Classify(result.Reading.AccuracyMeters);
                SetStatus($"Location acquired  ·  {result.Reading.AccuracyMeters:F1} m  ·  {quality}");
                App.Current.UpdateTrayStatus(
                    $"Updated {result.Reading.Timestamp.LocalDateTime:HH:mm:ss}");
            }
            else
            {
                SetStatus($"Location unavailable: {result.ErrorMessage}");
                _fileService.WriteStatus(
                    result.LocationStatus, _currentPermissionStatus, error: result.ErrorMessage);
                UpdateWindowsLocationStatus(result.LocationStatus);
                App.Current.UpdateTrayStatus("Location unavailable");
            }
        }
        catch (Exception ex)
        {
            SetStatus($"Unexpected error: {ex.Message}");
            _fileService.WriteStatus("Error", _currentPermissionStatus, error: ex.Message);
        }
        finally
        {
            SetButtonsEnabled(true);
        }
    }

    // ---------------------------------------------------------------
    // Auto-refresh timer
    // ---------------------------------------------------------------

    private void StartRefreshTimer()
    {
        _refreshTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMinutes(_config.EffectiveRefreshMinutes)
        };
        _refreshTimer.Tick += async (_, _) => await GetLocationAsync();
        _refreshTimer.Start();
    }

    // ---------------------------------------------------------------
    // UI update helpers
    // ---------------------------------------------------------------

    private void UpdatePermissionDisplay(GeolocationAccessStatus status)
    {
        _currentPermissionStatus = status.ToString();

        PermissionValueText.Text = status switch
        {
            GeolocationAccessStatus.Allowed     => "✓ Allowed",
            GeolocationAccessStatus.Denied      => "✗ Denied",
            GeolocationAccessStatus.Unspecified => "Unspecified",
            _                                   => status.ToString()
        };

        SetStatus(status switch
        {
            GeolocationAccessStatus.Denied =>
                "Location permission is disabled. Enable location access in Windows Settings.",
            GeolocationAccessStatus.Allowed =>
                "Permission granted. Click Get Location to retrieve coordinates.",
            _ =>
                "Location permission status: Unspecified."
        });
    }

    private void UpdateLocationDisplay(LocationReading reading)
    {
        LatitudeText.Text  = reading.Latitude.ToString("F6");
        LongitudeText.Text = reading.Longitude.ToString("F6");
        AccuracyText.Text  =
            $"{reading.AccuracyMeters:F1} meters  ({AccuracyClassifier.Classify(reading.AccuracyMeters)})";
        AltitudeText.Text  = reading.AltitudeMeters.HasValue
            ? $"{reading.AltitudeMeters.Value:F1} meters"
            : "Not available";
        PositionSourceText.Text = reading.PositionSource;
        LastUpdatedText.Text    = reading.Timestamp.LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss");
        UpdateWindowsLocationStatus("Location acquired");
    }

    private void UpdateWindowsLocationStatus(string status)
    {
        LocationStatusText.Text = status switch
        {
            "Success" or "Location acquired" => "Location acquired",
            "PermissionDenied"               => "Permission denied",
            "TimedOut"                       => "Timed out",
            "Unavailable"                    => "Location unavailable",
            "InvalidCoordinates"             => "Invalid coordinates",
            "Error"                          => "Error",
            _                                => status
        };
    }

    private void SetStatus(string message)
    {
        if (DispatcherQueue is not null)
            DispatcherQueue.TryEnqueue(() => StatusBarText.Text = message);
        else
            StatusBarText.Text = message;
    }

    private void SetButtonsEnabled(bool enabled)
    {
        DispatcherQueue?.TryEnqueue(() =>
        {
            EnableLocationButton.IsEnabled = enabled;
            GetLocationButton.IsEnabled    = enabled;
        });
    }
}
