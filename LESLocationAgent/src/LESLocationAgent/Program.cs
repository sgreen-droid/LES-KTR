// LES Location Agent — application entry point for unpackaged WinUI 3.
// This file is required; do not delete it.
// The WinUI 3 SDK generates a partial class for App but needs this
// manual entry point when running as an unpackaged Win32 application.

using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using WinRT;

[global::System.Runtime.InteropServices.DllImport("Microsoft.ui.xaml.dll")]
[return: global::System.Runtime.InteropServices.MarshalAs(
    global::System.Runtime.InteropServices.UnmanagedType.Bool)]
static extern bool XamlCheckProcessRequirements();

[global::System.STAThreadAttribute]
static void Main(string[] args)
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

        _ = new LESLocationAgent.App();
    });
}
