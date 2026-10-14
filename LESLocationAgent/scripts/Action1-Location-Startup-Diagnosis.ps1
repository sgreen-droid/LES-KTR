#Requires -Version 5.1
# Read-only: no registry changes, process launches, permission changes or reboots.
$ErrorActionPreference = 'Continue'
Write-Host '=== LES Location Agent Startup Diagnosis ==='
Write-Host "Computer: $env:COMPUTERNAME"
Write-Host "Time: $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
function Write-SafeText([string]$Text) {
    $safe = $Text -replace '(?i)C:\\Users\\[^\\\s]+', 'C:\Users\[redacted]'
    Write-Host $safe
}
$explorers = @(Get-CimInstance Win32_Process -Filter "Name = 'explorer.exe'" -ErrorAction SilentlyContinue)
Write-Host "Explorer session IDs: $(($explorers | Select-Object -ExpandProperty SessionId -Unique) -join ',')"
$command = Get-ItemPropertyValue 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' 'LESLocationAgent' -ErrorAction SilentlyContinue
Write-SafeText "Machine startup command: $command"
$approvedRoots = @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run32')
$loadedHives = @(Get-ChildItem 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^S-1-5-21-[\d-]+$' })
foreach ($hive in $loadedHives) {
    $approvedRoots += "Registry::$($hive.Name)\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
}
$found = 0
foreach ($root in $approvedRoots) {
    # Query the key, then inspect the optional property without invoking the
    # Get-ItemPropertyValue missing-property exception that Action1 logs as Error.
    if (-not (Test-Path $root)) { continue }
    $properties = Get-ItemProperty $root -ErrorAction SilentlyContinue
    $property = if ($null -ne $properties) { $properties.PSObject.Properties['LESLocationAgent'] } else { $null }
    $state = if ($null -ne $property) { $property.Value } else { $null }
    if ($null -ne $state -and $state.Length -gt 0) {
        $found++
        Write-Host "Startup approval record $found first byte: $($state[0])"
    }
}
Write-Host "Startup approval records found: $found"
$log = 'C:\ProgramData\LESLocationAgent\startup.log'
if (Test-Path $log) {
    Write-Host "Startup log modified UTC: $((Get-Item $log).LastWriteTimeUtc.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    Write-Host '--- Last 35 startup log lines ---'
    foreach ($line in Get-Content $log -Tail 35 -ErrorAction SilentlyContinue) { Write-SafeText $line }
} else { Write-Host 'Startup log: MISSING' }
Write-Host '--- Matching Windows application errors in last 21 days ---'
$events = @(Get-WinEvent -FilterHashtable @{
    LogName = 'Application'; ProviderName = @('.NET Runtime', 'Application Error')
    StartTime = (Get-Date).AddDays(-21)
} -MaxEvents 100 -ErrorAction SilentlyContinue | Where-Object { $_.Message -match 'LESLocationAgent' } | Select-Object -First 3)
foreach ($event in $events) {
    Write-Host "Event $($event.Id) UTC: $($event.TimeCreated.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    Write-SafeText ($event.Message.Substring(0, [Math]::Min(2200, $event.Message.Length)))
}
Write-Host "Matching errors found in sampled events: $($events.Count)"
exit 0
