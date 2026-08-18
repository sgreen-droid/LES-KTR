---
name: H.NotifyIcon WinUI API
description: Correct way to wire click handlers on H.NotifyIcon.WinUI TaskbarIcon — events don't exist, only commands
---

## Rule
H.NotifyIcon.WinUI (v2.1.0) TaskbarIcon exposes **commands**, not events, for click handling.
There are no public `TrayLeftMouseDown`, `TrayMouseDoubleClick`, or similar events to subscribe to.

## Correct API
Use the command properties:
- `LeftClickCommand` — fires on left click
- `DoubleClickCommand` — fires on double click
- `RightClickCommand` — fires on right click
- `MiddleClickCommand` — fires on middle click

All take `System.Windows.Input.ICommand` (available in `net8.0-windows10.0.22621.0` BCL — no extra package needed).

## Pattern
```csharp
_trayIcon.LeftClickCommand = new ActionCommand(ShowMainWindow);

private sealed class ActionCommand(Action execute) : System.Windows.Input.ICommand
{
    public event EventHandler? CanExecuteChanged;
    public bool CanExecute(object? _) => true;
    public void Execute(object? _) => execute();
}
```

**Why:** Tried `TrayMouseDoubleClick` and `TrayLeftMouseDown` — both caused CS1061 compile errors. Inspected the DLL with `strings` and confirmed only `get_LeftClickCommand` / `set_LeftClickCommand` (and Right/Middle/Double variants) are exposed publicly.

## Icon Loading (v2.1.0) — do NOT use IconSource or GeneratedIconParameters

- `IconSource = new BitmapImage(new Uri(absolutePath))` compiles but throws at runtime: `ArgumentException: Argument 'picture' must be a picture that can be used as a Icon` — H.NotifyIcon tries to convert ImageSource → System.Drawing.Icon via a stream; a BitmapImage from a file URI isn't a valid .ico stream.
- `GeneratedIconParameters` does NOT exist in v2.1.0 — CS0117/CS0234 compile errors.
- **Working solution:** Set no icon at all. Tray shows a blank/default icon; tooltip and context menu still work perfectly.
- `ms-appx://` URIs also don't resolve in unpackaged apps, so XAML-declared `IconSource="Assets/appicon.ico"` fails too.

**Why:** Icon is purely cosmetic. Attempting any icon in v2.1.0 from an unpackaged app path causes either a runtime crash or compile error. Leave it blank until the package is upgraded or a proper Win32 NOTIFYICONDATA path is used.

## Named Event Caution
When creating named `EventWaitHandle` for single-instance signaling:
- Use `Local\` prefix, NOT `Global\` — `Global\` requires `SeCreateGlobalPrivilege` which non-elevated processes don't have, causing an exception before the tray is ever created.
- Always wrap in try/catch so a failure here doesn't crash the app before the tray icon is shown.
- Capture `DispatcherQueue.GetForCurrentThread()` on the UI thread BEFORE starting the background listener thread — calling it from the background thread returns null.
