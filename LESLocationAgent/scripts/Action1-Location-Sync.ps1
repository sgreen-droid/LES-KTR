<#
.SYNOPSIS
    Reads LES Location Agent output files and populates Action1 Custom Attributes.

.DESCRIPTION
    Reads C:\ProgramData\LESLocationAgent\location.json and status.json,
    validates all values, calculates staleness, and calls Action1-Set-CustomAttribute
    with the existing location attributes plus Map Link, Location Coordinates,
    and Location Summary.

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
      Location Updated, Location Status, Map Link, Location Coordinates,
      Location Summary
#>

#Requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------
# Paths
# ---------------------------------------------------------------
$LocationFile = if (
    [string]::IsNullOrWhiteSpace($env:LES_LOCATION_AGENT_LOCATION_FILE)
) {
    'C:\ProgramData\LESLocationAgent\location.json'
}
else {
    $env:LES_LOCATION_AGENT_LOCATION_FILE
}

$StatusFile = if (
    [string]::IsNullOrWhiteSpace($env:LES_LOCATION_AGENT_STATUS_FILE)
) {
    'C:\ProgramData\LESLocationAgent\status.json'
}
else {
    $env:LES_LOCATION_AGENT_STATUS_FILE
}

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

# New attributes are optional during rollout. If one has not been created in
# Action1 yet, keep the established location sync successful and log the
# optional-attribute failure instead of aborting the whole automation.
function Set-OptionalAttribute {
    param([string]$Name, $Value)
    try {
        Set-Attribute $Name $Value
    } catch {
        Write-Warning "Optional attribute '$Name' was not updated: $_"
    }
}

# ---------------------------------------------------------------
# Helper: set all attributes to an error/unknown state
# ---------------------------------------------------------------
function Set-ErrorState {
    param([string]$Status, [string]$Reason)
    Write-Warning "Location Sync: $Reason"
    Write-Warning 'Map Link not updated — valid coordinates unavailable.'
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
    return
}

# 3. Validate location.json exists
if (-not (Test-Path $LocationFile)) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'NO LOCATION' "location.json not found at $LocationFile"
    return
}

# 4. Parse location.json
try {
    $raw  = Get-Content $LocationFile -Raw -Encoding UTF8
    $data = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Failed to parse location.json: $_"
    return
}

# 5. Validate required fields exist
if ($null -eq $data.latitude -or $null -eq $data.longitude) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'NO LOCATION' 'location.json is missing latitude or longitude'
    return
}

# 6. Validate coordinate ranges
try {
    $lat = [double]$data.latitude
    $lon = [double]$data.longitude
} catch {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Coordinates are not numeric: $_"
    return
}

if ([double]::IsNaN($lat) -or [double]::IsInfinity($lat) -or
    $lat -lt -90 -or $lat -gt 90) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Invalid latitude value: $lat (must be -90 to 90)"
    return
}

if ([double]::IsNaN($lon) -or [double]::IsInfinity($lon) -or
    $lon -lt -180 -or $lon -gt 180) {
    Set-Attribute 'Location Permission' $permissionStatus
    Set-ErrorState 'ERROR' "Invalid longitude value: $lon (must be -180 to 180)"
    return
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

# 9. Generate the optional human-readable location values. Use invariant
# formatting so the URL is valid regardless of the endpoint's locale.
$mapLink            = $null
$locationCoordinates = $null
$locationSummary    = $null
try {
    $latText = $lat.ToString('F6', [System.Globalization.CultureInfo]::InvariantCulture)
    $lonText = $lon.ToString('F6', [System.Globalization.CultureInfo]::InvariantCulture)
    $locationCoordinates = "$latText, $lonText"
    $mapLink = "https://www.google.com/maps/search/?api=1&query=$latText,$lonText"

    $summaryAccuracy = 'unknown'
    if ($null -ne $accuracyMeters) {
        try {
            $summaryAccuracy = ([double]$accuracyMeters).ToString(
                '0.##', [System.Globalization.CultureInfo]::InvariantCulture)
        } catch {
            Write-Warning "Could not format accuracy for Location Summary: $_"
        }
    }
    $summarySource = if ([string]::IsNullOrWhiteSpace("$positionSource")) {
        'Unknown'
    } else {
        "$positionSource"
    }
    $locationSummary = "$locationCoordinates | ±$summaryAccuracy m | $summarySource | $locationStatus"
} catch {
    Write-Warning "Map Link not updated — could not format valid coordinates: $_"
}

# 10. Set all Custom Attributes
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
if ($null -ne $mapLink) {
    Set-OptionalAttribute 'Map Link'             $mapLink
    Set-OptionalAttribute 'Location Coordinates' $locationCoordinates
    Set-OptionalAttribute 'Location Summary'     $locationSummary
} else {
    Write-Warning 'Map Link not updated — valid coordinates unavailable.'
}

Write-Host "`n=== Sync complete ==="
Write-Output "RESULT: $locationStatus"
Write-Output "Latitude: $lat  Longitude: $lon  Accuracy: $accuracyMeters m  Quality: $accuracyQuality"
if ($null -ne $mapLink) {
    Write-Output "Map: $mapLink"
} else {
    Write-Output 'Map Link not updated — valid coordinates unavailable.'
}
