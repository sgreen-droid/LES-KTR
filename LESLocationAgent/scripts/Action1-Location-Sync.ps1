<#
.SYNOPSIS
    Reads LES Location Agent output files and populates Action1 Custom Attributes.

.DESCRIPTION
    Reads C:\ProgramData\LESLocationAgent\location.json and status.json,
    validates all values, calculates staleness, and calls Action1-Set-CustomAttribute
    with the 9 required attribute names.

    Location Status values:
      ACTIVE          — location exists and is <= 30 minutes old
      STALE           — location exists but is > 30 minutes old
      NO LOCATION     — no valid location has ever been written
      PERMISSION DENIED — Windows location access is denied
      ERROR           — file missing, malformed JSON, or invalid coordinates

.NOTES
    Deploy this script via Action1 Automation.
    Required Action1 Custom Attributes (create these in the Action1 portal):
      Latitude, Longitude, Location Accuracy, Location Quality,
      Location Source, Position Source, Location Permission,
      Location Updated, Location Status
#>

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# Paths
# ---------------------------------------------------------------
$LocationFile = 'C:\ProgramData\LESLocationAgent\location.json'
$StatusFile   = 'C:\ProgramData\LESLocationAgent\status.json'
$StalenessThresholdMinutes = 30

# ---------------------------------------------------------------
# Helper: safe attribute setter — wraps Action1-Set-CustomAttribute
# ---------------------------------------------------------------
function Set-Attribute {
    param([string]$Name, $Value)
    $displayValue = if ($null -eq $Value) { '' } else { "$Value" }
    Write-Host "  Setting '$Name' = '$displayValue'"
    Action1-Set-CustomAttribute $Name $displayValue
}

# ---------------------------------------------------------------
# Helper: set all attributes to an error/unknown state
# ---------------------------------------------------------------
function Set-ErrorState {
    param([string]$Status, [string]$Reason)
    Write-Warning "Location Sync: $Reason"
    Set-Attribute 'Latitude'          ''
    Set-Attribute 'Longitude'         ''
    Set-Attribute 'Location Accuracy' ''
    Set-Attribute 'Location Quality'  ''
    Set-Attribute 'Location Source'   ''
    Set-Attribute 'Position Source'   ''
    Set-Attribute 'Location Permission' ''
    Set-Attribute 'Location Updated'  ''
    Set-Attribute 'Location Status'   $Status
    Write-Output "RESULT: $Status — $Reason"
}

# ---------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------

Write-Host '=== LES Location Agent — Action1 Sync ==='
Write-Host "Running as: $($env:USERNAME) on $($env:COMPUTERNAME)"
Write-Host "Timestamp:  $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"

# 1. Check permission status first (from status.json — more reliable for permission info)
$permissionStatus = 'Unknown'
if (Test-Path $StatusFile) {
    try {
        $statusRaw = Get-Content $StatusFile -Raw -Encoding UTF8
        $statusData = $statusRaw | ConvertFrom-Json -ErrorAction Stop
        if ($statusData.PSObject.Properties['permissionStatus']) {
            $permissionStatus = $statusData.permissionStatus
        }
    } catch {
        Write-Warning "Could not read status.json: $_"
    }
}

# 2. Check if permission is denied before anything else
if ($permissionStatus -eq 'Denied') {
    Set-Attribute 'Location Permission' 'Denied'
    Set-ErrorState 'PERMISSION DENIED' 'Windows location access is denied on this device'
    exit 0
}

# 3. Validate location.json exists
if (-not (Test-Path $LocationFile)) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'NO LOCATION' "location.json not found at $LocationFile"
    exit 0
}

# 4. Parse location.json
try {
    $raw  = Get-Content $LocationFile -Raw -Encoding UTF8
    $data = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Failed to parse location.json: $_"
    exit 0
}

# 5. Validate required fields exist
if ($null -eq $data.latitude -or $null -eq $data.longitude) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'NO LOCATION' 'location.json is missing latitude or longitude'
    exit 0
}

# 6. Validate coordinate ranges
$lat = [double]$data.latitude
$lon = [double]$data.longitude

if ($lat -lt -90 -or $lat -gt 90) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Invalid latitude value: $lat (must be -90 to 90)"
    exit 0
}

if ($lon -lt -180 -or $lon -gt 180) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Invalid longitude value: $lon (must be -180 to 180)"
    exit 0
}

# 7. Calculate staleness
$locationStatus = 'UNKNOWN'
$timestampStr   = ''

if ($data.PSObject.Properties['timestampUtc'] -and $data.timestampUtc) {
    $timestampStr = $data.timestampUtc
    try {
        $locationTime = [DateTimeOffset]::Parse($timestampStr, $null,
            [System.Globalization.DateTimeStyles]::RoundtripKind)
        $ageMinutes = ([DateTimeOffset]::UtcNow - $locationTime).TotalMinutes

        $locationStatus = if ($ageMinutes -le $StalenessThresholdMinutes) { 'ACTIVE' } else { 'STALE' }
        Write-Host "Location age: $([Math]::Round($ageMinutes, 1)) minutes — $locationStatus"
    } catch {
        Write-Warning "Could not parse timestamp '$timestampStr': $_"
        $locationStatus = 'STALE'
    }
} else {
    $locationStatus = 'NO LOCATION'
}

# 8. Extract optional fields safely
$accuracyMeters  = if ($data.PSObject.Properties['accuracyMeters'])  { $data.accuracyMeters  } else { $null }
$accuracyQuality = if ($data.PSObject.Properties['accuracyQuality']) { $data.accuracyQuality } else { '' }
$locationSource  = if ($data.PSObject.Properties['locationSource'])  { $data.locationSource  } else { 'Windows Geolocation' }
$positionSource  = if ($data.PSObject.Properties['positionSource'])  { $data.positionSource  } else { '' }
$permission      = if ($data.PSObject.Properties['permissionStatus']){ $data.permissionStatus } else { $permissionStatus }

# 9. Set all Custom Attributes
Write-Host "`nSetting Action1 Custom Attributes..."
Set-Attribute 'Latitude'            $lat
Set-Attribute 'Longitude'           $lon
Set-Attribute 'Location Accuracy'   $accuracyMeters
Set-Attribute 'Location Quality'    $accuracyQuality
Set-Attribute 'Location Source'     $locationSource
Set-Attribute 'Position Source'     $positionSource
Set-Attribute 'Location Permission' $permission
Set-Attribute 'Location Updated'    $timestampStr
Set-Attribute 'Location Status'     $locationStatus

Write-Host "`n=== Sync complete ==="
Write-Output "RESULT: $locationStatus"
Write-Output "Latitude: $lat  Longitude: $lon  Accuracy: $accuracyMeters m  Quality: $accuracyQuality"
