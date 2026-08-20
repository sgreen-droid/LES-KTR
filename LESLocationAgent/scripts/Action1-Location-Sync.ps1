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
      Location Summary, Device ID, Location Sequence, Location Integrity,
      Agent Health, Agent Version, Last Attempt, Last Success,
      Location Age Minutes, Recovery Status, Location Error
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

$StateFile = if (
    [string]::IsNullOrWhiteSpace($env:LES_LOCATION_AGENT_STATE_FILE)
) {
    'C:\ProgramData\LESLocationAgent\agent-state.json'
}
else {
    $env:LES_LOCATION_AGENT_STATE_FILE
}

$StalenessThresholdMinutes = 30
$script:statusData = $null
$script:locationData = $null
$script:integrityStatus = 'MISSING'

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

function Get-PropertyValue {
    param($Object, [string]$Name, $Default = '')

    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) {
        $value = $Object.PSObject.Properties[$Name].Value
        if ($null -ne $value) {
            return $value
        }
    }

    return $Default
}

function Get-LocationIntegrityStatus {
    param($LocationData, [string]$IdentityStateFile)

    if ($null -eq $LocationData) {
        return 'MISSING'
    }

    $deviceId = [string](Get-PropertyValue $LocationData 'deviceId' '')
    $signature = [string](Get-PropertyValue $LocationData 'integrityHmac' '')
    $algorithm = [string](Get-PropertyValue $LocationData 'integrityAlgorithm' '')
    $hasRecoveryFields = $null -ne $LocationData.PSObject.Properties['deviceId'] -or
        $null -ne $LocationData.PSObject.Properties['integrityHmac'] -or
        $null -ne $LocationData.PSObject.Properties['integrityAlgorithm'] -or
        $null -ne $LocationData.PSObject.Properties['recordSequence']
    if (-not $hasRecoveryFields) {
        # Existing files from before recovery telemetry remain usable after upgrade.
        return 'LEGACY'
    }

    if ([string]::IsNullOrWhiteSpace($deviceId) -or
        [string]::IsNullOrWhiteSpace($signature) -or
        $algorithm -cne 'HMAC-SHA256-IEEE754LE' -or
        -not (Test-Path $IdentityStateFile)) {
        return 'INVALID'
    }

    try {
        $identity = Get-Content $IdentityStateFile -Raw -Encoding UTF8 |
            ConvertFrom-Json -ErrorAction Stop
        if ([string](Get-PropertyValue $identity 'deviceId' '') -cne $deviceId) {
            return 'INVALID'
        }

        $key = [Convert]::FromBase64String(
            [string](Get-PropertyValue $identity 'integrityKey' ''))
        if ($key.Length -ne 32) {
            return 'INVALID'
        }

        $sequenceValue = [Int64](Get-PropertyValue $LocationData 'recordSequence' 0)
        $sequence = $sequenceValue.ToString(
            [System.Globalization.CultureInfo]::InvariantCulture)
        $latitude = [BitConverter]::ToString(
            [BitConverter]::GetBytes([double]$LocationData.latitude)).Replace('-', '')
        $longitude = [BitConverter]::ToString(
            [BitConverter]::GetBytes([double]$LocationData.longitude)).Replace('-', '')
        $accuracyValue = [double](Get-PropertyValue $LocationData 'accuracyMeters' 0)
        $accuracy = [BitConverter]::ToString(
            [BitConverter]::GetBytes($accuracyValue)).Replace('-', '')
        $timestamp = [string](Get-PropertyValue $LocationData 'timestampUtc' '')
        $permission = [string](Get-PropertyValue $LocationData 'permissionStatus' 'Unknown')
        $agentVersion = [string](Get-PropertyValue $LocationData 'agentVersion' '')
        $payload = "$deviceId|$sequence|$timestamp|$latitude|$longitude|$accuracy|$permission|$agentVersion"

        $hmac = [System.Security.Cryptography.HMACSHA256]::new($key)
        try {
            $actualBytes = $hmac.ComputeHash(
                [System.Text.Encoding]::UTF8.GetBytes($payload))
            $actual = [BitConverter]::ToString($actualBytes).Replace('-', '')
        }
        finally {
            $hmac.Dispose()
        }

        if ($actual -ceq $signature.ToUpperInvariant()) {
            return 'VALID'
        }
    }
    catch {
        Write-Warning "Could not verify location integrity: $_"
    }

    return 'INVALID'
}

