# Background location collector

The v1.1.9 MSI includes this separate, self-contained Windows executable under
`collector/`. It does not load WinUI, display a window, create a tray icon, request
foreground access, or grant consent.

At user sign-in the MSI startup entry invokes it with no arguments. It registers
that user's limited, InteractiveToken scheduled task at the configured collection
interval (15 minutes by default, minimum 5), then collects once. The periodic task
invokes `--once`. Action1 publishing remains every 10 minutes; health remains hourly.
An already signed-in user can be bootstrapped through the narrowly scoped
packaged `Initialize-BackgroundCollector.ps1`. The Action1 silent installer runs
this automatically, registers the limited per-user task from management context,
starts it, and verifies an advancing physical observation. No operator action on
the laptop, client launch, legacy first-run marker, or user prompt is required.
With no eligible signed-in user it reports deferred startup, not a fresh location.

Collection requires an active signed-in session and existing Windows location
consent. No user session, denial, inaccessible Task Scheduler, a busy evidence
lease, old/repeated observations, unsupported sources, or provider failures are
reported without replacing the last good location. GPS, WiFi, and cellular fixes
retain their real Windows timestamps. A stationary laptop can produce a new
observation without coordinate changes. IP estimates are never accepted.

The scheduled task is intentionally idle between checks. Health recognizes recent
successful scheduled runs; it does not require a permanent client process.
Diagnostics are in `C:\ProgramData\LESLocationAgent\collector.log` and the existing
status record. MSI uninstall removes this collector's tasks. Upgrade preserves
task definitions; the next sign-in refreshes the current user's definition.

## Verification status

Cross-build and platform-neutral observation/integrity tests run in development.
Windows CI publishes both executables before MSI harvesting. Installer execution,
actual geolocation, standard-user task registration, sign-in/lock transitions,
and uninstall must be verified on one authorized laptop before fleet rollout.
Source changes alone do not update installed laptops.
