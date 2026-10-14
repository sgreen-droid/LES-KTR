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

function Get-HealthAgeMinutes {
    param([string]$Timestamp, [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow)
    if ([string]::IsNullOrWhiteSpace($Timestamp) -or
        $Timestamp -notmatch '(Z|[+-]\d{2}:?\d{2})$') { return $null }
    $parsed = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($Timestamp,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$parsed)) { return $null }
    return ($Now - $parsed).TotalMinutes
}

function Get-LocationAgeStatus {
    param([bool]$HasCoordinates, [Nullable[double]]$ReadingAge)
    if (-not $HasCoordinates) { return 'NO LOCATION' }
    if ($null -eq $ReadingAge -or [double]::IsNaN($ReadingAge) -or [double]::IsInfinity($ReadingAge) -or $ReadingAge -lt -2) { return 'UNKNOWN' }
    if ($ReadingAge -ge 1440) { return 'STALE' }
    if ($ReadingAge -ge 60) { return 'WARNING' }
    return 'ACTIVE'
}

function Get-HealthDiagnosis {
    param(
        [bool]$Installed,
        [string]$ProcessState,
        [string]$Permission,
        [string]$Integrity,
        [string]$AttemptStatus,
        [string]$PositionSource,
        [bool]$HasCoordinates,
        [Nullable[double]]$ReadingAge,
        [Nullable[double]]$AttemptAge,
        [double]$RefreshMinutes = 15,
        [bool]$BackgroundHealthy = $false,
        [bool]$CollectorInstalled = $false
    )
    if (-not $Installed) { return 'NOT INSTALLED' }
    if ($Integrity -eq 'INVALID') { return 'INTEGRITY FAILED' }
    if ($Permission -in @('Denied', 'NotGranted')) { return 'PERMISSION DENIED' }
    if ($ProcessState -eq 'NOT RUNNING' -and -not $BackgroundHealthy) {
        if ($CollectorInstalled) { return 'BACKGROUND COLLECTION NOT CURRENT' }
        return 'INTERACTIVE AGENT NOT RUNNING'
    }
    if ($ProcessState -eq 'SESSION ZERO ONLY') { return 'AGENT IN NON-INTERACTIVE SESSION' }
    if ($null -ne $ReadingAge -and $ReadingAge -lt -2) { return 'INVALID LOCATION TIME' }
    if ($PositionSource -in @('IPAddress', 'IP Address', 'IP', 'IP Geolocation')) { return 'IP LOCATION NOT A PHYSICAL FIX' }
    if ($HasCoordinates -and $null -ne $ReadingAge -and $ReadingAge -le 30) {
        return 'RECENT LOCATION READING'
    }
    $attemptThreshold = [Math]::Max(30, ($RefreshMinutes * 2) + 5)
    if ($null -eq $AttemptAge -or $AttemptAge -gt $attemptThreshold -or $AttemptAge -lt -2) {
        return 'NO RECENT AGENT ATTEMPT'
    }
    if ($AttemptStatus -eq 'TimedOut') { return 'LOCATION REQUESTS TIMING OUT' }
    if ($AttemptStatus -eq 'UntrustedSource') { return 'IP-ONLY LOCATION REJECTED' }
    if (-not $HasCoordinates) { return 'NO LOCATION' }
    if ($null -eq $ReadingAge) { return 'LOCATION TIME UNAVAILABLE' }
    if ($ReadingAge -ge 1440) { return 'STALE - NO NEW LOCATION FOR 24 HOURS' }
    if ($ReadingAge -ge 60) { return 'WARNING - NO NEW LOCATION FOR 1 HOUR' }
    return 'NO RECENT PHYSICAL FIX'
}

$InstallDir   = 'C:\Program Files\LES Location Agent'
$ExePath      = Join-Path $InstallDir 'LESLocationAgent.exe'
$CollectorExe = Join-Path $InstallDir 'collector\LESLocationCollector.exe'
$collectorInstalled = Test-Path $CollectorExe
if ($collectorInstalled) { $ExePath = $CollectorExe }
$LocationFile = 'C:\ProgramData\LESLocationAgent\location.json'
$StatusFile   = 'C:\ProgramData\LESLocationAgent\status.json'

