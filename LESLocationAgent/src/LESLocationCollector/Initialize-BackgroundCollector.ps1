#Requires -Version 5.1
# Run by Action1/installer management context. Orchestrates only; geolocation
# remains in the existing consenting user's limited interactive token.
$ErrorActionPreference = 'Stop'

function New-CollectorTaskXml {
    param([string]$Sid, [string]$Executable, [int]$Minutes, [DateTimeOffset]$Start)
    if ($Sid -notmatch '^S-1-(5-21|12-1)-[0-9-]+$') { throw 'Unsupported user SID.' }
    if ($Minutes -lt 5 -or $Minutes -gt 44640) { throw 'Invalid collection interval.' }
    $exe = [System.Security.SecurityElement]::Escape($Executable)
    $boundary = $Start.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
    return @"
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
 <RegistrationInfo><Description>LES background collection; existing consent only; no client UI.</Description></RegistrationInfo>
 <Triggers>
  <TimeTrigger><Repetition><Interval>PT${Minutes}M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><StartBoundary>$boundary</StartBoundary><Enabled>true</Enabled></TimeTrigger>
  <LogonTrigger><Enabled>true</Enabled><UserId>$Sid</UserId></LogonTrigger>
 </Triggers>
 <Principals><Principal id="Collector"><UserId>$Sid</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
 <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><ExecutionTimeLimit>PT3M</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>2</Count></RestartOnFailure></Settings>
 <Actions Context="Collector"><Exec><Command>$exe</Command><Arguments>--once</Arguments></Exec></Actions>
</Task>
"@
}

function Get-CollectorConsentValue {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    $value = (Get-ItemProperty $Path).PSObject.Properties['Value']
    if ($null -ne $value) { return [string]$value.Value }
    return $null
}

function Test-CollectorObservation {
    param($Reading, [long]$PreviousSequence, [DateTimeOffset]$PreviousTime, [DateTimeOffset]$Now)
    try {
        if ([string]$Reading.timestampUtc -notmatch '(Z|[+-]\d{2}:\d{2})$') { return $false }
        $time = [DateTimeOffset]::Parse([string]$Reading.timestampUtc)
        $accuracy = [double]$Reading.accuracyMeters
        return ([long]$Reading.recordSequence -gt $PreviousSequence -and $time -gt $PreviousTime -and
            $time -ge $Now.AddMinutes(-2) -and $time -le $Now.AddMinutes(2) -and
            [string]$Reading.positionSource -in @('WiFi', 'Satellite', 'Cellular') -and
            [double]$Reading.latitude -ge -90 -and [double]$Reading.latitude -le 90 -and
            [double]$Reading.longitude -ge -180 -and [double]$Reading.longitude -le 180 -and
            -not [double]::IsNaN($accuracy) -and -not [double]::IsInfinity($accuracy) -and $accuracy -gt 0)
    } catch { return $false }
}

function Read-CollectorObservation {
    # Preserve ISO strings in Windows PowerShell and avoid automatic DateTime
    # coercion by newer ConvertFrom-Json implementations.
    param([string]$Path)
    $json = Get-Content $Path -Raw -Encoding UTF8
    if ($PSEdition -eq 'Desktop') {
        Add-Type -AssemblyName System.Web.Extensions
        $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $values = $serializer.DeserializeObject($json)
    } elseif ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) {
        return ConvertFrom-Json $json -DateKind String
    } else {
        $null = ConvertFrom-Json '{}'
        $settings = New-Object Newtonsoft.Json.JsonSerializerSettings
        $settings.DateParseHandling = [Newtonsoft.Json.DateParseHandling]::None
        $values = [Newtonsoft.Json.JsonConvert]::DeserializeObject($json,
            [System.Collections.Generic.Dictionary[string,object]], $settings)
    }
    if ($values -isnot [System.Collections.IDictionary]) { throw 'Observation must be a JSON object.' }
    $properties = @{}
    foreach ($key in $values.Keys) { $properties[$key] = $values[$key] }
    if ($properties['timestampUtc'] -isnot [string]) { throw 'Observation time must retain its ISO string.' }
    return [pscustomobject]$properties
}

