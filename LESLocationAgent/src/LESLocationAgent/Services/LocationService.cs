using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using Windows.Devices.Geolocation;

namespace LESLocationAgent.Services;

/// <summary>
/// Wraps Windows.Devices.Geolocation.Geolocator to obtain the best available fix.
///
/// Strategy:
///   1. Request a high-accuracy position.
///   2. Collect up to 3 readings over roughly 15–30 seconds.
///   3. Keep the reading with the LOWEST accuracy radius.
///   4. Stop early if accuracy reaches the "excellent" threshold (≤20 m).
///   5. Never loop forever.
/// </summary>
public sealed class LocationService
{
    private const int MaxReadings = 3;
    private static readonly TimeSpan DelayBetweenReadings = TimeSpan.FromSeconds(8);

    /// <summary>
    /// Result returned to the caller; either a valid reading or a structured error.
    /// </summary>
    public sealed class LocationResult
    {
        public LocationReading? Reading { get; init; }
        public string LocationStatus { get; init; } = "Unknown";
        public string? ErrorMessage { get; init; }
    }

    public async Task<LocationResult> GetBestLocationAsync(AppConfig config)
    {
        LocationReading? best = null;
        string locationStatus = "Unavailable";
        string? errorMessage  = null;

        for (int attempt = 0; attempt < MaxReadings; attempt++)
        {
            try
            {
                var geolocator = new Geolocator
                {
                    DesiredAccuracy = PositionAccuracy.High,
                    DesiredAccuracyInMeters = (uint)Math.Max(1, config.DesiredAccuracyMeters)
                };

                var cts = new CancellationTokenSource(
                    TimeSpan.FromSeconds(config.LocationTimeoutSeconds));

                Geoposition position = await geolocator.GetGeopositionAsync(
                    maximumAge: TimeSpan.FromSeconds(30),
                    timeout:    TimeSpan.FromSeconds(config.LocationTimeoutSeconds))
                    .AsTask(cts.Token);

                var reading = MapToReading(position);

                if (!reading.IsValid)
                {
                    errorMessage = "Windows returned invalid coordinates.";
                    locationStatus = "InvalidCoordinates";
                    continue;
                }

                // Keep the reading with the smallest accuracy radius
                if (best is null || reading.AccuracyMeters < best.AccuracyMeters)
                {
                    best = reading;
                    locationStatus = "Success";
                    errorMessage   = null;
                }

                // Stop early if quality is excellent
                if (AccuracyClassifier.IsEarlyStopQuality(reading.AccuracyMeters))
                    break;

                // Wait before next reading (unless this is the last attempt)
                if (attempt < MaxReadings - 1)
                    await Task.Delay(DelayBetweenReadings);
            }
            catch (OperationCanceledException)
            {
                locationStatus = "TimedOut";
                errorMessage   = $"Location request timed out after {config.LocationTimeoutSeconds} seconds.";
                break;
            }
            catch (System.Runtime.InteropServices.COMException comEx) when (
                comEx.HResult is unchecked((int)0x80004004) or  // E_ABORT
                               unchecked((int)0x800700AA))      // ERROR_BUSY
            {
                locationStatus = "Unavailable";
                errorMessage   = "Location services are disabled or unavailable.";
                break;
            }
            catch (UnauthorizedAccessException)
            {
                locationStatus = "PermissionDenied";
                errorMessage   = "Location access denied by Windows.";
                break;
            }
            catch (Exception ex)
            {
                locationStatus = "Error";
                errorMessage   = ex.Message;
                // Try fallback on first failure only
                if (attempt == 0)
                {
                    var fallback = await TryFallbackAsync(config);
                    if (fallback is not null)
                    {
                        best = fallback;
                        locationStatus = "Success";
                        errorMessage   = null;
                    }
                }
                break;
            }
        }

        return new LocationResult
        {
            Reading        = best,
            LocationStatus = locationStatus,
            ErrorMessage   = errorMessage
        };
    }

    /// <summary>
    /// One relaxed fallback attempt with a longer maximum age.
    /// </summary>
    private static async Task<LocationReading?> TryFallbackAsync(AppConfig config)
    {
        try
        {
            var geolocator = new Geolocator
            {
                DesiredAccuracy = PositionAccuracy.Default
            };

            var position = await geolocator.GetGeopositionAsync(
                maximumAge: TimeSpan.FromSeconds(120),
                timeout:    TimeSpan.FromSeconds(config.LocationTimeoutSeconds));

            var reading = MapToReading(position);
            return reading.IsValid ? reading : null;
        }
        catch
        {
            return null;
        }
    }

    // ---------------------------------------------------------------
    // Mapping
    // ---------------------------------------------------------------

    private static LocationReading MapToReading(Geoposition position)
    {
        var coord = position.Coordinate;
        var point = coord.Point.Position;

        // PositionSource is available on GeocoordinateSatelliteData or via the property
        string positionSource = "Unknown";
        try
        {
            // PositionSource property added in Windows 10 Anniversary Update
            positionSource = coord.PositionSource.ToString();
        }
        catch { /* Property unavailable on this Windows version */ }

        double? altitude = null;
        try { if (!double.IsNaN(point.Altitude)) altitude = point.Altitude; }
        catch { }

        double? altitudeAccuracy = null;
        try { if (coord.AltitudeAccuracy.HasValue && double.IsFinite(coord.AltitudeAccuracy.Value)) altitudeAccuracy = coord.AltitudeAccuracy.Value; }
        catch { }

        double? heading = null;
        try { if (coord.Heading.HasValue && double.IsFinite(coord.Heading.Value)) heading = coord.Heading.Value; }
        catch { }

        double? speed = null;
        try { if (coord.Speed.HasValue && double.IsFinite(coord.Speed.Value)) speed = coord.Speed.Value; }
        catch { }

        // coord.Accuracy can be NaN/Infinity from WiFi/IP sources — clamp to null-safe zero
        var accuracy = double.IsFinite(coord.Accuracy) ? coord.Accuracy : 0.0;

        return new LocationReading
        {
            Latitude              = point.Latitude,
            Longitude             = point.Longitude,
            AccuracyMeters        = accuracy,
            Timestamp             = coord.Timestamp,
            AltitudeMeters        = altitude,
            AltitudeAccuracyMeters= altitudeAccuracy,
            HeadingDegrees        = heading,
            SpeedMetersPerSecond  = speed,
            PositionSource        = positionSource
        };
    }
}
