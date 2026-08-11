using Microsoft.Win32;

namespace LESLocationAgent.Services;

/// <summary>
/// Manages the Windows startup registry entry that launches the agent when the user signs in.
/// Uses HKCU so no administrator rights are needed.
/// </summary>
public sealed class StartupService
{
    private const string RegistryKeyPath =
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "LESLocationAgent";

    /// <summary>
    /// Registers the current executable to start with Windows.
    /// The --startup flag tells the app to start minimised to tray.
    /// </summary>
    public void Enable()
    {
        try
        {
            var exePath = Environment.ProcessPath
                ?? System.Reflection.Assembly.GetExecutingAssembly().Location;

            using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, writable: true);
            key?.SetValue(ValueName, $"\"{exePath}\" --startup");
        }
        catch
        {
            // Non-fatal: startup registration is a convenience, not a hard requirement
        }
    }

    /// <summary>
    /// Removes the startup entry.
    /// </summary>
    public void Disable()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, writable: true);
            key?.DeleteValue(ValueName, throwOnMissingValue: false);
        }
        catch { }
    }

    /// <summary>
    /// Returns true if the startup entry currently exists.
    /// </summary>
    public bool IsEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, writable: false);
            return key?.GetValue(ValueName) is not null;
        }
        catch
        {
            return false;
        }
    }
}
