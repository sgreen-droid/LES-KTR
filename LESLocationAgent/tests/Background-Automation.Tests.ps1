#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$source = Get-Content (Join-Path $PSScriptRoot '../src/LESLocationCollector/Initialize-BackgroundCollector.ps1') -Raw
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw "Background script syntax errors: $errors" }
foreach ($name in @('New-CollectorTaskXml', 'Test-CollectorObservation', 'Read-CollectorObservation')) {
    $function = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if ($null -eq $function) { throw "Missing helper: $name" }
    Invoke-Expression $function.Extent.Text
}
$sid = 'S-1-5-21-100-200-300-1001'
$exe = 'C:\Program Files\LES & School\collector\LESLocationCollector.exe'
[xml]$task = New-CollectorTaskXml $sid $exe 15 ([DateTimeOffset]::Parse('2026-10-14T16:00:00Z'))
if ($task.Task.Principals.Principal.UserId -ne $sid -or
    $task.Task.Principals.Principal.LogonType -ne 'InteractiveToken' -or
    $task.Task.Principals.Principal.RunLevel -ne 'LeastPrivilege' -or
    $task.Task.Actions.Exec.Command -ne $exe -or
    $task.Task.Actions.Exec.Arguments -ne '--once' -or
    $task.Task.Triggers.TimeTrigger.Repetition.Interval -ne 'PT15M') { throw 'Unsafe task identity/action/cadence.' }
foreach ($bad in @('SYSTEM', 'S-1-5-18', 'evil<sid')) {
    $rejected = $false
    try { $null = New-CollectorTaskXml $bad $exe 15 ([DateTimeOffset]::Now) } catch { $rejected = $true }
    if (-not $rejected) { throw 'Invalid/non-user identity accepted.' }
}
$now = [DateTimeOffset]::Parse('2026-10-14T16:00:00Z')
$fixture = Join-Path ([IO.Path]::GetTempPath()) ("les-background-reader-" + [guid]::NewGuid().ToString('N') + '.json')
try {
    '{"timestampUtc":"2026-10-14T16:00:00Z","recordSequence":10,"positionSource":"WiFi"}' |
        Set-Content $fixture -Encoding UTF8
    $parsed = Read-CollectorObservation $fixture
    if ($parsed.timestampUtc -isnot [string] -or $parsed.timestampUtc -ne '2026-10-14T16:00:00Z' -or
        $parsed.recordSequence -ne 10) { throw 'Observation reader lost timestamp text or dictionary properties.' }
} finally { Remove-Item $fixture -ErrorAction SilentlyContinue }
$reading = [pscustomobject]@{ timestampUtc=$now.ToString('o'); recordSequence=10; positionSource='WiFi'; latitude=40; longitude=-74; accuracyMeters=80 }
if (-not (Test-CollectorObservation $reading 9 $now.AddMinutes(-15) $now)) { throw 'Fresh stationary reading was rejected.' }
if (Test-CollectorObservation $reading 9 $now $now) { throw 'Repeated observation was accepted.' }
$reading.timestampUtc = $now.AddHours(-4).ToString('o')
if (Test-CollectorObservation $reading 9 $now.AddDays(-1) $now) { throw 'Old upload was relabeled fresh.' }
$reading.timestampUtc = $now.ToString('o'); $reading.positionSource = 'IPAddress'
if (Test-CollectorObservation $reading 9 $now.AddDays(-1) $now) { throw 'IP estimate accepted.' }
$reading.positionSource = 'WiFi'; $reading.accuracyMeters = [double]::PositiveInfinity
if (Test-CollectorObservation $reading 9 $now.AddDays(-1) $now) { throw 'Nonfinite accuracy accepted.' }
if ($source -match 'HasRunBefore|RequestAccessAsync|GrantLocationConsent|New-ItemProperty|Start-Process') {
    throw 'Background bootstrap must not launch the client or grant consent.'
}
if ($source -notmatch 'Grant-CollectorDataAccess \$sid' -or
    $source -notmatch 'FileSystemRights\]::Modify' -or
    $source -notmatch 'FileAttributes\]::ReparsePoint' -or
    $source -match 'FileSystemRights\]::FullControl|Get-ChildItem.*-Recurse|Remove-Item.*agent-state') {
    throw 'Data access must preserve evidence and grant only narrowly scoped Modify rights.'
}
if ($source -notmatch 'Resolve-CollectorPrincipalSid \$existing\[0\].Principal.UserId' -or
    $source -notmatch 'Translate\(\[Security.Principal.SecurityIdentifier\]\)') {
    throw 'Task identity comparison must resolve account-name principals back to the exact user SID.'
}
$installer = Get-Content (Join-Path $PSScriptRoot '../scripts/Action1-Install-LESLocationAgent.ps1') -Raw
if ($installer -notmatch 'Initialize-BackgroundCollector.ps1' -or $installer -notmatch '-NonInteractive') {
    throw 'Action1 installer must initialize background collection automatically.'
}
Write-Host 'Unattended background task and observation tests passed.'
