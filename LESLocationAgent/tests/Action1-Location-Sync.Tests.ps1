# Lightweight PowerShell test for Action1-Location-Sync.ps1.
# Runs in GitHub Actions without Action1 by mocking its custom-attribute cmdlet.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\scripts\Action1-Location-Sync.ps1'
$tempDir = Join-Path $env:TEMP "LESLocationSyncTest-$([Guid]::NewGuid().ToString('N'))"
$locationFile = Join-Path $tempDir 'location.json'
$statusFile = Join-Path $tempDir 'status.json'
$stateFile = Join-Path $tempDir 'agent-state.json'

function global:Action1-Set-CustomAttribute {
    param([string]$Name, [string]$Value)
    if ($global:LesOptionalAttributeFailures -contains $Name) {
        throw "Simulated Action1 failure for optional attribute '$Name'."
    }
    $global:LesCapturedAttributes[$Name] = $Value
}

function Assert-Equal {
    param([string]$Name, [string]$Expected, [string]$Actual)
    if ($Expected -ne $Actual) {
        throw "$Name expected '$Expected' but was '$Actual'."
    }
}

try {
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    $timestamp = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    $deviceId = 'd2719f71-a1cb-4ae2-b2fb-4ee88a008620'
    [byte[]]$integrityKeyBytes = 0..31
    $integrityKey = [Convert]::ToBase64String($integrityKeyBytes)
    $latBits = [BitConverter]::ToString(
        [BitConverter]::GetBytes([double]40.839466)).Replace('-', '')
    $lonBits = [BitConverter]::ToString(
        [BitConverter]::GetBytes([double]-73.859357)).Replace('-', '')
    $accuracyBits = [BitConverter]::ToString(
        [BitConverter]::GetBytes([double]109)).Replace('-', '')
    $integrityPayload = "$deviceId|7|$timestamp|$latBits|$lonBits|$accuracyBits|Allowed|1.1.1"
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($integrityKeyBytes)
    try {
        $integrityHmac = [BitConverter]::ToString(
            $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($integrityPayload))
        ).Replace('-', '')
    } finally {
        $hmac.Dispose()
    }

    $validLocation = [pscustomobject]@{
        latitude          = 40.839466
        longitude         = -73.859357
        accuracyMeters    = 109
        accuracyQuality   = 'APPROXIMATE'
        locationSource    = 'Windows Geolocation'
        positionSource    = 'WiFi'
        permissionStatus  = 'Allowed'
        timestampUtc      = $timestamp
        deviceId          = $deviceId
        recordSequence    = 7
        agentVersion      = '1.1.1'
        integrityAlgorithm= 'HMAC-SHA256-IEEE754LE'
        integrityHmac     = $integrityHmac
    }
    $validStatus = [pscustomobject]@{
        permissionStatus = 'Allowed'
        lastAttemptUtc = $timestamp
        lastSuccessUtc = $timestamp
        agentHealth = 'HEALTHY'
    }
    $identityState = [pscustomobject]@{
        deviceId = $deviceId
        integrityKey = $integrityKey
    }
    $validLocation | ConvertTo-Json | Set-Content -Path $locationFile -Encoding UTF8
    $validStatus | ConvertTo-Json | Set-Content -Path $statusFile -Encoding UTF8
    $identityState | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8

    $global:LesCapturedAttributes = @{}
    $global:LesOptionalAttributeFailures = @()
    $env:LES_LOCATION_AGENT_LOCATION_FILE = $locationFile
    $env:LES_LOCATION_AGENT_STATUS_FILE = $statusFile
    $env:LES_LOCATION_AGENT_STATE_FILE = $stateFile
    & $scriptPath

    $expectedExisting = @{
        'Latitude'            = '40.839466'
        'Longitude'           = '-73.859357'
        'Location Accuracy'   = '109'
        'Location Quality'    = 'APPROXIMATE'
        'Location Source'     = 'Windows Geolocation'
        'Position Source'     = 'WiFi'
        'Location Permission' = 'Allowed'
        'Location Updated'    = $timestamp
        'Location Status'     = 'ACTIVE'
    }
    foreach ($name in $expectedExisting.Keys) {
        Assert-Equal $name $expectedExisting[$name] $global:LesCapturedAttributes[$name]
    }

    Assert-Equal 'Map Link' `
        'https://www.google.com/maps/search/?api=1&query=40.839466,-73.859357' `
        $global:LesCapturedAttributes['Map Link']
    Assert-Equal 'Location Coordinates' '40.839466, -73.859357' `
        $global:LesCapturedAttributes['Location Coordinates']
    Assert-Equal 'Location Summary' '40.839466, -73.859357 | ±109 m | WiFi | ACTIVE' `
        $global:LesCapturedAttributes['Location Summary']
    Assert-Equal 'Device ID' $deviceId $global:LesCapturedAttributes['Device ID']
    Assert-Equal 'Location Sequence' '7' $global:LesCapturedAttributes['Location Sequence']
    Assert-Equal 'Location Integrity' 'VALID' $global:LesCapturedAttributes['Location Integrity']
    Assert-Equal 'Agent Health' 'HEALTHY' $global:LesCapturedAttributes['Agent Health']
    Assert-Equal 'Agent Version' '1.1.1' $global:LesCapturedAttributes['Agent Version']
    Assert-Equal 'Last Attempt' $timestamp $global:LesCapturedAttributes['Last Attempt']
    Assert-Equal 'Last Success' $timestamp $global:LesCapturedAttributes['Last Success']
    Assert-Equal 'Recovery Status' 'ACTIVE' $global:LesCapturedAttributes['Recovery Status']

    # Missing optional Action1 attributes must not prevent existing values from syncing.
    $global:LesCapturedAttributes = @{}
    $global:LesOptionalAttributeFailures = @(
        'Map Link', 'Location Coordinates', 'Location Summary'
    )
    & $scriptPath
    foreach ($name in $expectedExisting.Keys) {
        Assert-Equal "Existing attribute after optional failure: $name" `
            $expectedExisting[$name] $global:LesCapturedAttributes[$name]
    }

    # A signed record that is changed after writing must be visible as untrusted
    # and must never create a map link.
    $tamperedLocation = [pscustomobject]@{
        latitude          = 41.000000
        longitude         = -73.859357
        accuracyMeters    = 109
        accuracyQuality   = 'APPROXIMATE'
        locationSource    = 'Windows Geolocation'
        positionSource    = 'WiFi'
        permissionStatus  = 'Allowed'
        timestampUtc      = $timestamp
        deviceId          = $deviceId
        recordSequence    = 7
        agentVersion      = '1.1.1'
        integrityAlgorithm= 'HMAC-SHA256-IEEE754LE'
        integrityHmac     = $integrityHmac
    }
    $tamperedLocation | ConvertTo-Json | Set-Content -Path $locationFile -Encoding UTF8
    $global:LesCapturedAttributes = @{}
    $global:LesOptionalAttributeFailures = @()
    & $scriptPath
    Assert-Equal 'Location Status after integrity failure' 'ERROR' `
        $global:LesCapturedAttributes['Location Status']
    Assert-Equal 'Location Integrity after tampering' 'INVALID' `
        $global:LesCapturedAttributes['Location Integrity']
    Assert-Equal 'Agent Health after tampering' 'INTEGRITY FAILED' `
        $global:LesCapturedAttributes['Agent Health']
    if ($global:LesCapturedAttributes.ContainsKey('Map Link') -or
        $global:LesCapturedAttributes.ContainsKey('Location Coordinates') -or
        $global:LesCapturedAttributes.ContainsKey('Location Summary')) {
        throw 'An integrity failure must not update map-related attributes.'
    }

    # Tampering that also makes a coordinate invalid must be distinguished from
    # a normal bad reading: it is an integrity failure, not merely ERROR input.
    $signedInvalidRecords = @(
        @{ Label = 'out-of-range signed latitude'; Latitude = 91; Longitude = -73.859357 },
        @{ Label = 'nonnumeric signed latitude'; Latitude = 'not-a-coordinate'; Longitude = -73.859357 }
    )
    foreach ($invalid in $signedInvalidRecords) {
        $signedInvalidLocation = [pscustomobject]@{
            latitude          = $invalid.Latitude
            longitude         = $invalid.Longitude
            accuracyMeters    = 109
            accuracyQuality   = 'APPROXIMATE'
            locationSource    = 'Windows Geolocation'
            positionSource    = 'WiFi'
            permissionStatus  = 'Allowed'
            timestampUtc      = $timestamp
            deviceId          = $deviceId
            recordSequence    = 7
            agentVersion      = '1.1.1'
            integrityAlgorithm= 'HMAC-SHA256-IEEE754LE'
            integrityHmac     = $integrityHmac
        }
        $signedInvalidLocation | ConvertTo-Json | Set-Content -Path $locationFile -Encoding UTF8
        $global:LesCapturedAttributes = @{}
        $global:LesOptionalAttributeFailures = @()
        & $scriptPath

        Assert-Equal "Location Integrity after $($invalid.Label)" 'INVALID' `
            $global:LesCapturedAttributes['Location Integrity']
        Assert-Equal "Recovery Status after $($invalid.Label)" 'ERROR' `
            $global:LesCapturedAttributes['Recovery Status']
        if ($global:LesCapturedAttributes.ContainsKey('Map Link') -or
            $global:LesCapturedAttributes.ContainsKey('Location Coordinates') -or
            $global:LesCapturedAttributes.ContainsKey('Location Summary')) {
            throw "$($invalid.Label) must not update map-related attributes."
        }
    }

    # Invalid numeric, NaN, and infinite coordinates must never set map fields.
    $invalidCoordinates = @(
        @{ Label = 'out-of-range latitude'; Latitude = 91; Longitude = -73.859357 },
        @{ Label = 'NaN latitude'; Latitude = 'NaN'; Longitude = -73.859357 },
        @{ Label = 'infinite longitude'; Latitude = 40.839466; Longitude = 'Infinity' }
    )
    foreach ($invalid in $invalidCoordinates) {
        $invalidLocation = [pscustomobject]@{
            latitude = $invalid.Latitude
            longitude = $invalid.Longitude
            timestampUtc = $timestamp
        }
        $invalidLocation | ConvertTo-Json | Set-Content -Path $locationFile -Encoding UTF8
        $global:LesCapturedAttributes = @{}
        $global:LesOptionalAttributeFailures = @()
        & $scriptPath

        if ($global:LesCapturedAttributes.ContainsKey('Map Link') -or
            $global:LesCapturedAttributes.ContainsKey('Location Coordinates') -or
            $global:LesCapturedAttributes.ContainsKey('Location Summary')) {
            throw "$($invalid.Label) must not update map-related attributes."
        }
        Assert-Equal "Location Status after $($invalid.Label)" 'ERROR' `
            $global:LesCapturedAttributes['Location Status']
    }

    Write-Host 'Action1 location sync tests passed.'
}
finally {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Variable -Name LesCapturedAttributes -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable -Name LesOptionalAttributeFailures -Scope Global -ErrorAction SilentlyContinue
    Remove-Item Env:\LES_LOCATION_AGENT_LOCATION_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:\LES_LOCATION_AGENT_STATUS_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:\LES_LOCATION_AGENT_STATE_FILE -ErrorAction SilentlyContinue
    Remove-Item function:\global:Action1-Set-CustomAttribute -ErrorAction SilentlyContinue
}