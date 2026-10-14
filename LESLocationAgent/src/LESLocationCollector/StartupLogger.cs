using LESLocationAgent.Core.Models;

namespace LESLocationCollector;

internal static class StartupLogger
{
    public static void Write(string message)
    {
        try
        {
            var directory = Path.GetDirectoryName(AppConfig.LocationFilePath)!;
            Directory.CreateDirectory(directory);
            File.AppendAllText(Path.Combine(directory, "collector.log"),
                $"{DateTimeOffset.UtcNow:O} {message}{Environment.NewLine}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Console.Error.WriteLine($"Collector log unavailable: {ex.GetType().Name}");
        }
    }
}
