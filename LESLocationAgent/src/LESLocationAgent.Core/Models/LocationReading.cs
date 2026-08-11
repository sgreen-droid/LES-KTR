namespace LESLocationAgent.Core.Models;

/// <summary>
/// In-memory representation of a single location fix obtained from Windows.
/// </summary>
public sealed class LocationReading
{
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public double AccuracyMeters { get; init; }
    public DateTimeOffset Timestamp { get; init; }

    public double? AltitudeMeters { get; init; }
    public double? AltitudeAccuracyMeters { get; init; }
    public double? HeadingDegrees { get; init; }
    public double? SpeedMetersPerSecond { get; init; }
    public string PositionSource { get; init; } = "Unknown";

    public bool IsValid =>
        Latitude >= -90 && Latitude <= 90 &&
        Longitude >= -180 && Longitude <= 180;
}
