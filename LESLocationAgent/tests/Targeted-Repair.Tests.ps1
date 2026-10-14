#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$path = Join-Path $PSScriptRoot '..\scripts\Action1-Location-Targeted-Repair.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0 -or $null -ne $ast.ParamBlock) { throw 'Embedded repair body must parse without a top-level param block.' }
$function = $ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-NewPhysicalObservation'}, $true)
Invoke-Expression $function.Extent.Text
$reader = $ast.Find({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-LocationRecord'}, $true)
Invoke-Expression $reader.Extent.Text
$now = [DateTimeOffset]::Parse('2026-10-14T15:00:00Z')
$old = $now.AddDays(-16)
$reading = [pscustomobject]@{ timestampUtc='2026-10-14T14:59:30Z';recordSequence=3
    positionSource='WiFi';accuracyMeters=80;latitude=40;longitude=-74 }
if (-not (Test-NewPhysicalObservation $reading 2 $old $now $now)) { throw 'Fresh observation at unchanged coordinates must be accepted.' }
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) "LES-location-fixture-$([Guid]::NewGuid().ToString('N')).json"
try {
    foreach ($timestamp in @('2026-10-14T14:59:30Z','2026-10-14T10:59:30-04:00')) {
        $json = '{"timestampUtc":"' + $timestamp + '","recordSequence":3,"positionSource":"WiFi","accuracyMeters":80,"latitude":40,"longitude":-74}'
        [System.IO.File]::WriteAllText($fixture, $json, [System.Text.UTF8Encoding]::new($false))
        $fromFile = Read-LocationRecord -Path $fixture
        if ($fromFile.timestampUtc -isnot [string] -or $fromFile.timestampUtc -cne $timestamp) {
            throw 'File reader must preserve the original observation timestamp text and offset.'
        }
        if (-not (Test-NewPhysicalObservation $fromFile 2 $old $now $now)) { throw 'Fresh file observation was not accepted.' }
    }
    [System.IO.File]::WriteAllText($fixture, '{"timestampUtc":"2026-09-28T14:59:30Z","recordSequence":99,"positionSource":"WiFi","accuracyMeters":80,"latitude":40,"longitude":-74}')
    if (Test-NewPhysicalObservation (Read-LocationRecord -Path $fixture) 2 $old $now $now) {
        throw 'A freshly read/uploaded file containing an old observation must not become fresh.'
    }
} finally { if (Test-Path $fixture) { Remove-Item $fixture -Force } }
foreach ($test in @(
    @{property='timestampUtc';value='2026-09-28T14:59:30Z'},
    @{property='timestampUtc';value='2026-10-14T15:10:00Z'},
    @{property='timestampUtc';value='2026-10-14T14:59:30'},
    @{property='recordSequence';value=2},
    @{property='positionSource';value='IPAddress'},
    @{property='positionSource';value='Unknown'},
    @{property='accuracyMeters';value=[double]::NaN},
    @{property='latitude';value=100},
    @{property='latitude';value=$null}
)) {
    $copy = $reading.PSObject.Copy()
    $copy.($test.property) = $test.value
    if (Test-NewPhysicalObservation $copy 2 $old $now $now) { throw "Unsafe proof accepted: $($test.property)" }
}
$text = Get-Content $path -Raw
if ($text -notmatch '\$PerformRepair = \$false' -or $text -notmatch '-LogonType Interactive -RunLevel Limited' -or
    $text -match '\b(Stop-Process|Set-ItemProperty|New-ItemProperty|Restart-Computer)\b') { throw 'Repair safety guard regression.' }
Write-Host 'Targeted repair proof and safety guards passed.'
