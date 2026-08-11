using System.Text.Json.Serialization;

namespace LESLocationAgent.Core.Models;

/// <summary>
/// Written to status.json after every attempt (success or failure).
/// Lets Action1 distinguish between never-acquired, failed, stale, and denied.
/// </summary>
public sealed class StatusJson
{
    [JsonPropertyName("lastAttemptUtc")]
    public string LastAttemptUtc { get; set; } = "";

    [JsonPropertyName("lastSuccessUtc")]
    public string? LastSuccessUtc { get; set; }

    [JsonPropertyName("permissionStatus")]
    public string PermissionStatus { get; set; } = "Unknown";

    [JsonPropertyName("locationStatus")]
    public string LocationStatus { get; set; } = "Unknown";

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}
