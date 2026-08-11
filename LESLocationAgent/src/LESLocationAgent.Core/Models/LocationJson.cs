using System.Text.Json.Serialization;

namespace LESLocationAgent.Core.Models;

/// <summary>
/// Serialised form written to location.json.
/// All field names are camelCase to match the spec exactly.
/// </summary>
public sealed class LocationJson
{
    [JsonPropertyName("latitude")]
    public double Latitude { get; set; }

    [JsonPropertyName("longitude")]
    public double Longitude { get; set; }

    [JsonPropertyName("accuracyMeters")]
    public double AccuracyMeters { get; set; }

    [JsonPropertyName("accuracyQuality")]
    public string AccuracyQuality { get; set; } = "UNKNOWN";

    [JsonPropertyName("altitudeMeters")]
    public double? AltitudeMeters { get; set; }

    [JsonPropertyName("altitudeAccuracyMeters")]
    public double? AltitudeAccuracyMeters { get; set; }

    [JsonPropertyName("headingDegrees")]
    public double? HeadingDegrees { get; set; }

    [JsonPropertyName("speedMetersPerSecond")]
    public double? SpeedMetersPerSecond { get; set; }

    [JsonPropertyName("positionSource")]
    public string PositionSource { get; set; } = "Unknown";

    [JsonPropertyName("locationSource")]
    public string LocationSource { get; set; } = "Windows Geolocation";

    [JsonPropertyName("permissionStatus")]
    public string PermissionStatus { get; set; } = "Unknown";

    [JsonPropertyName("timestampUtc")]
    public string TimestampUtc { get; set; } = "";

    [JsonPropertyName("computerName")]
    public string ComputerName { get; set; } = Environment.MachineName;

    [JsonPropertyName("agentVersion")]
    public string AgentVersion { get; set; } = AppConfig.AgentVersion;
}