function Set-RecoveryAttributes {
    param(
        $LocationData,
        $StatusData,
        [string]$RecoveryStatus,
        [string]$IntegrityStatus,
        [double]$AgeMinutes = [double]::NaN
    )

    $culture = [System.Globalization.CultureInfo]::InvariantCulture
    $deviceId = [string](Get-PropertyValue $LocationData 'deviceId' '')
    $sequence = [string](Get-PropertyValue $LocationData 'recordSequence' '')
    $agentVersion = [string](Get-PropertyValue $LocationData 'agentVersion' '')
    $agentHealth = [string](Get-PropertyValue $StatusData 'agentHealth' $RecoveryStatus)
    $lastAttempt = [string](Get-PropertyValue $StatusData 'lastAttemptUtc' '')
    $lastSuccess = [string](Get-PropertyValue $StatusData 'lastSuccessUtc' '')
    $errorText = [string](Get-PropertyValue $StatusData 'error' '')

    if ($IntegrityStatus -eq 'INVALID') {
        $agentHealth = 'INTEGRITY FAILED'
    }
    elseif ($RecoveryStatus -notin @('ACTIVE', 'STALE', 'UNKNOWN')) {
        $agentHealth = $RecoveryStatus
    }
    if ($errorText.Length -gt 240) {
        $errorText = $errorText.Substring(0, 240)
    }

    $ageText = if ([double]::IsNaN($AgeMinutes)) {
        ''
    }
    else {
        $AgeMinutes.ToString('0.0', $culture)
    }

    Set-OptionalAttribute 'Device ID'            $deviceId
    Set-OptionalAttribute 'Location Sequence'    $sequence
    Set-OptionalAttribute 'Location Integrity'   $IntegrityStatus
    Set-OptionalAttribute 'Agent Health'         $agentHealth
    Set-OptionalAttribute 'Agent Version'        $agentVersion
    Set-OptionalAttribute 'Last Attempt'         $lastAttempt
    Set-OptionalAttribute 'Last Success'         $lastSuccess
    Set-OptionalAttribute 'Location Age Minutes' $ageText
    Set-OptionalAttribute 'Recovery Status'      $RecoveryStatus
    Set-OptionalAttribute 'Location Error'       $errorText
}

# ---------------------------------------------------------------
# Helper: set all attributes to an error/unknown state
# ---------------------------------------------------------------
function Set-ErrorState {
    param([string]$Status, [string]$Reason, [string]$PermissionStatus)
    Write-Warning "Location Sync: $Reason"
    Write-Warning 'Map Link not updated — valid coordinates unavailable.'
    Set-Attribute 'Latitude'          ''
    Set-Attribute 'Longitude'         ''
    Set-Attribute 'Location Accuracy' ''
    Set-Attribute 'Location Quality'  ''
    Set-Attribute 'Location Source'   ''
    Set-Attribute 'Position Source'   ''
    Set-Attribute 'Location Permission' $PermissionStatus
    Set-Attribute 'Location Updated'  ''
    Set-Attribute 'Location Status'   $Status
    Set-RecoveryAttributes $script:locationData $script:statusData `
        $Status $script:integrityStatus
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
        $script:statusData = $statusRaw | ConvertFrom-Json -ErrorAction Stop
        if ($script:statusData.PSObject.Properties['permissionStatus']) {
            $permissionStatus = $script:statusData.permissionStatus
        }
    } catch {
        Write-Warning "Could not read status.json: $_"
    }
}

# 2. Check if permission is denied before anything else
if ($permissionStatus -eq 'Denied') {
    Set-ErrorState 'PERMISSION DENIED' `
        'Windows location access is denied on this device' 'Denied'
    return
}

# 3. Validate location.json exists
if (-not (Test-Path $LocationFile)) {
    Set-ErrorState 'NO LOCATION' "location.json not found at $LocationFile" `
        $permissionStatus
    return
}

# 4. Parse location.json
try {
    $raw  = Get-Content $LocationFile -Raw -Encoding UTF8
    $data = $raw | ConvertFrom-Json -ErrorAction Stop
} catch {
    Set-ErrorState 'ERROR' "Failed to parse location.json: $_" $permissionStatus
    return
}

$script:locationData = $data
$script:integrityStatus = Get-LocationIntegrityStatus $data $StateFile
if ($script:integrityStatus -eq 'INVALID') {
    Set-ErrorState 'ERROR' `
        'Location integrity verification failed; map fields were not updated.' `
        $permissionStatus
    return
}

# 5. Validate required fields exist
if ($null -eq $data.latitude -or $null -eq $data.longitude) {
    $script:locationData = $data
    Set-ErrorState 'NO LOCATION' 'location.json is missing latitude or longitude' `
        $permissionStatus
    return
}

# 6. Validate coordinate ranges
try {
    $lat = [double]$data.latitude
    $lon = [double]$data.longitude
} catch {
    $script:locationData = $data
    Set-ErrorState 'ERROR' "Coordinates are not numeric: $_" $permissionStatus
    return
}

if ([double]::IsNaN($lat) -or [double]::IsInfinity($lat) -or
    $lat -lt -90 -or $lat -gt 90) {
    $script:locationData = $data
    Set-ErrorState 'ERROR' "Invalid latitude value: $lat (must be -90 to 90)" `
        $permissionStatus
    return
}

if ([double]::IsNaN($lon) -or [double]::IsInfinity($lon) -or
    $lon -lt -180 -or $lon -gt 180) {
    $script:locationData = $data
    Set-ErrorState 'ERROR' "Invalid longitude value: $lon (must be -180 to 180)" `
        $permissionStatus
    return
}

# 7. Calculate staleness
$locationStatus = 'UNKNOWN'
$timestampStr   = ''
$ageMinutes     = [double]::NaN

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
Set-RecoveryAttributes $data $script:statusData $locationStatus `
    $script:integrityStatus $ageMinutes
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
