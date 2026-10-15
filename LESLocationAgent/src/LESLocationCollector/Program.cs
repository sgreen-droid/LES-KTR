using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Services;
using LESLocationAgent.Services;

namespace LESLocationCollector;

internal static class Program
{
    [MTAThread]
    private static int Main(string[] args)
    {
        try { return RunAsync(args).GetAwaiter().GetResult(); }
        catch (IdentityProtectionException ex)
        {
            new LocationFileService().ReportIdentityProtectionFailure("Allowed", ex);
            StartupLogger.Write(ex.Message);
            return 5;
        }
        catch (Exception ex)
        {
            StartupLogger.Write($"Background collector failed: {ex.GetType().Name}: {ex.Message}");
            return 1;
        }
    }

    private static async Task<int> RunAsync(string[] args)
    {
        // A disconnected user's task must not overwrite the active user's evidence.
        if (args.Any(arg => !arg.Equals("--once", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("Unsupported collector option.");
        if (!UserContext.IsActive())
        {
            StartupLogger.Write("Background collection skipped: no active authorized user session.");
            return 2;
        }
        var config = AppConfig.LoadOrDefault();
        if (!args.Contains("--once", StringComparer.OrdinalIgnoreCase))
        {
            CollectionSchedule.Register(config.EffectiveRefreshMinutes);
            StartupLogger.Write($"Background collection scheduled every {config.EffectiveRefreshMinutes} minutes.");
        }
        var directory = Path.GetDirectoryName(AppConfig.LocationFilePath)!;
        Directory.CreateDirectory(directory);
        FileStream lease;
        try
        {
            lease = new FileStream(Path.Combine(directory, "agent.instance.lock"),
                FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        }
        catch (IOException)
        {
            StartupLogger.Write("Background collection skipped: another collector/client owns the evidence files.");
            return 2;
        }
        using (lease)
        {
            var files = new LocationFileService();
            if (!UserContext.HasExistingConsent())
            {
                files.WriteStatus("PermissionDenied", "NotGranted",
                    error: "Background collection requires existing user consent. No permission was changed.");
                StartupLogger.Write("Background collection refused: existing user location consent is not Allow.");
                return 3;
            }
            files.EnsureRecoveryIdentity();
            WinRT.ComWrappersSupport.InitializeComWrappers();
            var previous = files.ReadLocation();
            var service = new LocationService();
            var result = await service.GetBestLocationAsync(config, forceFresh: true);
            // Recheck after awaiting Windows: user switch/revocation must not
            // publish another user's fix or overwrite the last good observation.
            if (!UserContext.IsActive() || !UserContext.HasExistingConsent())
            {
                StartupLogger.Write("Observation discarded: user session or consent changed during collection.");
                return 3;
            }
            if (result.Reading is null)
            {
                var permission = result.LocationStatus is "PermissionDenied" or "AccessDenied" ? "Denied" : "Allowed";
                files.WriteStatus(result.LocationStatus, permission, error: result.ErrorMessage);
                StartupLogger.Write($"Background location request failed: {result.LocationStatus}.");
                return 4;
            }
            DateTimeOffset? previousTime = previous is not null &&
                DateTimeOffset.TryParse(previous.TimestampUtc, out var parsed) ? parsed : null;
            var rejection = BackgroundObservationPolicy.GetRejection(result.Reading, previousTime, DateTimeOffset.UtcNow);
            if (rejection is not null)
            {
                files.WriteStatus("NoNewObservation", "Allowed", error: rejection);
                StartupLogger.Write(rejection);
                return 4;
            }
            files.WriteLocation(result.Reading, "Allowed");
            files.WriteStatus("Success", "Allowed", lastSuccess: result.Reading.Timestamp);
            if (files.GetLocationIntegrityStatus() != "VALID")
                throw new InvalidOperationException("Written location did not pass the existing integrity check.");
            StartupLogger.Write($"Background observation saved: {result.Reading.Timestamp:O}; source {result.Reading.PositionSource}.");
            return 0;
        }
    }
}
