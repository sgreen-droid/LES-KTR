namespace LESLocationAgent.Core.Helpers;

/// <summary>
/// Defines the supported Windows client boundary without depending on Windows
/// APIs, so the decision can be covered by cross-platform unit tests.
/// </summary>
public static class WindowsClientSupport
{
    public const uint MinimumBuild = 19045;
    public const byte WorkstationProductType = 1;
    public const string MinimumVersionDescription =
        "Windows 10 version 22H2 (build 19045) or Windows 11";

    public static bool IsSupported(
        uint majorVersion,
        uint buildNumber,
        byte productType) =>
        productType == WorkstationProductType &&
        majorVersion >= 10 &&
        buildNumber >= MinimumBuild;
}