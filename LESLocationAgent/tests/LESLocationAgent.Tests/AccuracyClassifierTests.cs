using FluentAssertions;
using LESLocationAgent.Core.Helpers;
using Xunit;

namespace LESLocationAgent.Tests;

/// <summary>
/// Tests for the accuracy quality classification logic.
/// </summary>
public sealed class AccuracyClassifierTests
{
    [Theory]
    [InlineData(0.0,   "EXCELLENT")]
    [InlineData(10.0,  "EXCELLENT")]
    [InlineData(25.0,  "EXCELLENT")]  // boundary — exactly at EXCELLENT threshold
    [InlineData(25.1,  "GOOD")]
    [InlineData(50.0,  "GOOD")]
    [InlineData(100.0, "GOOD")]       // boundary — exactly at GOOD threshold
    [InlineData(100.1, "APPROXIMATE")]
    [InlineData(500.0, "APPROXIMATE")]
    [InlineData(1000.0,"APPROXIMATE")]// boundary — exactly at APPROXIMATE threshold
    [InlineData(1000.1,"LOW")]
    [InlineData(5000.0,"LOW")]
    public void Classify_ReturnsCorrectTier(double accuracy, string expected)
    {
        AccuracyClassifier.Classify(accuracy).Should().Be(expected);
    }

    [Fact]
    public void Classify_NullAccuracy_ReturnsUnknown()
    {
        AccuracyClassifier.Classify(null).Should().Be("UNKNOWN");
    }

    [Fact]
    public void Classify_NaNAccuracy_ReturnsUnknown()
    {
        AccuracyClassifier.Classify(double.NaN).Should().Be("UNKNOWN");
    }

    [Fact]
    public void Classify_NegativeAccuracy_ReturnsUnknown()
    {
        AccuracyClassifier.Classify(-1.0).Should().Be("UNKNOWN");
    }

    [Theory]
    [InlineData(0.0,  true)]
    [InlineData(19.9, true)]
    [InlineData(20.0, true)]   // exactly at early-stop threshold
    [InlineData(20.1, false)]
    [InlineData(100.0,false)]
    public void IsEarlyStopQuality_ReturnsCorrectResult(double accuracy, bool expected)
    {
        AccuracyClassifier.IsEarlyStopQuality(accuracy).Should().Be(expected);
    }
}
