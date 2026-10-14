using System.Globalization;

namespace LESLocationAgent.Core.Helpers;

/// <summary>Never label a provider's local-offset time as UTC without converting it.</summary>
public static class UtcTimestamp
{
    public static string Format(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);
}
