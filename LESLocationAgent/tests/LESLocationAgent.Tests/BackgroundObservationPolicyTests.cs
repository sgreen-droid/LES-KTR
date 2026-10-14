using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using Xunit;

namespace LESLocationAgent.Tests;

public class BackgroundObservationPolicyTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-10-14T16:00:00Z");
    private static LocationReading Reading(DateTimeOffset time, string source = "WiFi") => new()
    {
        Latitude = 40, Longitude = -74, AccuracyMeters = 80, Timestamp = time, PositionSource = source
    };

    [Fact]
    public void SameCoordinatesWithNewObservationAreFresh() =>
        Assert.Null(BackgroundObservationPolicy.GetRejection(Reading(Now), Now.AddMinutes(-15), Now));

    [Fact]
    public void ReuploadingSameObservationIsNotFresh() =>
        Assert.NotNull(BackgroundObservationPolicy.GetRejection(Reading(Now), Now, Now));

    [Theory]
    [InlineData("IPAddress")]
    [InlineData("Unknown")]
    [InlineData("Default")]
    public void RejectsNonPhysicalSources(string source) =>
        Assert.NotNull(BackgroundObservationPolicy.GetRejection(Reading(Now, source), null, Now));

    [Theory]
    [InlineData(-180)]
    [InlineData(180)]
    public void RejectsOldAndFutureObservations(int seconds) =>
        Assert.NotNull(BackgroundObservationPolicy.GetRejection(Reading(Now.AddSeconds(seconds)), null, Now));
}
