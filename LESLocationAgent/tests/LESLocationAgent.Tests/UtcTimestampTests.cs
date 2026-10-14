using LESLocationAgent.Core.Helpers;
using Xunit;

namespace LESLocationAgent.Tests;

public class UtcTimestampTests
{
    [Theory]
    [InlineData(-4, "2026-10-08T17:00:00Z")]
    [InlineData(0, "2026-10-08T13:00:00Z")]
    [InlineData(5, "2026-10-08T08:00:00Z")]
    public void ProviderOffsetIsConvertedBeforeWritingUtcMarker(int offsetHours, string expected)
    {
        var timestamp = new DateTimeOffset(2026, 10, 8, 13, 0, 0, TimeSpan.FromHours(offsetHours));
        Assert.Equal(expected, UtcTimestamp.Format(timestamp));
    }

    [Fact]
    public void UtcConversionHandlesDayBoundary()
    {
        var timestamp = new DateTimeOffset(2026, 10, 8, 1, 0, 0, TimeSpan.FromHours(5.5));
        Assert.Equal("2026-10-07T19:30:00Z", UtcTimestamp.Format(timestamp));
    }
}
