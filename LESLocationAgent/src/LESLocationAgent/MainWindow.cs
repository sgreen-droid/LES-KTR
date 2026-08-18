using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Services;
using LESLocationAgent.Services;
using Microsoft.UI;
using Microsoft.UI.Text;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.Devices.Geolocation;
using Windows.System;
using Windows.UI;

namespace LESLocationAgent;

/// <summary>
/// Main application window.
/// The entire UI is built in code — no XAML, no InitializeComponent(), no
/// Application.LoadComponent(). The compiled-XAML (XBF) loader repeatedly
/// failed with "XAML parsing failed" in this self-contained unpackaged
/// WinUI 3 configuration, so we bypass it completely.
/// </summary>
public sealed class MainWindow : Window
{
    private readonly LocationService _locationService;
    private readonly LocationFileService _fileService;
    private readonly StartupService _startupService;

    // Not readonly — assigned in StartRefreshTimer() which is called from ctor
    private DispatcherTimer _refreshTimer = null!;

    private AppConfig _config;
    private string _currentPermissionStatus = "Unknown";

    // ── UI elements (assigned in BuildUi) ────────────────────────────────────
    private TextBlock PermissionValueText  = null!;
    private TextBlock LocationStatusText   = null!;
    private TextBlock LatitudeText         = null!;
    private TextBlock LongitudeText        = null!;
    private TextBlock AccuracyText         = null!;
    private TextBlock AltitudeText         = null!;
    private TextBlock LocationSourceText   = null!;
    private TextBlock PositionSourceText   = null!;
    private TextBlock LastUpdatedText      = null!;
    private TextBlock StatusBarText        = null!;
    private Button    EnableLocationButton = null!;
    private Button    GetLocationButton    = null!;
    private Button    OpenSettingsButton   = null!;

    public MainWindow()
    {
        App.StartupLog("MainWindow ctor — building UI in code");
        BuildUi();
        App.StartupLog("MainWindow UI built");

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
    // Code-built UI (replaces MainWindow.xaml)
    // ---------------------------------------------------------------

    private void BuildUi()
    {
        Title = "LES Location Agent";

        var root = new Grid { Padding = new Thickness(20) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });                       // 0 privacy
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(16) });                    // 1 gap
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });                       // 2 fields
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(16) });                    // 3 gap
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });                       // 4 buttons
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });  // 5 spacer
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });                       // 6 status

        // Use the theme background if resolvable at runtime; fall back to system default.
        if (Application.Current.Resources.TryGetValue("ApplicationPageBackgroundThemeBrush", out var bg)
            && bg is Brush bgBrush)
        {
            root.Background = bgBrush;
        }

        // ── Privacy notice ───────────────────────────────────────────────────
        var privacyBorder = new Border
        {
            Background   = new SolidColorBrush(Color.FromArgb(255, 0xDE, 0xEA, 0xF7)),
            CornerRadius = new CornerRadius(4),
            Padding      = new Thickness(12, 8, 12, 8),
            Child = new TextBlock
            {
                TextWrapping = TextWrapping.Wrap,
                Foreground   = new SolidColorBrush(Color.FromArgb(255, 0x1A, 0x3A, 0x5C)),
                FontSize     = 12,
                Text = "This organization-owned computer uses Windows Location Services for " +
                       "device management and recovery. Location access is controlled by " +
                       "Windows privacy settings.",
            },
        };
        Grid.SetRow(privacyBorder, 0);
        root.Children.Add(privacyBorder);

        // ── Data fields ──────────────────────────────────────────────────────
        var fields = new Grid();
        fields.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(180) });
        fields.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        PermissionValueText = AddFieldRow(fields, 0, "Location Permission:");
        LocationStatusText  = AddFieldRow(fields, 1, "Windows Location Status:");
        LatitudeText        = AddFieldRow(fields, 2, "Latitude:",  monospace: true);
        LongitudeText       = AddFieldRow(fields, 3, "Longitude:", monospace: true);
        AccuracyText        = AddFieldRow(fields, 4, "Accuracy:");
        AltitudeText        = AddFieldRow(fields, 5, "Altitude:");
        LocationSourceText  = AddFieldRow(fields, 6, "Location Source:", initial: "Windows Geolocation");
        PositionSourceText  = AddFieldRow(fields, 7, "Position Source:");
        LastUpdatedText     = AddFieldRow(fields, 8, "Last Updated:");

        Grid.SetRow(fields, 2);
        root.Children.Add(fields);

        // ── Buttons ──────────────────────────────────────────────────────────
        EnableLocationButton = new Button { Content = "Enable Location",       MinWidth = 130 };
        GetLocationButton    = new Button { Content = "Get Location",          MinWidth = 130 };
        OpenSettingsButton   = new Button { Content = "Open Location Settings", MinWidth = 160 };

        // Accent style for the primary button — runtime lookup, never fails the build
        if (Application.Current.Resources.TryGetValue("AccentButtonStyle", out var accent)
            && accent is Style accentStyle)
        {
            GetLocationButton.Style = accentStyle;
        }

        EnableLocationButton.Click += EnableLocationButton_Click;
        GetLocationButton.Click    += GetLocationButton_Click;
        OpenSettingsButton.Click   += OpenSettingsButton_Click;

        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        buttons.Children.Add(EnableLocationButton);
        buttons.Children.Add(GetLocationButton);
        buttons.Children.Add(OpenSettingsButton);
        Grid.SetRow(buttons, 4);
        root.Children.Add(buttons);

        // ── Status bar ───────────────────────────────────────────────────────
        StatusBarText = new TextBlock
        {
            Text       = "Ready",
            FontSize   = 12,
            Foreground = new SolidColorBrush(Color.FromArgb(255, 0x66, 0x66, 0x66)),
        };
        var statusBorder = new Border
        {
            BorderBrush     = new SolidColorBrush(Color.FromArgb(255, 0xCC, 0xCC, 0xCC)),
            BorderThickness = new Thickness(0, 1, 0, 0),
            Padding         = new Thickness(0, 8, 0, 0),
            Child           = StatusBarText,
        };
        Grid.SetRow(statusBorder, 6);
        root.Children.Add(statusBorder);

        Content = root;
    }

    /// <summary>Adds a label + value row to the fields grid; returns the value TextBlock.</summary>
    private static TextBlock AddFieldRow(
        Grid grid, int row, string label, bool monospace = false, string initial = "—")
    {
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var labelBlock = new TextBlock
        {
            Text              = label,
            FontWeight        = FontWeights.SemiBold,
            VerticalAlignment = VerticalAlignment.Center,
            Margin            = new Thickness(0, 4, 0, 4),
        };
        Grid.SetRow(labelBlock, row);
        Grid.SetColumn(labelBlock, 0);
        grid.Children.Add(labelBlock);

        var valueBlock = new TextBlock
        {
            Text              = initial,
            VerticalAlignment = VerticalAlignment.Center,
            Margin            = new Thickness(8, 4, 8, 4),
        };
        if (monospace)
            valueBlock.FontFamily = new FontFamily("Consolas");
        Grid.SetRow(valueBlock, row);
        Grid.SetColumn(valueBlock, 1);
        grid.Children.Add(valueBlock);

        return valueBlock;
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

    public void ShowFromTray()
    {
        GetAppWindow()?.Show();
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
