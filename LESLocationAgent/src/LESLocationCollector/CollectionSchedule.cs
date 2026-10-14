using System.Security.Principal;

namespace LESLocationCollector;

internal static class CollectionSchedule
{
    public static void Register(int minutes)
    {
        var executable = Environment.ProcessPath
            ?? throw new InvalidOperationException("Collector executable path is unavailable.");
        if (!Path.GetFileName(executable).Equals("LESLocationCollector.exe", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Scheduling requires the published collector executable, not the dotnet development host.");
        var sid = WindowsIdentity.GetCurrent().User?.Value
            ?? throw new InvalidOperationException("Cannot resolve the signed-in user.");
        var type = Type.GetTypeFromProgID("Schedule.Service")
            ?? throw new InvalidOperationException("Windows Task Scheduler is unavailable.");
        dynamic service = Activator.CreateInstance(type)!;
        service.Connect();
        dynamic root = service.GetFolder("\\");
        dynamic task = service.NewTask(0);
        task.RegistrationInfo.Description = "LES background location collection; existing consent only; no client UI.";
        task.Principal.UserId = sid;
        task.Principal.LogonType = 3; // TASK_LOGON_INTERACTIVE_TOKEN: no password, no SYSTEM
        task.Principal.RunLevel = 0; // TASK_RUNLEVEL_LUA: never elevate
        task.Settings.Enabled = true;
        task.Settings.StartWhenAvailable = true;
        task.Settings.DisallowStartIfOnBatteries = false;
        task.Settings.StopIfGoingOnBatteries = false;
        task.Settings.MultipleInstances = 2; // IgnoreNew
        task.Settings.ExecutionTimeLimit = "PT3M";
        task.Settings.RestartCount = 2;
        task.Settings.RestartInterval = "PT1M";
        dynamic time = task.Triggers.Create(1);
        time.StartBoundary = DateTime.Now.AddMinutes(1).ToString("yyyy-MM-dd'T'HH:mm:ss",
            System.Globalization.CultureInfo.InvariantCulture);
        time.Repetition.Interval = System.Xml.XmlConvert.ToString(TimeSpan.FromMinutes(Math.Max(5, minutes)));
        dynamic logon = task.Triggers.Create(9);
        logon.UserId = sid;
        dynamic action = task.Actions.Create(0);
        action.Path = executable;
        action.Arguments = "--once";
        root.RegisterTaskDefinition($"LES Location Collector - {sid}", task, 6, sid, null, 3);
        // Remove only our exact legacy startup value after the new task exists.
        // Do not delete unrelated/custom startup entries or change any consent.
        var parent = Directory.GetParent(Path.GetDirectoryName(executable)!)?.FullName;
        if (parent is not null)
        {
            var legacy = $"\"{Path.Combine(parent, "LESLocationAgent.exe")}\" --startup";
            using var startup = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", writable: true);
            if (string.Equals(startup?.GetValue("LESLocationAgent") as string, legacy, StringComparison.OrdinalIgnoreCase))
                startup!.DeleteValue("LESLocationAgent");
        }
    }
}
