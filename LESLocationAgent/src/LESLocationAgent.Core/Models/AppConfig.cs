using System.Text.Json;
using System.Text.Json.Serialization;

namespace LESLocationAgent.Core.Models;

/// <summary>
/// Configuration loaded from C:\ProgramData\LESLocationAgent\config.json
/// </summary>
public sealed class AppConfig
{
    public const string DataDirectory = @"C:\ProgramData\LESLocationAgent";
    public const string ConfigFilePath = @"C:\ProgramData\LESLocationAgent\config.json";
    public const string LocationFilePath = @"C:\ProgramData\LESLocationAgent\location.json";
    public const string StatusFilePath = @"C:\ProgramData\LESLocationAgent\status.json";
    public const string DeviceIdentityFilePath = @"C:\ProgramData\LESLocationAgent\agent-state.json";
    public const int MinRefreshMinutes = 5;
    public const string AgentVersion = "1.1.0";

    // Per-user first-run flag stored in HKCU so every user account gets the
    // location-permission prompt on their first launch, regardless of whether
    // another user has already created the machine-wide config file.
    public const string UserRegistryKeyPath = @"Software\LES\LESLocationAgent";
    public const string HasRunBeforeValueName = "HasRunBefore";

    [JsonPropertyName("refreshMinutes")]
    public int RefreshMinutes { get; set; } = 15;

    [JsonPropertyName("desiredAccuracyMeters")]
    public double DesiredAccuracyMeters { get; set; } = 10.0;

    [JsonPropertyName("locationTimeoutSeconds")]
    public int LocationTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Effective refresh interval, never below the 5-minute minimum.
    /// </summary>
    [JsonIgnore]
    public int EffectiveRefreshMinutes => Math.Max(RefreshMinutes, MinRefreshMinutes);

    public static AppConfig LoadOrDefault()
    {
        try
        {
            if (File.Exists(ConfigFilePath))
            {
                var json = File.ReadAllText(ConfigFilePath);
                var cfg = JsonSerializer.Deserialize<AppConfig>(json);
                if (cfg is not null)
                {
                    // Enforce minimum
                    if (cfg.RefreshMinutes < MinRefreshMinutes)
                        cfg.RefreshMinutes = MinRefreshMinutes;
                    return cfg;
                }
            }
        }
        catch { /* Fall through to defaults */ }

        return new AppConfig();
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(DataDirectory);
            var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(ConfigFilePath, json);
        }
        catch { /* Non-fatal */ }
    }
}