function Grant-CollectorDataAccess {
    param([string]$Sid)
    if ($Sid -notmatch '^S-1-(5-21|12-1)-[0-9-]+$') { throw 'Unsupported data-access identity.' }
    $directory = 'C:\ProgramData\LESLocationAgent'
    $null = [IO.Directory]::CreateDirectory($directory)
    # Legacy SYSTEM-created files can be readable but not writable by the
    # consenting interactive user. Preserve all contents and existing rights.
    # Grant Modify only to that SID, never Everyone or all Users, and do not
    # recursively change arbitrary files or follow reparse points.
    $paths = @($directory)
    foreach ($name in @('agent.instance.lock', 'agent-state.json', 'agent-state.json.lock',
        'location.json', 'status.json', 'config.json', 'collector.log', 'startup.log')) {
        $file = Join-Path $directory $name
        if (Test-Path -LiteralPath $file) { $paths += $file }
    }
    foreach ($path in $paths) {
        $item = Get-Item -LiteralPath $path -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Agent data reparse point detected; no permissions were changed.'
        }
    }
    $identity = New-Object Security.Principal.SecurityIdentifier($Sid)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule(
        $identity, [Security.AccessControl.FileSystemRights]::Modify,
        [Security.AccessControl.AccessControlType]::Allow)
    foreach ($path in $paths) {
        $acl = Get-Acl -LiteralPath $path
        $acl.AddAccessRule($rule)
        Set-Acl -LiteralPath $path -AclObject $acl
    }
    Write-Host 'Agent data access prepared for the existing consenting user; identity and location contents preserved.'
}

function Resolve-CollectorPrincipalSid {
    param([string]$Identity)
    if ($Identity -match '^S-1-(5-21|12-1)-[0-9-]+$') { return $Identity }
    if ([string]::IsNullOrWhiteSpace($Identity)) { throw 'Task principal is missing.' }
    # Task Scheduler can return a local account name for a SID-authored task.
    $account = New-Object Security.Principal.NTAccount($Identity)
    return $account.Translate([Security.Principal.SecurityIdentifier]).Value
}

