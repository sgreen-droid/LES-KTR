using System.Text.Json.Serialization;

namespace LESLocationAgent.Core.Models;

/// <summary>
/// Installation-scoped recovery identity. This is deliberately random rather
/// than derived from a MAC address, BIOS value, or user account.
/// </summary>
public sealed class DeviceIdentity
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = "";

    [JsonPropertyName("createdUtc")]
    public string CreatedUtc { get; set; } = "";

    [JsonPropertyName("lastRecordSequence")]
    public long LastRecordSequence { get; set; }

    /// <summary>
    /// A machine-local key used to detect accidental or unexpected file edits.
    /// It is not a defense against a local user who can read this state file.
    /// </summary>
    [JsonPropertyName("integrityKey")]
    public string IntegrityKey { get; set; } = "";
}