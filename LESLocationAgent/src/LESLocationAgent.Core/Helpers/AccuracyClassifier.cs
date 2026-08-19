namespace LESLocationAgent.Core.Helpers;

/// <summary>
/// Classifies a Windows-reported accuracy radius into a human-readable quality tier.
/// </summary>
public static class AccuracyClassifier
{
    public const double ExcellentThreshold = 25.0;
    public const double GoodThreshold = 100.0;
    public const double ApproximateThreshold = 1000.0;
    public const double EarlyStopThreshold = 20.0;

    /// <summary>
    /// Returns EXCELLENT, GOOD, APPROXIMATE, LOW, or UNKNOWN.
    /// </summary>
    public static string Classify(double? accuracyMeters)
    {
        if (accuracyMeters is null || !double.IsFinite(accuracyMeters.Value) || accuracyMeters.Value < 0)
            return "UNKNOWN";

        return accuracyMeters.Value switch
        {
            <= ExcellentThreshold => "EXCELLENT",
            <= GoodThreshold => "GOOD",
            <= ApproximateThreshold => "APPROXIMATE",
            _ => "LOW"
        };
    }

    /// <summary>
    /// Returns true when the fix is good enough to stop collecting more readings.
    /// </summary>
    public static bool IsEarlyStopQuality(double accuracyMeters) =>
        accuracyMeters <= EarlyStopThreshold;
}
