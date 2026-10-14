<#
.SYNOPSIS
    Downloads and silently installs LES Location Agent via Action1.

.DESCRIPTION
    1. Downloads the MSI installer from a configurable HTTPS URL.
    2. Verifies the SHA-256 hash before installation.
    3. Installs silently only when older or missing; never downgrades.
    4. Confirms program files exist.
    5. Ensures unattended background collection for the existing consenting user.
    6. Reports SUCCESS or FAILURE.

.PARAMETER InstallerUrl
    HTTPS URL to download LESLocationAgent.msi from.
    UPDATE THIS before deploying.

.PARAMETER ExpectedSha256
    SHA-256 hash of the installer file (uppercase hex, no dashes).
    Obtain this from your build artifacts page.
    UPDATE THIS for each new build.

.NOTES
    Deploy via Action1 Automation > Script.
    The script does NOT disable Windows Defender or any antivirus.
#>

#Requires -Version 5.1
#Requires -RunAsAdministrator
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# RELEASE CONFIGURATION
#
# Tagged GitHub releases replace these placeholders automatically. For a
# privately hosted MSI, replace BOTH values before putting this script in
# Action1. The script intentionally refuses an unpinned installer.
# ---------------------------------------------------------------
$InstallerUrl   = '__INSTALLER_URL__'
$ExpectedSha256 = '__INSTALLER_SHA256__'
$TargetVersionText = '__INSTALLER_VERSION__'
# ---------------------------------------------------------------

$TempDir       = Join-Path $env:TEMP 'LESLocationAgent_Install'
$InstallerPath = Join-Path $TempDir  'LESLocationAgent.msi'
$InstallDir    = 'C:\Program Files\LES Location Agent'
$ExePath       = Join-Path $InstallDir 'LESLocationAgent.exe'
$CollectorExe = Join-Path $InstallDir 'collector\LESLocationCollector.exe'

function Test-InstallationCurrent {
    param([version]$Target, [string]$ClientVersion, [string]$CollectorVersion, [bool]$RequiredFilesPresent)
    if (-not $RequiredFilesPresent) { return $false }
    $client = $null
    $collector = $null
    if (-not [version]::TryParse($ClientVersion, [ref]$client) -or
        -not [version]::TryParse($CollectorVersion, [ref]$collector)) { return $false }
    return $client -ge $Target -and $collector -ge $Target
}

function Test-LegacyAgentHandoff {
    param([bool]$UpgradeRequired, [DateTime]$ProcessStartedUtc, [DateTime]$BinaryWrittenUtc)
    # A process older than the installed binary is still running the replaced
    # image. Never stop a current client opened after that binary was written.
    return $UpgradeRequired -or $ProcessStartedUtc -lt $BinaryWrittenUtc
}

function Stop-LegacyAgentForHandoff {
    param([string]$ExpectedExe, [bool]$UpgradeRequired)
    if (-not (Test-Path -LiteralPath $ExpectedExe)) { return }
    $written = [IO.File]::GetLastWriteTimeUtc($ExpectedExe)
    foreach ($entry in @(Get-CimInstance Win32_Process -Filter "Name='LESLocationAgent.exe'")) {
        if ($entry.ExecutablePath -ne $ExpectedExe) { continue }
        $process = Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $process) { continue }
        if ($process.Path -ne $ExpectedExe -or
            [Math]::Abs(($process.StartTime.ToUniversalTime() - $entry.CreationDate.ToUniversalTime()).TotalSeconds) -gt 1) {
            throw 'Agent process identity changed; no process was stopped.'
        }
        if (-not (Test-LegacyAgentHandoff $UpgradeRequired $process.StartTime.ToUniversalTime() $written)) { continue }
        $null = $process.CloseMainWindow()
        if (-not $process.WaitForExit(5000)) {
            # Only this verified stale LES process is retired. Core writes are
            # atomic; no evidence, identity, task, or other application is deleted.
            $process.Kill()
            if (-not $process.WaitForExit(10000)) { throw 'Legacy agent did not release its process.' }
        }
        Write-Host "Legacy LES agent retired for unattended collector handoff (PID $($entry.ProcessId))."
    }
}

function Write-Step { param([string]$Msg) Write-Host "`n[$([DateTime]::UtcNow.ToString('HH:mm:ss'))] $Msg" }
function Fail       { param([string]$Msg) Write-Error "FAILURE: $Msg"; exit 1 }
function Pass       { param([string]$Msg) Write-Host "  OK: $Msg" }

Write-Host '=== LES Location Agent - Action1 Installer ==='
Write-Host "Computer : $env:COMPUTERNAME"
Write-Host "Run as   : $($env:USERNAME)"
Write-Host "Time     : $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"

if ($InstallerUrl -notmatch '^https://') {
    Fail 'InstallerUrl must be an HTTPS URL. Use the preconfigured script from a tagged release or set a trusted HTTPS URL.'
}

