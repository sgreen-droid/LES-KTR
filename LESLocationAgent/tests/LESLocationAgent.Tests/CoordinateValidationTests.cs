using FluentAssertions;
using LESLocationAgent.Core.Models;
using Xunit;

namespace LESLocationAgent.Tests;

/// <summary>
/// Tests for coordinate validation on LocationReading.
/// </summary>
public sealed class CoordinateValidationTests
{
    [Theory]
    [InlineData(40.817391,  -73.941502,  true)]   // valid: New York area
    [InlineData(0.0,         0.0,         true)]   // valid: null island
    [InlineData(90.0,       180.0,        true)]   // valid: extreme corners
    [InlineData(-90.0,     -180.0,        true)]   // valid: extreme corners
    [InlineData(90.000001,   0.0,         false)]  // invalid latitude
    [InlineData(-90.000001,  0.0,         false)]  // invalid latitude
    [InlineData(0.0,        180.000001,   false)]  // invalid longitude
    [InlineData(0.0,       -180.000001,   false)]  // invalid longitude
    [InlineData(91.0,        0.0,         false)]  // clearly invalid latitude
    [InlineData(0.0,        200.0,        false)]  // clearly invalid longitude
    public void IsValid_ReturnsCorrectResult(double lat, double lon, bool expected)
    {
        var reading = new LocationReading
        {
            Latitude  = lat,
            Longitude = lon,
            AccuracyMeters = 50.0,
            Timestamp = DateTimeOffset.UtcNow
        };

        reading.IsValid.Should().Be(expected);
    }

    [Fact]
    public void IsValid_RejectsNonFiniteCoordinates()
    {
        var nanLatitude = new LocationReading
        {
            Latitude = double.NaN,
            Longitude = -73.941502,
            AccuracyMeters = 50.0,
            Timestamp = DateTimeOffset.UtcNow
        };
        var infiniteLongitude = new LocationReading
        {
            Latitude = 40.817391,
            Longitude = double.PositiveInfinity,
            AccuracyMeters = 50.0,
            Timestamp = DateTimeOffset.UtcNow
        };

        nanLatitude.IsValid.Should().BeFalse();
        infiniteLongitude.IsValid.Should().BeFalse();
    }
}