Write-Host '=== LES Location Agent Health Check ==='
Write-Host "Computer : $env:COMPUTERNAME"
Write-Host "Time     : $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
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

# Read-only process/session probes. Never start the UI in SYSTEM/session zero.
$processState = 'UNKNOWN'
try {
    $agentProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'LESLocationAgent.exe' OR Name = 'LESLocationCollector.exe'" -ErrorAction Stop)
    $interactive = @($agentProcesses | Where-Object { $_.SessionId -gt 0 })
    $processState = if ($agentProcesses.Count -eq 0) { 'NOT RUNNING' }
        elseif ($interactive.Count -eq 0) { 'SESSION ZERO ONLY' } else { 'RUNNING' }
    Write-Host "Agent Process    : $processState"
    Write-Host "Agent Sessions   : $(($agentProcesses | ForEach-Object { $_.SessionId }) -join ', ')"
} catch { Write-Host 'Agent Process    : UNKNOWN (process probe failed)' }

$backgroundHealthy = $false
if ($collectorInstalled) {
    try {
        $tasks = @(Get-ScheduledTask -TaskName 'LES Location Collector -*' -ErrorAction Stop |
            Where-Object { $_.Settings.Enabled -and $_.Principal.LogonType -eq 'Interactive' -and
                $_.Principal.RunLevel -eq 'Limited' -and
                @($_.Actions).Count -eq 1 -and $_.Actions[0].Execute -eq $CollectorExe })
        foreach ($task in $tasks) {
            $info = Get-ScheduledTaskInfo -InputObject $task -ErrorAction Stop
            $runAge = ([DateTime]::Now - $info.LastRunTime).TotalMinutes
            if ($info.LastTaskResult -eq 0 -and $runAge -ge 0 -and $runAge -le 30) { $backgroundHealthy = $true }
        }
        Write-Host "Background Tasks : $($tasks.Count); recent successful run: $backgroundHealthy"
    } catch { Write-Host 'Background Tasks : unavailable or not registered' }
}

try {
    $startup = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -ErrorAction Stop
    $hasStartup = $null -ne $startup.PSObject.Properties['LESLocationAgent']
    Write-Host "Machine Startup  : $(if ($hasStartup) { 'PRESENT' } else { 'MISSING; per-user startup not checked from SYSTEM' })"
} catch { Write-Host 'Machine Startup  : UNKNOWN (registry probe failed)' }

$refreshMinutes = 15.0
try {
    $configPath = 'C:\ProgramData\LESLocationAgent\config.json'
    if (Test-Path $configPath) {
        $config = Get-Content $configPath -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ($config.PSObject.Properties['refreshMinutes']) {
            $parsedRefresh = 0.0
            if ([double]::TryParse([string]$config.refreshMinutes, [ref]$parsedRefresh) -and
                -not [double]::IsNaN($parsedRefresh) -and -not [double]::IsInfinity($parsedRefresh)) {
                $refreshMinutes = [Math]::Max(5, $parsedRefresh)
            } else { Write-Warning 'Invalid refreshMinutes in config.json; inspect the configuration.' }
        }
    }
} catch { Write-Warning 'Could not read config.json; reported interval is the default, not verified.' }
Write-Host "Refresh Interval : $refreshMinutes minutes"
if ($refreshMinutes -ge 30) { Write-Warning 'Refresh interval is at least the recent-reading diagnostic window. Keep the approved collection cadence; warning begins at 60 minutes and stale at 1440 minutes.' }

# ---------------------------------------------------------------
# 3. Status file
# ---------------------------------------------------------------
$permissionStatus = 'Unknown'
$locationStatus   = 'Unknown'
$lastAttempt      = 'Never'
$lastSuccess      = 'Never'
$lastHeartbeat    = 'Never'
$deviceId         = 'Unknown'
$recordSequence   = 'Unknown'
$integrityStatus  = 'MISSING'
$agentHealth      = 'UNKNOWN'
$lastError        = ''

