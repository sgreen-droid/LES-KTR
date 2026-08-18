using Microsoft.Win32;

namespace LESLocationAgent.Services;

/// <summary>
/// Manages the Windows startup registry entry that launches the agent when the user signs in.
///
/// When the MSI installer is used (perMachine install), it writes an HKLM Run key that covers
/// ALL user accounts automatically. In that case this service skips writing a duplicate HKCU
/// entry to avoid the app launching twice per login (the single-instance mutex would catch
/// the second launch anyway, but it's cleaner not to start it at all).
///
/// When the app is run without the MSI (e.g. during development), it falls back to HKCU.
/// </summary>
public sealed class StartupService
{
    private const string RegistryKeyPath =
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "LESLocationAgent";

    /// <summary>
    /// Registers the current executable to start with Windows.
    /// The --startup flag tells the app to start minimised to tray.
    /// Skips HKCU registration if HKLM already has the entry (set by the MSI).
    /// </summary>
    public void Enable()
    {
        try
        {
            // If the MSI set an HKLM key, that covers all users — don't add HKCU too.
            if (HklmStartupExists()) return;

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
    /// Removes the HKCU startup entry (if present).
    /// The HKLM entry is managed by the MSI and requires admin rights to remove.
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
    /// Returns true if a startup entry exists in either HKLM (all users) or HKCU (current user).
    /// </summary>
    public bool IsEnabled()
    {
        try
        {
            if (HklmStartupExists()) return true;
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath, writable: false);
            return key?.GetValue(ValueName) is not null;
        }
        catch
        {
            return false;
        }
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private static bool HklmStartupExists()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RegistryKeyPath, writable: false);
            return key?.GetValue(ValueName) is not null;
        }
        catch
        {
            return false;
        }
    }
}
