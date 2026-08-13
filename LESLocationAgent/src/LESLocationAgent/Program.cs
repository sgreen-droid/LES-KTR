// LES Location Agent — application entry point for unpackaged WinUI 3.
// DISABLE_XAML_GENERATED_MAIN is defined in the .csproj to suppress the
// auto-generated entry point so this class is the sole entry point.

using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using WinRT;

namespace LESLocationAgent;

internal static class Program
{
    [global::System.Runtime.InteropServices.DllImport("Microsoft.ui.xaml.dll")]
    [return: global::System.Runtime.InteropServices.MarshalAs(
        global::System.Runtime.InteropServices.UnmanagedType.Bool)]
    private static extern bool XamlCheckProcessRequirements();

    [global::System.STAThread]
    private static void Main(string[] args)
    {
        // Verify WinUI 3 runtime requirements are met on this Windows version
        XamlCheckProcessRequirements();

        // Required for WinUI 3 unpackaged apps
        ComWrappersSupport.InitializeComWrappers();

        Application.Start((p) =>
        {
            // Set up the dispatcher queue synchronisation context so that
            // async/await continuations run on the UI thread
            var context = new DispatcherQueueSynchronizationContext(
                DispatcherQueue.GetForCurrentThread());
            SynchronizationContext.SetSynchronizationContext(context);

            _ = new App();
        });
    }
}
