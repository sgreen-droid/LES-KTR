# Read-only health classification checks: no Windows probes or endpoint mutations.
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$source = Join-Path $PSScriptRoot '..\scripts\Action1-LESLocationAgent-Health.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw 'Health script must parse without errors.' }
# Action1 can embed script text after its own setup statements. Top-level param
# then becomes an invalid command instead of a parameter declaration. Test-only
# switches must never be shipped in the automation body.
if ($null -ne $ast.ParamBlock) { throw 'Action1 health body must not have a top-level parameter block.' }
foreach ($function in $ast.FindAll({
    param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
}, $true)) { Invoke-Expression $function.Extent.Text }
function Assert-Equal($Expected, $Actual) {
    if ($Expected -ne $Actual) { throw "Expected '$Expected', received '$Actual'." }
}
$now = [DateTimeOffset]::Parse('2026-10-08T17:00:00Z')
Assert-Equal 15 (Get-HealthAgeMinutes '2026-10-08T12:45:00-04:00' $now)
foreach ($invalid in @('', 'bad', '2026-10-08T16:45:00')) {
    if ($null -ne (Get-HealthAgeMinutes $invalid $now)) { throw 'Invalid time must remain unknown.' }
}
$args = @{
    Installed = $true; ProcessState = 'RUNNING'; Permission = 'Allowed'
    Integrity = 'VALID'; AttemptStatus = 'Success'; PositionSource = 'WiFi'
    HasCoordinates = $true; ReadingAge = 10; AttemptAge = 10; RefreshMinutes = 15
}
Assert-Equal 'RECENT LOCATION READING' (Get-HealthDiagnosis @args)
$args.ReadingAge = 100
$args.AttemptAge = 100
Assert-Equal 'NO RECENT AGENT ATTEMPT' (Get-HealthDiagnosis @args)
$args.ProcessState = 'NOT RUNNING'
Assert-Equal 'INTERACTIVE AGENT NOT RUNNING' (Get-HealthDiagnosis @args)
$args.ProcessState = 'SESSION ZERO ONLY'
Assert-Equal 'AGENT IN NON-INTERACTIVE SESSION' (Get-HealthDiagnosis @args)
$args.ProcessState = 'RUNNING'
$args.AttemptAge = 5
$args.AttemptStatus = 'TimedOut'
Assert-Equal 'LOCATION REQUESTS TIMING OUT' (Get-HealthDiagnosis @args)
$args.AttemptStatus = 'UntrustedSource'
Assert-Equal 'IP-ONLY LOCATION REJECTED' (Get-HealthDiagnosis @args)
$args.ReadingAge = -10
Assert-Equal 'INVALID LOCATION TIME' (Get-HealthDiagnosis @args)
$args.ReadingAge = $null
$args.AttemptStatus = 'Success'
Assert-Equal 'LOCATION TIME UNAVAILABLE' (Get-HealthDiagnosis @args)
$args.Permission = 'Denied'
Assert-Equal 'PERMISSION DENIED' (Get-HealthDiagnosis @args)
$args.Permission = 'Allowed'
$args.ProcessState = 'NOT RUNNING'
$args.ReadingAge = 10
$args.AttemptAge = 10
Assert-Equal 'RECENT LOCATION READING' (Get-HealthDiagnosis @args -BackgroundHealthy $true -CollectorInstalled $true)
Assert-Equal 'BACKGROUND COLLECTION NOT CURRENT' (Get-HealthDiagnosis @args -BackgroundHealthy $false -CollectorInstalled $true)
Write-Host 'Action1 read-only health tests passed.'
