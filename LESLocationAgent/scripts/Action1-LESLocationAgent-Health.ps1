<#
.SYNOPSIS
    Reports the health status of LES Location Agent on this endpoint via Action1.

.DESCRIPTION
    Checks:
      - Whether the application is installed
      - Agent version
      - Last successful location time and age
      - Location permission status
      - Current latitude, longitude, accuracy, and quality

    Designed to run as an Action1 Automation script (read-only; does not modify anything).
#>

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

$InstallDir   = 'C:\Program Files\LES Location Agent'
$ExePath      = Join-Path $InstallDir 'LESLocationAgent.exe'
$LocationFile = 'C:\ProgramData\LESLocationAgent\location.json'
$StatusFile   = 'C:\ProgramData\LESLocationAgent\status.json'

Write-Host '=== LES Location Agent Health Check ==='
Write-Host "Computer : $env:COMPUTERNAME"
Write-Host "Time     : $(Get-Date -AsUTC -Format 'yyyy-MM-ddTHH:mm:ssZ')"
Write-Host ''

# ---------------------------------------------------------------
# 1. Installed?
# ---------------------------------------------------------------
$installed = Test-Path $ExePath
Write-Host "Installed        : $(if ($installed) { 'YES' } else { 'NO' })"

if (-not $installed) {
    Write-Host ''
    Write-Host 'RESULT: NOT INSTALLED'
    exit 0
}

# ---------------------------------------------------------------
# 2. Agent version
# ---------------------------------------------------------------
try {
    $versionInfo = (Get-Item $ExePath).VersionInfo
    $agentVersion = "$($versionInfo.FileMajorPart).$($versionInfo.FileMinorPart).$($versionInfo.FileBuildPart)"
} catch {
    $agentVersion = 'Unknown'
}
Write-Host "Agent Version    : $agentVersion"

# ---------------------------------------------------------------
# 3. Status file
# ---------------------------------------------------------------
$permissionStatus = 'Unknown'
$locationStatus   = 'Unknown'
$lastAttempt      = 'Never'
$lastSuccess      = 'Never'

if (Test-Path $StatusFile) {
    try {
        $statusData = Get-Content $StatusFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $permissionStatus = $statusData.permissionStatus ?? 'Unknown'
        $locationStatus   = $statusData.locationStatus   ?? 'Unknown'
        $lastAttempt      = $statusData.lastAttemptUtc   ?? 'Never'
        $lastSuccess      = $statusData.lastSuccessUtc   ?? 'Never'
    } catch {
        Write-Warning "Could not read status.json: $_"
    }
}

Write-Host "Permission       : $permissionStatus"
Write-Host "Last Attempt     : $lastAttempt"
Write-Host "Last Success     : $lastSuccess"

# ---------------------------------------------------------------
# 4. Location age
# ---------------------------------------------------------------
$ageDisplay = 'N/A'
if ($lastSuccess -ne 'Never' -and $lastSuccess) {
    try {
        $successTime = [DateTimeOffset]::Parse($lastSuccess, $null,
            [System.Globalization.DateTimeStyles]::RoundtripKind)
        $ageMinutes = [Math]::Round(([DateTimeOffset]::UtcNow - $successTime).TotalMinutes, 1)
        $ageDisplay = "$ageMinutes minutes"
    } catch {
        $ageDisplay = 'Parse error'
    }
}
Write-Host "Location Age     : $ageDisplay"

# ---------------------------------------------------------------
# 5. Location data
# ---------------------------------------------------------------
$lat      = 'N/A'
$lon      = 'N/A'
$accuracy = 'N/A'
$quality  = 'N/A'

if (Test-Path $LocationFile) {
    try {
        $locData  = Get-Content $LocationFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $lat      = $locData.latitude      ?? 'N/A'
        $lon      = $locData.longitude     ?? 'N/A'
        $accuracy = if ($locData.accuracyMeters) { "$($locData.accuracyMeters) meters" } else { 'N/A' }
        $quality  = $locData.accuracyQuality ?? 'N/A'
    } catch {
        Write-Warning "Could not read location.json: $_"
    }
} else {
    Write-Host 'location.json    : NOT FOUND (no location acquired yet)'
}

Write-Host "Latitude         : $lat"
Write-Host "Longitude        : $lon"
Write-Host "Accuracy         : $accuracy"
Write-Host "Accuracy Quality : $quality"
Write-Host ''
Write-Host "Location Status  : $locationStatus"

# ---------------------------------------------------------------
# 6. Overall result
# ---------------------------------------------------------------
Write-Host ''
if (-not $installed) {
    Write-Host 'RESULT: NOT INSTALLED'
} elseif ($permissionStatus -eq 'Denied') {
    Write-Host 'RESULT: PERMISSION DENIED'
} elseif ($lat -eq 'N/A') {
    Write-Host 'RESULT: NO LOCATION'
} elseif ($ageDisplay -ne 'N/A') {
    $ageNum = [double]($ageDisplay -replace ' minutes', '')
    Write-Host "RESULT: $(if ($ageNum -le 30) { 'ACTIVE' } else { 'STALE' })"
} else {
    Write-Host 'RESULT: UNKNOWN'
}
