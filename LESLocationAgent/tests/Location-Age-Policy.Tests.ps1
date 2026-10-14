# Test standalone Action1 script functions without Windows or Action1 side effects.
$ErrorActionPreference = 'Stop'
foreach ($name in @('Action1-Location-Sync.ps1', 'Action1-LESLocationAgent-Health.ps1')) {
    $source = Join-Path $PSScriptRoot "../scripts/$name"
    $tokens = $null
    $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
    if ($errors.Count -gt 0) { throw "$name has a PowerShell parse error." }
    $function = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-LocationAgeStatus'
    }, $true)
    if ($null -eq $function) { throw "$name is missing its age classifier." }
    Invoke-Expression $function.Extent.Text
    foreach ($case in @(
        @{ Age = 0; Expected = 'ACTIVE' },
        @{ Age = 59.999; Expected = 'ACTIVE' },
        @{ Age = 60; Expected = 'WARNING' },
        @{ Age = 1439.999; Expected = 'WARNING' },
        @{ Age = 1440; Expected = 'STALE' },
        @{ Age = 4320; Expected = 'STALE' },
        @{ Age = $null; Expected = 'UNKNOWN' },
        @{ Age = -3; Expected = 'UNKNOWN' },
        @{ Age = [double]::NaN; Expected = 'UNKNOWN' },
        @{ Age = [double]::PositiveInfinity; Expected = 'UNKNOWN' }
    )) {
        $actual = Get-LocationAgeStatus -HasCoordinates $true -ReadingAge $case.Age
        if ($actual -ne $case.Expected) { throw "$name at age $($case.Age): expected $($case.Expected), got $actual." }
    }
    if ((Get-LocationAgeStatus -HasCoordinates $false -ReadingAge 3000) -ne 'NO LOCATION') { throw "$name must preserve missing location." }
    Write-Host "$name age boundary/missing/future checks passed."
}