if ($ExpectedSha256 -notmatch '^[0-9A-Fa-f]{64}$') {
    Fail 'ExpectedSha256 must be the 64-character SHA-256 hash for this exact MSI. Integrity verification cannot be skipped.'
}
if ($TargetVersionText -notmatch '^\d+\.\d+\.\d+\.\d+$') { Fail 'Installer target version is not configured.' }
$targetVersion = [version]$TargetVersionText
$os = Get-CimInstance Win32_OperatingSystem
$architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($os.ProductType -ne 1 -or [int]$os.BuildNumber -lt 19041 -or
    -not [Environment]::Is64BitOperatingSystem -or $architecture -ne 'AMD64') {
    Write-Host 'RESULT: SKIPPED_UNSUPPORTED - only supported x64 Windows 10/11 client devices are eligible.'
    exit 0
}
$required = @('LESLocationCollector.exe', 'LESLocationCollector.dll', 'LESLocationCollector.runtimeconfig.json',
    'WinRT.Runtime.dll', 'Microsoft.Windows.SDK.NET.dll', 'Initialize-BackgroundCollector.ps1', 'Remove-CollectorTasks.ps1')
$complete = Test-Path $ExePath
foreach ($name in $required) {
    if (-not (Test-Path (Join-Path $InstallDir "collector\$name"))) { $complete = $false }
}
$clientVersion = if (Test-Path $ExePath) { (Get-Item $ExePath).VersionInfo.FileVersion } else { '' }
$collectorVersion = if (Test-Path $CollectorExe) { (Get-Item $CollectorExe).VersionInfo.FileVersion } else { '' }
$alreadyCurrent = Test-InstallationCurrent $targetVersion $clientVersion $collectorVersion $complete
# Missing files on a newer installation must not trigger a downgrade.
foreach ($installedVersion in @($clientVersion, $collectorVersion)) {
    $parsedVersion = $null
    if (-not $alreadyCurrent -and [version]::TryParse($installedVersion, [ref]$parsedVersion) -and $parsedVersion -gt $targetVersion) {
        Fail 'A newer but incomplete installation needs repair; refusing to downgrade it.'
    }
}
Stop-LegacyAgentForHandoff $ExePath (-not $alreadyCurrent)
# Isolate invocation logs and downloads from any other management action.
$TempDir = Join-Path $env:TEMP ('LESLocationAgent_Install_' + [guid]::NewGuid().ToString('N'))
$InstallerPath = Join-Path $TempDir 'LESLocationAgent.msi'
New-Item -ItemType Directory -Path $TempDir | Out-Null

if (-not $alreadyCurrent) {

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
    # Force TLS 1.2 - required for GitHub (PS5.1 defaults to older versions)
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    # Use Invoke-WebRequest - handles GitHub CDN redirects more reliably than WebClient
    Invoke-WebRequest -Uri $InstallerUrl -OutFile $InstallerPath -UseBasicParsing `
        -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    $sizeMB = [Math]::Round((Get-Item $InstallerPath).Length / 1MB, 2)
    Pass "Downloaded $sizeMB MB to $InstallerPath"
} catch {
    Fail "Download failed: $_"
}

# ---------------------------------------------------------------
# Step 3: Verify SHA-256
# ---------------------------------------------------------------
Write-Step 'Verifying SHA-256 hash...'
$actualHash = (Get-FileHash -Path $InstallerPath -Algorithm SHA256).Hash

if ($actualHash -ne $ExpectedSha256.ToUpper()) {
    Remove-Item $InstallerPath -Force -ErrorAction SilentlyContinue
    Fail "SHA-256 mismatch!`n  Expected: $($ExpectedSha256.ToUpper())`n  Actual  : $actualHash"
}
Pass "SHA-256 verified: $actualHash"

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
# The startup entry is written by the app itself on first launch - skip this check
Pass 'Installation file check passed'
} else {
    Write-Host "RESULT: ALREADY_CURRENT - installed $collectorVersion; MSI download and installation skipped."
}

# ---------------------------------------------------------------
# Step 6: Unattended background initialization
# ---------------------------------------------------------------
Write-Step 'Starting unattended background collection...'
$bootstrap = Join-Path $InstallDir 'collector\Initialize-BackgroundCollector.ps1'
if (-not (Test-Path $bootstrap)) {
    Fail 'This package does not contain unattended background initialization. Deploy the new background-capable MSI through Action1.'
}
# Management orchestrates the task; it never invokes geolocation or the GUI as SYSTEM.
$bootstrapArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$bootstrap`""
$bootstrapProcess = Start-Process "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -ArgumentList $bootstrapArgs -Wait -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $TempDir 'background.log') `
    -RedirectStandardError (Join-Path $TempDir 'background-error.log')
Get-Content (Join-Path $TempDir 'background.log') | Write-Host
if ($bootstrapProcess.ExitCode -ne 0) {
    Fail 'Installation succeeded, but unattended collection is blocked. No user prompt or consent change was attempted; see background diagnostics.'
}
Pass 'Unattended background initialization completed; no user input required.'

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
Write-Host "Target version: $TargetVersionText; recurring rollout can safely run again."
Write-Host 'Background collection uses an existing consenting user; no client launch or forced consent.'
Write-Host '============================================'