if (Test-Path $StatusFile) {
    try {
        $statusData = Get-Content $StatusFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $permissionStatus = if ($statusData.PSObject.Properties['permissionStatus']) { $statusData.permissionStatus } else { 'Unknown' }
        $locationStatus   = if ($statusData.PSObject.Properties['locationStatus'])   { $statusData.locationStatus   } else { 'Unknown' }
        $lastAttempt      = if ($statusData.PSObject.Properties['lastAttemptUtc'])   { $statusData.lastAttemptUtc   } else { 'Never' }
        $lastSuccess      = if ($statusData.PSObject.Properties['lastSuccessUtc'])   { $statusData.lastSuccessUtc   } else { 'Never' }
        $lastHeartbeat    = if ($statusData.PSObject.Properties['lastHeartbeatUtc']) { $statusData.lastHeartbeatUtc } else { 'Never' }
        $deviceId         = if ($statusData.PSObject.Properties['deviceId'])         { $statusData.deviceId         } else { 'Unknown' }
        $recordSequence   = if ($statusData.PSObject.Properties['recordSequence'])   { $statusData.recordSequence   } else { 'Unknown' }
        $integrityStatus  = if ($statusData.PSObject.Properties['integrityStatus'])  { $statusData.integrityStatus  } else { 'MISSING' }
        $agentHealth      = if ($statusData.PSObject.Properties['agentHealth'])      { $statusData.agentHealth      } else { 'UNKNOWN' }
        $lastError        = if ($statusData.PSObject.Properties['error'])            { $statusData.error            } else { '' }
    } catch {
        Write-Warning "Could not read status.json: $_"
    }
}

Write-Host "Permission       : $permissionStatus"
Write-Host "Last Attempt     : $lastAttempt"
Write-Host "Last Success     : $lastSuccess"
Write-Host "Last Heartbeat   : $lastHeartbeat"
Write-Host "Device ID        : $deviceId"
Write-Host "Record Sequence  : $recordSequence"
Write-Host "Integrity        : $integrityStatus"
Write-Host "Agent Health     : $agentHealth"
Write-Host "Last Error       : $lastError"
Write-Host 'Health values above are stored reports, not proof of current agent activity.'

# ---------------------------------------------------------------
# 4. Location age
# ---------------------------------------------------------------
$now = [DateTimeOffset]::UtcNow
$successAge = Get-HealthAgeMinutes $lastSuccess $now
$attemptAge = Get-HealthAgeMinutes $lastAttempt $now
$heartbeatAge = Get-HealthAgeMinutes $lastHeartbeat $now
foreach ($entry in @(
    @{ Label = 'Success Age'; Age = $successAge },
    @{ Label = 'Attempt Age'; Age = $attemptAge },
    @{ Label = 'Status Write Age'; Age = $heartbeatAge }
)) {
    $display = if ($null -eq $entry.Age) { 'Unknown / invalid timestamp' }
        else { "$([Math]::Round($entry.Age, 1)) minutes" }
    Write-Host "$($entry.Label) : $display"
}
Write-Host 'Last Heartbeat currently records a status write; it is not an independent heartbeat monitor.'

# ---------------------------------------------------------------
# 5. Location data
# ---------------------------------------------------------------
$lat      = 'N/A'
$lon      = 'N/A'
$accuracy = 'N/A'
$quality  = 'N/A'
$locationTimestamp = ''
$positionSource = 'Unknown'

