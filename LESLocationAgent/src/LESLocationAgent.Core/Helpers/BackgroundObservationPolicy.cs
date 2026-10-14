using LESLocationAgent.Core.Models;

namespace LESLocationAgent.Core.Helpers;

/// <summary>Observation freshness is independent of uploads and coordinate movement.</summary>
public static class BackgroundObservationPolicy
{
    public static string? GetRejection(LocationReading reading, DateTimeOffset? previous, DateTimeOffset now)
    {
        if (!reading.IsValid || !double.IsFinite(reading.AccuracyMeters) || reading.AccuracyMeters <= 0)
            return "Invalid physical coordinates or accuracy.";
        if (!new[] { "WiFi", "Satellite", "Cellular" }.Contains(reading.PositionSource, StringComparer.OrdinalIgnoreCase))
            return "No approved physical location source; IP and unknown estimates are not accepted.";
        if (reading.Timestamp < now.AddMinutes(-2) || reading.Timestamp > now.AddMinutes(2))
            return "Windows returned an old or future-dated observation.";
        if (previous.HasValue && reading.Timestamp <= previous.Value)
            return "Windows repeated a previously saved observation; no new fix was obtained.";
        return null;
    }
}
