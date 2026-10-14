#Requires -Version 5.1
# A named-computer pilot, not a fleet repair. Dry-run unless explicitly enabled.
# No consent, role, service, permission, location-record or reboot changes.
$ExpectedComputer = '__REPAIR_TARGET__'
$PerformRepair = $false
$ErrorActionPreference = 'Stop'
function Test-NewPhysicalObservation {
    param($Reading, [Int64]$PreviousSequence, [DateTimeOffset]$PreviousTime,
          [DateTimeOffset]$Started, [DateTimeOffset]$Now)
    try {
        foreach ($field in @('timestampUtc','recordSequence','positionSource','accuracyMeters','latitude','longitude')) {
            if ($null -eq $Reading.PSObject.Properties[$field] -or $null -eq $Reading.$field) { return $false }
        }
        if ([string]$Reading.timestampUtc -notmatch '(Z|[+-]\d{2}:\d{2})$') { return $false }
        $observed = [DateTimeOffset]::Parse([string]$Reading.timestampUtc)
        $accuracy = [double]$Reading.accuracyMeters
        $lat = [double]$Reading.latitude; $lon = [double]$Reading.longitude
        return ([Int64]$Reading.recordSequence -gt $PreviousSequence -and $observed -gt $PreviousTime -and
            $observed -ge $Started.AddMinutes(-2) -and $observed -le $Now.AddMinutes(2) -and
            [string]$Reading.positionSource -in @('WiFi','Satellite','Cellular') -and
            -not [double]::IsNaN($accuracy) -and -not [double]::IsInfinity($accuracy) -and $accuracy -gt 0 -and
            -not [double]::IsNaN($lat) -and -not [double]::IsInfinity($lat) -and
            -not [double]::IsNaN($lon) -and -not [double]::IsInfinity($lon) -and
            $lat -ge -90 -and $lat -le 90 -and $lon -ge -180 -and $lon -le 180)
    } catch { return $false }
}
function Read-LocationRecord {
    param([string]$Path = 'C:\ProgramData\LESLocationAgent\location.json')
    $json = Get-Content $Path -Raw -Encoding UTF8
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { return ConvertFrom-Json $json -DateKind String }
    # Avoid implicit date conversion in older hosts. Never format a coerced
    # DateTime back into a guessed UTC string: preserve the decoded JSON text.
    if ($PSEdition -eq 'Desktop') {
        Add-Type -AssemblyName System.Web.Extensions
        $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $values = $serializer.DeserializeObject($json)
    } else {
        # PowerShell Core before -DateKind ships Newtonsoft.Json.
        $null = ConvertFrom-Json '{}'
        $settings = New-Object Newtonsoft.Json.JsonSerializerSettings
        $settings.DateParseHandling = [Newtonsoft.Json.DateParseHandling]::None
        $values = [Newtonsoft.Json.JsonConvert]::DeserializeObject($json,
            [System.Collections.Generic.Dictionary[string,object]], $settings)
    }
    if ($values -isnot [System.Collections.IDictionary]) { throw 'Location record must be a JSON object.' }
    $properties = @{}
    foreach ($key in $values.Keys) { $properties[$key] = $values[$key] }
    if ($properties['timestampUtc'] -isnot [string]) { throw 'Observation timestamp must be JSON text.' }
    return [pscustomobject]$properties
}
function Get-RegistryValue($Path, $Name) {
    if (-not (Test-Path $Path)) { return $null }
    $property = (Get-ItemProperty $Path).PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}
