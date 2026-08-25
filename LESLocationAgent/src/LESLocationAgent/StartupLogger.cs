using LESLocationAgent.Core.Models;

namespace LESLocationAgent;

/// <summary>
/// BCL-only startup logging that is safe before any WinUI type is loaded.
/// </summary>
internal static class StartupLogger
{
    internal static void Write(string message)
    {
        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}  {message}{Environment.NewLine}";

        try
        {
            Directory.CreateDirectory(AppConfig.DataDirectory);
            File.AppendAllText(
                Path.Combine(AppConfig.DataDirectory, "startup.log"),
                line);
        }
        catch { }

        try
        {
            File.AppendAllText(
                Path.Combine(Path.GetTempPath(), "LESLocationAgent.log"),
                line);
        }
        catch { }
    }
}