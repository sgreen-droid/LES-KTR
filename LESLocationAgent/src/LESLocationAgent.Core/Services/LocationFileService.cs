using System.Text.Json;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Helpers;

namespace LESLocationAgent.Core.Services;

/// <summary>
/// Handles all file I/O for location.json, status.json, and config.json.
/// All writes are atomic: write to a temp file, then replace.
/// A good existing location is NEVER overwritten with empty/failed data.
/// </summary>
public sealed class LocationFileService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    // ---------------------------------------------------------------
    // location.json
    // ---------------------------------------------------------------

    public void WriteLocation(LocationReading reading, string permissionStatus)
    {
        try
        {
            EnsureDataDirectory();

            var locationJson = new LocationJson
            {
                Latitude = reading.Latitude,
                Longitude = reading.Longitude,
                AccuracyMeters = reading.AccuracyMeters,
                AccuracyQuality = AccuracyClassifier.Classify(reading.AccuracyMeters),
                AltitudeMeters = reading.AltitudeMeters,
                AltitudeAccuracyMeters = reading.AltitudeAccuracyMeters,
                HeadingDegrees = reading.HeadingDegrees,
                SpeedMetersPerSecond = reading.SpeedMetersPerSecond,
                PositionSource = reading.PositionSource,
                LocationSource = "Windows Geolocation",
                PermissionStatus = permissionStatus,
                TimestampUtc = reading.Timestamp.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                ComputerName = Environment.MachineName,
                AgentVersion = AppConfig.AgentVersion
            };

            WriteJsonAtomic(AppConfig.LocationFilePath, locationJson);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to write location.json: {ex.Message}", ex);
        }
    }

    public LocationJson? ReadLocation()
    {
        try
        {
            if (!File.Exists(AppConfig.LocationFilePath))
                return null;

            var json = File.ReadAllText(AppConfig.LocationFilePath);
            return JsonSerializer.Deserialize<LocationJson>(json);
        }
        catch
        {
            return null;
        }
    }

    // ---------------------------------------------------------------
    // status.json
    // ---------------------------------------------------------------

    public void WriteStatus(string locationStatus, string permissionStatus, string? error = null, DateTimeOffset? lastSuccess = null)
    {
        try
        {
            EnsureDataDirectory();

            // Preserve lastSuccessUtc from existing status if not supplied
            DateTimeOffset? effectiveLastSuccess = lastSuccess;
            if (effectiveLastSuccess is null)
            {
                var existing = ReadStatus();
                if (existing?.LastSuccessUtc is not null)
                {
                    // Keep the old success time
                    if (DateTimeOffset.TryParse(existing.LastSuccessUtc, out var parsed))
                        effectiveLastSuccess = parsed;
                }
            }

            var statusJson = new StatusJson
            {
                LastAttemptUtc = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                LastSuccessUtc = effectiveLastSuccess?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                PermissionStatus = permissionStatus,
                LocationStatus = locationStatus,
                Error = error
            };

            WriteJsonAtomic(AppConfig.StatusFilePath, statusJson);
        }
        catch { /* Status write is best-effort; do not crash the app */ }
    }

    public StatusJson? ReadStatus()
    {
        try
        {
            if (!File.Exists(AppConfig.StatusFilePath))
                return null;

            var json = File.ReadAllText(AppConfig.StatusFilePath);
            return JsonSerializer.Deserialize<StatusJson>(json);
        }
        catch
        {
            return null;
        }
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private static void EnsureDataDirectory()
    {
        try
        {
            Directory.CreateDirectory(AppConfig.DataDirectory);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Cannot create data directory {AppConfig.DataDirectory}: {ex.Message}", ex);
        }
    }

    private static void WriteJsonAtomic<T>(string destinationPath, T value)
    {
        var tempPath = destinationPath + ".tmp";

        var json = JsonSerializer.Serialize(value, JsonOptions);
        File.WriteAllText(tempPath, json);

        // Replace atomically — if destination exists, File.Move overwrites it
        File.Move(tempPath, destinationPath, overwrite: true);
    }
}
