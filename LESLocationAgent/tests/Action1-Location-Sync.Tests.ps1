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

    $validLocation = [pscustomobject]@{
        latitude          = 40.839466
        longitude         = -73.859357
        accuracyMeters    = 109
        accuracyQuality   = 'APPROXIMATE'
        locationSource    = 'Windows Geolocation'
        positionSource    = 'WiFi'
        permissionStatus  = 'Allowed'
        timestampUtc      = $timestamp
    }
    $validStatus = [pscustomobject]@{ permissionStatus = 'Allowed' }
    $validLocation | ConvertTo-Json | Set-Content -Path $locationFile -Encoding UTF8
    $validStatus | ConvertTo-Json | Set-Content -Path $statusFile -Encoding UTF8

    $global:LesCapturedAttributes = @{}
    $global:LesOptionalAttributeFailures = @()
    & $scriptPath -LocationFile $locationFile -StatusFile $statusFile

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

    # Missing optional Action1 attributes must not prevent existing values from syncing.
    $global:LesCapturedAttributes = @{}
    $global:LesOptionalAttributeFailures = @(
        'Map Link', 'Location Coordinates', 'Location Summary'
    )
    & $scriptPath -LocationFile $locationFile -StatusFile $statusFile
    foreach ($name in $expectedExisting.Keys) {
        Assert-Equal "Existing attribute after optional failure: $name" `
            $expectedExisting[$name] $global:LesCapturedAttributes[$name]
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
        & $scriptPath -LocationFile $locationFile -StatusFile $statusFile

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
    Remove-Item function:\global:Action1-Set-CustomAttribute -ErrorAction SilentlyContinue
}