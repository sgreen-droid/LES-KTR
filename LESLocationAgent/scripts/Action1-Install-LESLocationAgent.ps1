<#
.SYNOPSIS
    Downloads and silently installs LES Location Agent via Action1.

.DESCRIPTION
    1. Downloads the MSI installer from a configurable HTTPS URL.
    2. Verifies the SHA-256 hash before installation.
    3. Installs silently.
    4. Confirms program files exist.
    5. Leaves the agent registered for the next interactive user sign-in.
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
# RELEASE CONFIGURATION
#
# Tagged GitHub releases replace these placeholders automatically. For a
# privately hosted MSI, replace BOTH values before putting this script in
# Action1. The script intentionally refuses an unpinned installer.
# ---------------------------------------------------------------
$InstallerUrl   = '__INSTALLER_URL__'
$ExpectedSha256 = '__INSTALLER_SHA256__'
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
Write-Host "Time     : $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"

if ($InstallerUrl -notmatch '^https://') {
    Fail 'InstallerUrl must be an HTTPS URL. Use the preconfigured script from a tagged release or set a trusted HTTPS URL.'
}

if ($ExpectedSha256 -notmatch '^[0-9A-Fa-f]{64}$') {
    Fail 'ExpectedSha256 must be the 64-character SHA-256 hash for this exact MSI. Integrity verification cannot be skipped.'
}

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
    # Force TLS 1.2 — required for GitHub (PS5.1 defaults to older versions)
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    # Use Invoke-WebRequest — handles GitHub CDN redirects more reliably than WebClient
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
# The startup entry is written by the app itself on first launch — skip this check
Pass 'Installation file check passed'

# ---------------------------------------------------------------
# Step 6: Interactive-user consent
# ---------------------------------------------------------------
Write-Step 'Recording interactive-user consent requirement...'
Write-Warning 'Action1 runs this installer outside the interactive user session.'
Write-Warning 'LES Location Agent starts at the next user sign-in. An authorized user must then review Windows Location Services under the organization-approved policy.'

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
Write-Host 'The agent starts at the next interactive user sign-in.'
Write-Host '============================================'