try {
    $exe = 'C:\Program Files\LES Location Agent\collector\LESLocationCollector.exe'
    if (-not (Test-Path $exe)) { throw 'No-UI collector is not installed; Action1 must deploy the new MSI first.' }
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LesBackgroundSession {
 [DllImport("wtsapi32.dll", EntryPoint="WTSQuerySessionInformationW")]
 static extern bool Query(IntPtr server,int session,int kind,out IntPtr buffer,out int size);
 [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr buffer);
 public static bool IsActive(int session) {
  IntPtr buffer; int size;
  if(session==0 || !Query(IntPtr.Zero,session,8,out buffer,out size)) return false;
  try { return size>=4 && Marshal.ReadInt32(buffer)==0; } finally { WTSFreeMemory(buffer); }
 }
}
'@
    $active = @(Get-CimInstance Win32_Process -Filter "Name = 'explorer.exe'" |
        Where-Object { $_.ExecutablePath -eq "$env:SystemRoot\explorer.exe" -and
            [LesBackgroundSession]::IsActive($_.SessionId) })
    $sessions = @($active | Select-Object -ExpandProperty SessionId -Unique)
    if ($sessions.Count -eq 0) {
        Write-Host 'RESULT: DEFERRED_NO_USER - installed startup will collect automatically at user sign-in; no fresh location claimed.'
        exit 0
    }
    if ($sessions.Count -ne 1) { throw 'Multiple active user sessions; no ambiguous collection will be started.' }
    $owner = Invoke-CimMethod $active[0] -MethodName GetOwnerSid
    if ($owner.ReturnValue -ne 0 -or $owner.Sid -notmatch '^S-1-(5-21|12-1)-[0-9-]+$') {
        throw 'Cannot establish the existing interactive user identity.'
    }
    $sid = $owner.Sid
    $path = "Registry::HKEY_USERS\$sid\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location"
    $machine = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location'
    if ((Get-CollectorConsentValue $path) -ne 'Allow' -or
        (Get-CollectorConsentValue "$path\NonPackaged") -eq 'Deny' -or
        (Get-CollectorConsentValue $machine) -eq 'Deny') {
        throw 'BLOCKED_CONSENT - Windows location permission is not already allowed; no prompt or permission change was made.'
    }
    $minutes = 15
    $config = 'C:\ProgramData\LESLocationAgent\config.json'
    if (Test-Path $config) {
        $settings = Get-Content $config -Raw | ConvertFrom-Json
        $refresh = $settings.PSObject.Properties['refreshMinutes']
        if ($null -ne $refresh) { $minutes = [Math]::Max(5, [int]$refresh.Value) }
    }
    $location = 'C:\ProgramData\LESLocationAgent\location.json'
    $previousSequence = 0L
    $previousTime = [DateTimeOffset]::MinValue
    if (Test-Path $location) {
        $previous = Read-CollectorObservation $location
        $previousSequence = [long]$previous.recordSequence
        $previousTime = [DateTimeOffset]::Parse([string]$previous.timestampUtc)
    }
    $service = New-Object -ComObject 'Schedule.Service'
    $service.Connect()
    $root = $service.GetFolder('\')
    $name = "LES Location Collector - $sid"
    # Do not overwrite a differently-owned or unrelated task sharing this name.
    $existing = @(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0 -and (@($existing[0].Actions).Count -ne 1 -or
        $existing[0].Actions[0].Execute -ne $exe -or
        (Resolve-CollectorPrincipalSid $existing[0].Principal.UserId) -ne $sid -or
        $existing[0].Principal.LogonType -ne 'Interactive' -or
        $existing[0].Principal.RunLevel -ne 'Limited' -or
        $existing[0].Actions[0].Arguments -notin @('', '--once'))) {
        throw 'Existing task has unexpected identity/action; no task was replaced.'
    }
    Grant-CollectorDataAccess $sid
    $xml = New-CollectorTaskXml $sid $exe $minutes ([DateTimeOffset]::Now.AddMinutes(1))
    # Rights apply only to this user's app task, not to other tasks or roles.
    # Own-user full control permits later non-elevated sign-in refresh.
    $sddl = "D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;$sid)"
    $task = $root.RegisterTask($name, $xml, 6, $sid, $null, 3, $sddl)
    $startup = "Registry::HKEY_USERS\$sid\Software\Microsoft\Windows\CurrentVersion\Run"
    if (Test-Path $startup) {
        $legacy = (Get-ItemProperty $startup).PSObject.Properties['LESLocationAgent']
        if ($null -ne $legacy -and $legacy.Value -eq '"C:\Program Files\LES Location Agent\LESLocationAgent.exe" --startup') {
            Remove-ItemProperty $startup -Name 'LESLocationAgent'
        }
    }
    $started = [DateTime]::Now
    $null = $task.Run($null)
    Write-Host "Background task started; session $($sessions[0]); cadence $minutes minutes; no client launch."
    $deadline = [DateTime]::Now.AddMinutes(3)
    do {
        Start-Sleep -Seconds 3
        $task = $root.GetTask($name)
        if ($task.LastRunTime -ge $started.AddSeconds(-1) -and $task.State -ne 4) {
            if ($task.LastTaskResult -ne 0) {
                throw "Collector returned $($task.LastTaskResult); no fresh location claimed. Inspect collector.log/status.json."
            }
            $reading = Read-CollectorObservation $location
            if (-not (Test-CollectorObservation $reading $previousSequence $previousTime ([DateTimeOffset]::UtcNow))) {
                throw 'Job finished without a new physical observation; saved coordinates were not relabeled fresh.'
            }
            Write-Host 'RESULT: NEW_PHYSICAL_OBSERVATION - unattended collection verified; recurring task remains enabled.'
            exit 0
        }
    } while ([DateTime]::Now -lt $deadline)
    throw 'Timed out waiting for background collection; task is retained, but no fresh location is claimed.'
} catch {
    Write-Host "RESULT: BACKGROUND_START_BLOCKED - $($_.Exception.Message)"
    exit 1
}