try {
    if ($ExpectedComputer -eq '__REPAIR_TARGET__' -or $env:COMPUTERNAME -ne $ExpectedComputer) {
        throw 'Explicit repair target does not match this computer.'
    }
    $exe = 'C:\Program Files\LES Location Agent\LESLocationAgent.exe'
    $collector = 'C:\Program Files\LES Location Agent\collector\LESLocationCollector.exe'
    $background = Test-Path $collector
    if ($background) { $exe = $collector }
    if (-not (Test-Path $exe)) { throw 'Agent is not installed.' }
    if (@(Get-CimInstance Win32_Process -Filter "Name = 'LESLocationAgent.exe' OR Name = 'LESLocationCollector.exe'").Count -gt 0) {
        throw 'Agent already exists; this pilot never kills or replaces a process.'
    }
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LesRepairSession {
 [DllImport("wtsapi32.dll", EntryPoint="WTSQuerySessionInformationW", SetLastError=true)]
 static extern bool Query(IntPtr server,int session,int kind,out IntPtr buffer,out int size);
 [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr buffer);
 public static bool IsActive(int session) {
  IntPtr buffer; int size;
  if(!Query(IntPtr.Zero,session,8,out buffer,out size)) return false;
  try { return size >= 4 && Marshal.ReadInt32(buffer)==0; } finally { WTSFreeMemory(buffer); }
 }
}
'@
    $explorers = @(Get-CimInstance Win32_Process -Filter "Name = 'explorer.exe'" | Where-Object { $_.SessionId -gt 0 })
    $active = @($explorers | Where-Object { [LesRepairSession]::IsActive($_.SessionId) })
    if ($active.Count -ne 1) { throw 'Exactly one active desktop session is required.' }
    $session = $active[0].SessionId
    $owner = Invoke-CimMethod $active[0] -MethodName GetOwnerSid
    if ($owner.ReturnValue -ne 0 -or $owner.Sid -notmatch '^S-1-5-21-[\d-]+$') { throw 'Cannot establish authorized user identity.' }
    $sid = $owner.Sid
    foreach ($other in $explorers | Where-Object { $_.SessionId -ne $session }) {
        if ((Invoke-CimMethod $other -MethodName GetOwnerSid).Sid -eq $sid) { throw 'User has multiple sessions; refusing ambiguous launch.' }
    }
    $hive = "Registry::HKEY_USERS\$sid"
    $consent = Get-RegistryValue "$hive\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location" 'Value'
    if ($consent -ne 'Allow') { throw 'User consent is not already Allow. No consent change will be attempted.' }
    if (-not $background -and (Get-RegistryValue "$hive\Software\LES\LESLocationAgent" 'HasRunBefore') -ne 1) {
        throw 'First-launch completion is not recorded for this user; an attended launch is required.'
    }
    $baseline = Read-LocationRecord
    if ([string]$baseline.timestampUtc -notmatch '(Z|[+-]\d{2}:\d{2})$') {
        throw 'Baseline observation has no reliable timezone; historical evidence will not be shifted.'
    }
    $oldTime = [DateTimeOffset]::Parse([string]$baseline.timestampUtc)
    $oldSequence = [Int64]$baseline.recordSequence
    Write-Host "Computer: $env:COMPUTERNAME; authorized active session: $session"
    Write-Host "Consent: already Allow; no-UI collector available: $background"
    Write-Host "Baseline observation UTC: $($oldTime.ToUniversalTime().ToString('o')); sequence: $oldSequence"
    Write-Host "Windows Location Services: $((Get-Service lfsvc).Status)"
    if (-not $PerformRepair) { Write-Host 'RESULT: PREFLIGHT ONLY; no changes made'; exit 0 }
    $started = [DateTimeOffset]::UtcNow
    $taskName = "LES-Location-Pilot-$([Guid]::NewGuid().ToString('N'))"
    try {
        $principal = New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
        $action = if ($background) { New-ScheduledTaskAction -Execute $exe }
            else { New-ScheduledTaskAction -Execute $exe -Argument '--startup' }
        $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName $taskName -Principal $principal -Action $action -Settings $settings | Out-Null
        Start-ScheduledTask -TaskName $taskName
        $deadline = [DateTimeOffset]::UtcNow.AddSeconds(100)
        $fresh = $false
        do {
            Start-Sleep -Seconds 5
            $process = @(Get-CimInstance Win32_Process -Filter "Name = 'LESLocationAgent.exe' OR Name = 'LESLocationCollector.exe'")
            if (@($process | Where-Object { $_.SessionId -ne $session }).Count -gt 0) {
                throw 'Unexpected agent session; inspect manually. No process will be killed.'
            }
            try {
                $reading = Read-LocationRecord
                $fresh = Test-NewPhysicalObservation $reading $oldSequence $oldTime $started ([DateTimeOffset]::UtcNow)
            } catch { $fresh = $false }
        } while (-not $fresh -and [DateTimeOffset]::UtcNow -lt $deadline)
    } finally {
        if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        }
    }
    Start-Sleep -Seconds 3
    $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'LESLocationAgent.exe'" | Where-Object { $_.SessionId -eq $session })
    if ($background) {
        $scheduled = Get-ScheduledTask -TaskName "LES Location Collector - $sid" -ErrorAction Stop
        if (-not $fresh -or -not $scheduled.Settings.Enabled -or
            @($scheduled.Actions).Count -ne 1 -or $scheduled.Actions[0].Execute -ne $exe -or
            $scheduled.Principal.LogonType -ne 'Interactive') {
            throw 'Fresh observation and authorized background schedule were not both verified.'
        }
    } elseif (-not $fresh -or $remaining.Count -ne 1) { throw 'Fresh observation and surviving interactive agent were not both verified.' }
    Write-Host "New observation UTC: $($reading.timestampUtc); sequence: $($reading.recordSequence); source: $($reading.positionSource)"
    Write-Host 'RESULT: NEW PHYSICAL OBSERVATION; collection ownership verified; temporary bootstrap task removed'
    Write-Host 'Coordinates may be unchanged. This is a new observation, not proof of movement.'
} catch {
    Write-Host "RESULT: BLOCKED OR UNVERIFIED; $($_.Exception.Message)"
    exit 1
}
