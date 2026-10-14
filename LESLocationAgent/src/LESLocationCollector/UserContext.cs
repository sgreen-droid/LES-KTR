using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace LESLocationCollector;

internal static class UserContext
{
    [DllImport("wtsapi32.dll", EntryPoint = "WTSQuerySessionInformationW")]
    private static extern bool Query(nint server, int session, int kind, out nint buffer, out int size);
    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(nint buffer);

    public static bool IsActive()
    {
        int session = Process.GetCurrentProcess().SessionId;
        if (session == 0 || !Query(0, session, 8, out var buffer, out int size)) return false;
        try { return size >= 4 && Marshal.ReadInt32(buffer) == 0; }
        finally { WTSFreeMemory(buffer); }
    }

    // Read only. In particular, do not call the legacy client's auto-grant path
    // or RequestAccessAsync from a hidden/background process.
    public static bool HasExistingConsent()
    {
        const string path = @"SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location";
        using var machine = Registry.LocalMachine.OpenSubKey(path);
        using var user = Registry.CurrentUser.OpenSubKey(path);
        using var desktop = user?.OpenSubKey("NonPackaged");
        return !string.Equals(machine?.GetValue("Value") as string, "Deny", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(desktop?.GetValue("Value") as string, "Deny", StringComparison.OrdinalIgnoreCase)
            && string.Equals(user?.GetValue("Value") as string, "Allow", StringComparison.OrdinalIgnoreCase);
    }
}
