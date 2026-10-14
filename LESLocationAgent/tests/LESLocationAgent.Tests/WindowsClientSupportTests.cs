using FluentAssertions;
using LESLocationAgent.Core.Helpers;
using Xunit;

namespace LESLocationAgent.Tests;

public sealed class WindowsClientSupportTests
{
    [Theory]
    [InlineData(10, 19044, 1, false)]
    [InlineData(10, 19045, 1, true)]
    [InlineData(10, 19046, 1, true)]
    [InlineData(10, 22000, 1, true)]
    [InlineData(10, 22621, 1, true)]
    [InlineData(10, 19045, 3, false)]
    [InlineData(6, 19045, 1, false)]
    public void IsSupported_EnforcesWindows10Version22H2ClientBoundary(
        uint majorVersion,
        uint buildNumber,
        byte productType,
        bool expected)
    {
        WindowsClientSupport.IsSupported(
                majorVersion,
                buildNumber,
                productType)
            .Should()
            .Be(expected);
    }
}