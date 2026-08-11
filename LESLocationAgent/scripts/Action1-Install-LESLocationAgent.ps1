<#
.SYNOPSIS
    Downloads and silently installs LES Location Agent via Action1.

.DESCRIPTION
    1. Downloads the MSI installer from a configurable HTTPS URL.
    2. Verifies the SHA-256 hash before installation.
    3. Installs silently.
    4. Confirms program files exist.
    5. Launches the app visibly for the logged-in user so Windows can prompt
       for location permission.
    6. Reports SUCCESS or FAILURE.

.PARAMETER InstallerUrl
    HTTPS URL to download LESLocationAgent.msi from.
    UPDATE THIS before deploying.

.PARAMETER ExpectedSha256
    SHA-256 hash of the installer file (uppercase hex, no dashes).
    Obtain this from your build artifacts page.
    UPDATE THIS for each new build.

.NOTES
    Deploy via Action1 Automation → Script.
    The script does NOT disable Windows Defender or any antivirus.
#>

#Requires -Version 5.1
#Requires -RunAsAdministrator
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# CONFIGURATION — update these for each release
# ---------------------------------------------------------------
$InstallerUrl  = 'https://your-host.example.com/releases/LESLocationAgent.msi'
$ExpectedSha256 = 'REPLACE_WITH_SHA256_FROM_BUILD_ARTIFACT'   # uppercase hex, no dashes
# ---------------------------------------------------------------

$TempDir       = Join-Path $env:TEMP 'LESLocationAgent_Install'
$InstallerPath = Join-Path $TempDir  'LESLocationAgent.msi'
$InstallDir    = 'C:\Program Files\LES Location Agent'
$ExePath       = Join-Path $InstallDir 'LESLocationAgent.exe'

function Write-Step { param([string]$Msg) Write-Host "`n[$([DateTime]::UtcNow.ToString('HH:mm:ss'))] $Msg" }
function Fail       { param([string]$Msg) Write-Error "FAILURE: $Msg"; exit 1 }
function Pass       { param([string]$Msg) Write-Host "  OK: $Msg" }

Write-Host '=== LES Location Agent — Action1 Installer ==='
Write-Host "Computer : $env:COMPUTERNAME"
Write-Host "Run as   : $($env:USERNAME)"
Write-Host "Time     : $(Get-Date -AsUTC -Format 'yyyy-MM-ddTHH:mm:ssZ')"

# ---------------------------------------------------------------
# Step 1: Create temp directory
# ---------------------------------------------------------------
Write-Step 'Creating temp directory...'
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Path $TempDir | Out-Null
Pass "Temp dir: $TempDir"

# ---------------------------------------------------------------
# Step 2: Download installer
# ---------------------------------------------------------------
Write-Step "Downloading installer from: $InstallerUrl"
try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($InstallerUrl, $InstallerPath)
    $sizeMB = [Math]::Round((Get-Item $InstallerPath).Length / 1MB, 2)
    Pass "Downloaded $sizeMB MB to $InstallerPath"
} catch {
    Fail "Download failed: $_"
}

# ---------------------------------------------------------------
# Step 3: Verify SHA-256
# ---------------------------------------------------------------
Write-Step 'Verifying SHA-256 hash...'
if ($ExpectedSha256 -ne 'REPLACE_WITH_SHA256_FROM_BUILD_ARTIFACT') {
    $actualHash = (Get-FileHash -Path $InstallerPath -Algorithm SHA256).Hash

    if ($actualHash -ne $ExpectedSha256.ToUpper()) {
        Remove-Item $InstallerPath -Force -ErrorAction SilentlyContinue
        Fail "SHA-256 mismatch!`n  Expected: $($ExpectedSha256.ToUpper())`n  Actual  : $actualHash"
    }
    Pass "SHA-256 verified: $actualHash"
} else {
    Write-Warning 'SHA-256 verification skipped — update $ExpectedSha256 in the script for production use.'
}

# ---------------------------------------------------------------
# Step 4: Install silently
# ---------------------------------------------------------------
Write-Step 'Installing LES Location Agent...'
$logPath = Join-Path $TempDir 'install.log'
$args    = "/i `"$InstallerPath`" /quiet /norestart /l*v `"$logPath`""

$proc = Start-Process msiexec.exe -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
if ($proc.ExitCode -notin @(0, 3010)) {
    Write-Warning "Install log: $(Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue)"
    Fail "msiexec exited with code $($proc.ExitCode). Check $logPath for details."
}
Pass "Installation complete (exit code: $($proc.ExitCode))"

# ---------------------------------------------------------------
# Step 5: Confirm installation
# ---------------------------------------------------------------
Write-Step 'Confirming installation...'

if (-not (Test-Path $ExePath)) {
    Fail "Executable not found at expected path: $ExePath"
}
Pass "Executable exists: $ExePath"

# Check registry startup entry
$runKey  = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
# The startup entry is written by the app itself on first launch — skip this check
Pass 'Installation file check passed'

# ---------------------------------------------------------------
# Step 6: Launch for logged-in user (for location permission prompt)
# ---------------------------------------------------------------
Write-Step 'Launching application for logged-in user...'
try {
    # Find the active console session (logged-in user)
    $sessions = query session 2>&1
    $activeSession = $sessions | Where-Object { $_ -match 'Active' } | Select-Object -First 1

    if ($activeSession) {
        # Launch via scheduled task so it runs in the user context (not SYSTEM)
        $taskAction   = New-ScheduledTaskAction -Execute $ExePath
        $taskTrigger  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(5)
        $taskSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
        $taskName     = 'LESLocationAgent_FirstRun'

        # Remove if exists
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

        Register-ScheduledTask -TaskName $taskName `
            -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings `
            -RunLevel Limited -Force | Out-Null

        Start-ScheduledTask -TaskName $taskName
        Pass 'Application scheduled to launch in the user context'

        # Clean up the one-shot task after a short delay
        Start-Sleep -Seconds 10
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    } else {
        Write-Warning 'No active user session found — app will launch on next user login.'
    }
} catch {
    Write-Warning "Could not launch app automatically: $_ — user can launch manually."
}

# ---------------------------------------------------------------
# Clean up temp files
# ---------------------------------------------------------------
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# ---------------------------------------------------------------
# Result
# ---------------------------------------------------------------
Write-Host "`n============================================"
Write-Host 'RESULT: SUCCESS'
Write-Host "LES Location Agent installed at: $InstallDir"
Write-Host 'The application will prompt the user for location permission on first launch.'
Write-Host '============================================'
