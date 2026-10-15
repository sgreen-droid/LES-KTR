using System.Text.Json;
using FluentAssertions;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Services;
using Xunit;

namespace LESLocationAgent.Tests;

public sealed class IdentityProtectionTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"les-identity-{Guid.NewGuid():N}");
    private string State => Path.Combine(_directory, "agent-state.json");
    private DeviceIdentityService Service => new(State);

    public IdentityProtectionTests() => Directory.CreateDirectory(_directory);

    [Theory]
    [InlineData("")]
    [InlineData("{")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("{\"integrityKey\":\"not-a-key\"}")]
    public void DamagedExistingIdentity_IsNeverReplaced(string contents)
    {
        File.WriteAllText(State, contents);
        var action = () => Service.GetOrCreate();
        action.Should().Throw<IdentityProtectionException>();
        File.ReadAllText(State).Should().Be(contents);
        File.Exists(State + ".initialized").Should().BeFalse();
    }

    [Theory]
    [InlineData("deviceId")]
    [InlineData("createdUtc")]
    [InlineData("lastRecordSequence")]
    [InlineData("integrityKey")]
    public void MissingRequiredField_DoesNotResetAnOtherwisePlausibleIdentity(string field)
    {
        var identity = Service.GetOrCreate();
        var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(identity))!;
        data.Remove(field);
        File.WriteAllText(State, JsonSerializer.Serialize(data));
        var before = File.ReadAllBytes(State);
        var action = () => Service.ReserveNextLocationRecord();
        action.Should().Throw<IdentityProtectionException>();
        File.ReadAllBytes(State).Should().Equal(before);
    }

    [Fact]
    public void DuplicateFields_AreRejectedWithoutRewriting()
    {
        var identity = Service.GetOrCreate();
        var contents = JsonSerializer.Serialize(identity);
        contents = contents.Insert(1, "\"lastRecordSequence\":42,");
        File.WriteAllText(State, contents);
        var action = () => Service.GetOrCreate();
        action.Should().Throw<IdentityProtectionException>();
        File.ReadAllText(State).Should().Be(contents);
    }

    [Theory]
    [InlineData("id")]
    [InlineData("key")]
    [InlineData("created")]
    [InlineData("counter")]
    public void InvalidExistingValues_ArePreservedAndBlocked(string field)
    {
        var identity = Service.GetOrCreate();
        if (field == "id") identity.DeviceId = Guid.Empty.ToString("D");
        if (field == "key") identity.IntegrityKey = "invalid";
        if (field == "created") identity.CreatedUtc = "invalid";
        if (field == "counter") identity.LastRecordSequence = -1;
        var contents = JsonSerializer.Serialize(identity);
        File.WriteAllText(State, contents);
        var action = () => Service.ReserveNextLocationRecord();
        action.Should().Throw<IdentityProtectionException>();
        File.ReadAllText(State).Should().Be(contents);
    }

    [Fact]
    public void UnreadableExistingIdentity_IsNotTreatedAsMissing()
    {
        Service.GetOrCreate();
        var before = File.ReadAllBytes(State);
        using (var exclusive = new FileStream(State, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
        {
            var action = () => Service.GetOrCreate();
            action.Should().Throw<IdentityProtectionException>();
        }
        File.ReadAllBytes(State).Should().Equal(before);
    }

    [Fact]
    public void IdentityPathOccupiedByDirectory_IsNotAFirstInstall()
    {
        Directory.CreateDirectory(State);
        var action = () => Service.GetOrCreate();
        action.Should().Throw<IdentityProtectionException>();
        Directory.Exists(State).Should().BeTrue();
    }

    [Fact]
    public void DeletedIdentity_IsBlockedByInitializationSafeguard()
    {
        Service.GetOrCreate();
        File.Delete(State);
        var action = () => Service.GetOrCreate();
        action.Should().Throw<IdentityProtectionException>().WithMessage("*missing*");
        File.Exists(State).Should().BeFalse();
    }

    [Theory]
    [InlineData("location.json")]
    [InlineData("status.json")]
    public void MissingIdentityWithHistoricalEvidence_CannotCreateReplacement(string evidence)
    {
        File.WriteAllText(Path.Combine(_directory, evidence), "{}");
        var action = () => Service.GetOrCreate();
        action.Should().Throw<IdentityProtectionException>().WithMessage("*prior installation evidence*");
        File.Exists(State).Should().BeFalse();
    }

    [Fact]
    public void Verification_DoesNotInitializeMissingIdentityOrDataDirectory()
    {
        var directory = Path.Combine(_directory, "not-created");
        var service = new DeviceIdentityService(Path.Combine(directory, "agent-state.json"));
        service.VerifyLocationIntegrity(new LocationJson
        {
            DeviceId = Guid.NewGuid().ToString("D"),
            IntegrityHmac = new string('0', 64),
            IntegrityAlgorithm = DeviceIdentityService.IntegrityAlgorithm
        }).Should().BeFalse();
        Directory.Exists(directory).Should().BeFalse();
    }

    [Fact]
    public void Verification_IsReadOnlyEvenForPreSafeguardInstallations()
    {
        var identity = Service.ReserveNextLocationRecord();
        File.Delete(State + ".initialized");
        File.Delete(State + ".lock");
        var before = File.ReadAllBytes(State);
        var record = new LocationJson
        {
            DeviceId = identity.DeviceId, RecordSequence = 1, Latitude = 51.5,
            Longitude = -0.125, AccuracyMeters = 40, TimestampUtc = "2026-01-01T12:00:00Z",
            PermissionStatus = "Allowed", AgentVersion = AppConfig.AgentVersion,
            IntegrityAlgorithm = DeviceIdentityService.IntegrityAlgorithm
        };
        record.IntegrityHmac = Service.CreateLocationIntegrityHmac(identity, record);
        Service.VerifyLocationIntegrity(record).Should().BeTrue();
        File.ReadAllBytes(State).Should().Equal(before);
        File.Exists(State + ".initialized").Should().BeFalse();
        File.Exists(State + ".lock").Should().BeFalse();
    }

    [Fact]
    public void ExhaustedCounter_IsNotWrappedOrReset()
    {
        var identity = Service.GetOrCreate();
        identity.LastRecordSequence = long.MaxValue;
        File.WriteAllText(State, JsonSerializer.Serialize(identity));
        var before = File.ReadAllBytes(State);
        var action = () => Service.ReserveNextLocationRecord();
        action.Should().Throw<IdentityProtectionException>().WithMessage("*exhausted*");
        File.ReadAllBytes(State).Should().Equal(before);
    }

    [Fact]
    public void ValidLegacyIdentity_WithoutSafeguard_KeepsKeyIdAndCounter()
    {
        var identity = Service.ReserveNextLocationRecord();
        File.Delete(State + ".initialized");
        var before = File.ReadAllBytes(State);
        var current = Service.GetOrCreate();
        current.DeviceId.Should().Be(identity.DeviceId);
        current.IntegrityKey.Should().Be(identity.IntegrityKey);
        current.LastRecordSequence.Should().Be(1);
        File.ReadAllBytes(State).Should().Equal(before);
        File.Exists(State + ".initialized").Should().BeTrue();
    }

    [Fact]
    public void BlockedIdentity_ReportsExplicitStatus_AndPreservesLocationAndSuccess()
    {
        var files = new LocationFileService(_directory);
        files.WriteLocation(new LocationReading
        {
            Latitude = 51.5, Longitude = -0.125, AccuracyMeters = 40,
            Timestamp = DateTimeOffset.UtcNow, PositionSource = "WiFi"
        }, "Allowed");
        files.WriteStatus("Success", "Allowed", lastSuccess: DateTimeOffset.UtcNow);
        var previous = files.ReadStatus()!;
        var locationBefore = File.ReadAllBytes(Path.Combine(_directory, "location.json"));
        File.WriteAllText(State, "{ damaged");
        var action = () => files.WriteLocation(new LocationReading(), "Allowed");
        action.Should().Throw<IdentityProtectionException>();
        files.WriteStatus("Error", "Allowed");
        var status = files.ReadStatus()!;
        status.AgentHealth.Should().Be("IDENTITY PROTECTION BLOCKED");
        status.LocationStatus.Should().Be("IdentityProtectionBlocked");
        status.IntegrityStatus.Should().Be("INVALID");
        status.LastSuccessUtc.Should().Be(previous.LastSuccessUtc);
        status.DeviceId.Should().Be(previous.DeviceId);
        status.RecordSequence.Should().Be(previous.RecordSequence);
        status.Error.Should().Contain("Identity protection blocked");
        File.ReadAllText(State).Should().Be("{ damaged");
        File.ReadAllBytes(Path.Combine(_directory, "location.json")).Should().Equal(locationBefore);
    }

    public void Dispose()
    {
        try { Directory.Delete(_directory, recursive: true); } catch { /* test cleanup */ }
    }
}
