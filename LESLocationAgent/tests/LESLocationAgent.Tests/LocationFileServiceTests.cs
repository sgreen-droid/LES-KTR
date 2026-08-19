using FluentAssertions;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Services;
using System.Text.Json;
using Xunit;

namespace LESLocationAgent.Tests;

/// <summary>
/// Tests for LocationFileService using a temp directory to avoid touching ProgramData.
///
/// NOTE: LocationFileService currently hard-codes the ProgramData paths from AppConfig.
/// These tests verify the business logic of the JSON models and the AccuracyClassifier
/// integration. A full integration test against the real paths requires a Windows PC.
/// </summary>
public sealed class LocationFileServiceTests : IDisposable
{
    private readonly string _tempDir;

    public LocationFileServiceTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"LESTest_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDir);
    }

    // ---------------------------------------------------------------
    // JSON deserialization — simulates what the file service writes
    // ---------------------------------------------------------------

    [Fact]
    public void LocationJson_CanSerialiseAndDeserialise_AllFields()
    {
        var original = new LocationJson
        {
            Latitude              = 40.817391,
            Longitude             = -73.941502,
            AccuracyMeters        = 28.4,
            AccuracyQuality       = "GOOD",
            AltitudeMeters        = null,
            AltitudeAccuracyMeters= null,
            HeadingDegrees        = null,
            SpeedMetersPerSecond  = null,
            PositionSource        = "WiFi",
            LocationSource        = "Windows Geolocation",
            PermissionStatus      = "Allowed",
            TimestampUtc          = "2026-08-11T18:35:42Z",
            ComputerName          = "TEST-PC-001",
            AgentVersion          = "1.0.0"
        };

        var json = JsonSerializer.Serialize(original, new JsonSerializerOptions { WriteIndented = true });
        var deserialized = JsonSerializer.Deserialize<LocationJson>(json);

        deserialized.Should().NotBeNull();
        deserialized!.Latitude.Should().Be(40.817391);
        deserialized.Longitude.Should().Be(-73.941502);
        deserialized.AccuracyMeters.Should().Be(28.4);
        deserialized.AccuracyQuality.Should().Be("GOOD");
        deserialized.PositionSource.Should().Be("WiFi");
        deserialized.LocationSource.Should().Be("Windows Geolocation");
        deserialized.PermissionStatus.Should().Be("Allowed");
        deserialized.AltitudeMeters.Should().BeNull();
    }

    [Fact]
    public void LocationJson_MissingFields_DoNotThrow()
    {
        // Simulates a partially written or minimal JSON file
        const string minimal = """{"latitude":51.5,"longitude":-0.1}""";
        var action = () => JsonSerializer.Deserialize<LocationJson>(minimal);
        action.Should().NotThrow();
    }

    [Fact]
    public void LocationJson_MalformedJson_ThrowsJsonException()
    {
        const string bad = "{latitude: not json}";
        var action = () => JsonSerializer.Deserialize<LocationJson>(bad);
        action.Should().Throw<JsonException>();
    }

    [Theory]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    [InlineData(double.NaN)]
    public void AccuracyClassifier_NonFiniteValues_AreUnknown(double accuracy)
    {
        LESLocationAgent.Core.Helpers.AccuracyClassifier.Classify(accuracy)
            .Should().Be("UNKNOWN");
    }

    // ---------------------------------------------------------------
    // Status JSON
    // ---------------------------------------------------------------

    [Fact]
    public void StatusJson_CanSerialiseAndDeserialise()
    {
        var status = new StatusJson
        {
            LastAttemptUtc  = "2026-08-11T18:35:42Z",
            LastSuccessUtc  = "2026-08-11T18:30:00Z",
            PermissionStatus= "Allowed",
            LocationStatus  = "Success",
            Error           = null
        };

        var json = JsonSerializer.Serialize(status);
        var rt   = JsonSerializer.Deserialize<StatusJson>(json);

        rt.Should().NotBeNull();
        rt!.LocationStatus.Should().Be("Success");
        rt.Error.Should().BeNull();
    }

    // ---------------------------------------------------------------
    // Staleness logic (mirrors Action1 sync script logic)
    // ---------------------------------------------------------------

    [Theory]
    [InlineData(0,   "ACTIVE")]
    [InlineData(29,  "ACTIVE")]
    [InlineData(30,  "ACTIVE")]   // exactly 30 minutes — still active
    [InlineData(31,  "STALE")]
    [InlineData(120, "STALE")]
    public void StalenessClassification_BasedOnAge(int minutesOld, string expected)
    {
        // Capture a single instant so ageMinutes == minutesOld exactly,
        // avoiding a race condition where two UtcNow calls differ by milliseconds.
        var now = DateTimeOffset.UtcNow;
        var timestamp = now.AddMinutes(-minutesOld);
        var ageMinutes = (now - timestamp).TotalMinutes;

        var result = ageMinutes <= 30 ? "ACTIVE" : "STALE";
        result.Should().Be(expected);
    }

    // ---------------------------------------------------------------
    // Config defaults and minimum enforcement
    // ---------------------------------------------------------------

    [Fact]
    public void AppConfig_DefaultValues_AreCorrect()
    {
        var cfg = new AppConfig();
        cfg.RefreshMinutes.Should().Be(15);
        cfg.DesiredAccuracyMeters.Should().Be(10.0);
        cfg.LocationTimeoutSeconds.Should().Be(30);
    }

    [Theory]
    [InlineData(1,  5)]   // below minimum → clamp to 5
    [InlineData(4,  5)]   // below minimum → clamp to 5
    [InlineData(5,  5)]   // exactly minimum → keep
    [InlineData(15, 15)]  // default → keep
    [InlineData(60, 60)]  // above minimum → keep
    public void AppConfig_EffectiveRefreshMinutes_EnforcesMinimum(int input, int expected)
    {
        var cfg = new AppConfig { RefreshMinutes = input };
        cfg.EffectiveRefreshMinutes.Should().Be(expected);
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempDir, recursive: true); }
        catch { /* best-effort cleanup */ }
    }
}