if (Test-Path $LocationFile) {
    try {
        $locData  = Get-Content $LocationFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $lat      = if ($locData.PSObject.Properties['latitude'])       { $locData.latitude      } else { 'N/A' }
        $lon      = if ($locData.PSObject.Properties['longitude'])      { $locData.longitude     } else { 'N/A' }
        $accuracy = if ($locData.PSObject.Properties['accuracyMeters']) { "$($locData.accuracyMeters) meters" } else { 'N/A' }
        $quality  = if ($locData.PSObject.Properties['accuracyQuality']){ $locData.accuracyQuality } else { 'N/A' }
        $locationTimestamp = if ($locData.PSObject.Properties['timestampUtc']) { [string]$locData.timestampUtc } else { '' }
        $positionSource = if ($locData.PSObject.Properties['positionSource']) { [string]$locData.positionSource } else { 'Unknown' }
        if ($locData.PSObject.Properties['deviceId']) { $deviceId = $locData.deviceId }
        if ($locData.PSObject.Properties['recordSequence']) { $recordSequence = $locData.recordSequence }
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
Write-Host "Position Source  : $positionSource"
Write-Host "Reading Time UTC : $locationTimestamp"
$readingAge = Get-HealthAgeMinutes $locationTimestamp $now
$ageDisplay = if ($null -eq $readingAge) { 'Unknown / invalid timestamp' }
    else { "$([Math]::Round($readingAge, 1)) minutes" }
Write-Host "Location Age     : $ageDisplay"
if ($null -ne $readingAge -and $null -ne $successAge -and
    [Math]::Abs($successAge - $readingAge) -gt 2) {
    Write-Warning 'Success time differs from the actual location timestamp. Treat location.json timestampUtc as the reading time; older agents can mislabel local success time as UTC.'
}
Write-Host ''
Write-Host "Location Status  : $locationStatus"

# ---------------------------------------------------------------
# 6. Overall result
# ---------------------------------------------------------------
Write-Host ''
$hasCoordinates = $lat -ne 'N/A' -and $lon -ne 'N/A' -and $null -ne $lat -and $null -ne $lon
Write-Host "Location Freshness: $(Get-LocationAgeStatus -HasCoordinates $hasCoordinates -ReadingAge $readingAge)"
Write-Host 'Age policy       : WARNING at 60 minutes; STALE at 1440 minutes. Last-known coordinates are not proof of a current location.'
$diagnosis = Get-HealthDiagnosis -Installed $installed -ProcessState $processState `
    -Permission $permissionStatus -Integrity $integrityStatus -AttemptStatus $locationStatus `
    -PositionSource $positionSource -HasCoordinates $hasCoordinates -ReadingAge $readingAge `
    -AttemptAge $attemptAge -RefreshMinutes $refreshMinutes `
    -BackgroundHealthy $backgroundHealthy -CollectorInstalled $collectorInstalled
Write-Host "RESULT: $diagnosis"
switch ($diagnosis) {
    'BACKGROUND COLLECTION NOT CURRENT' { Write-Host 'NEXT: Inspect the signed-in user background task and C:\ProgramData\LESLocationAgent\collector.log. Do not launch the client or use SYSTEM to collect.' }
    'INTERACTIVE AGENT NOT RUNNING' { Write-Host 'NEXT: In an authorized signed-in user session, launch LES Location Agent and inspect C:\ProgramData\LESLocationAgent\startup.log. Do not launch it as SYSTEM.' }
    'AGENT IN NON-INTERACTIVE SESSION' { Write-Host 'NEXT: Review deployment/startup. Windows geolocation requires the interactive user context; do not use session zero as a repair.' }
    'NO RECENT AGENT ATTEMPT' { Write-Host 'NEXT: Check startup.log, the running user session, and the refresh configuration. Old Action1 data cannot establish whether a new attempt occurred locally.' }
    'LOCATION REQUESTS TIMING OUT' { Write-Host 'NEXT: Review Windows Location Services and network/location-provider availability in the authorized user session.' }
    'PERMISSION DENIED' { Write-Host 'NEXT: Review Windows Location Services under the approved consent policy. This diagnostic does not change permissions.' }
    'IP-ONLY LOCATION REJECTED' { Write-Host 'NEXT: A fresh physical-source fix is required. Do not replace it with an IP office-location estimate.' }
    'RECENT LOCATION READING' { Write-Host 'NEXT: If the console still shows an older reading, inspect the Action1 sync schedule and its execution output.' }
    default { Write-Host 'NEXT: Review the timestamps, process/session result, last error, and startup.log before choosing a repair.' }
}
