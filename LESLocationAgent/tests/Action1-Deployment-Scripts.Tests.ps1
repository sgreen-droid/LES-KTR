# Lightweight static checks for Action1 deployment scripts and release wiring.
# These run on Windows PowerShell in GitHub Actions without downloading an MSI.

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$installerPath = Join-Path $repoRoot 'scripts\Action1-Install-LESLocationAgent.ps1'
$healthPath = Join-Path $repoRoot 'scripts\Action1-LESLocationAgent-Health.ps1'
$workflowPath = Join-Path (Split-Path -Parent $repoRoot) '.github\workflows\windows-build.yml'
$installerPackagePath = Join-Path $repoRoot 'installer\Package.wxs'
$programPath = Join-Path $repoRoot 'src\LESLocationAgent\Program.cs'

function Assert-Contains {
    param([string]$Name, [string]$Text, [string]$Expected)

    if (-not $Text.Contains($Expected)) {
        throw "$Name must contain '$Expected'."
    }
}

$installer = Get-Content $installerPath -Raw -Encoding UTF8
$health = Get-Content $healthPath -Raw -Encoding UTF8
$workflow = Get-Content $workflowPath -Raw -Encoding UTF8
$installerPackage = Get-Content $installerPackagePath -Raw -Encoding UTF8
$program = Get-Content $programPath -Raw -Encoding UTF8

Assert-Contains 'Installer template' $installer "__INSTALLER_URL__"
Assert-Contains 'Installer template' $installer "__INSTALLER_SHA256__"
Assert-Contains 'Installer template' $installer "__INSTALLER_VERSION__"
Assert-Contains 'Installer validation' $installer "InstallerUrl must be an HTTPS URL"
Assert-Contains 'Installer validation' $installer "Integrity verification cannot be skipped"
if ($installer -match 'verification skipped') {
    throw 'Installer script must not contain a hash-verification bypass.'
}

Assert-Contains 'Release workflow' $workflow 'Compute final MSI SHA-256'
Assert-Contains 'Release workflow' $workflow "Replace('__INSTALLER_URL__', `$installerUrl)"
Assert-Contains 'Release workflow' $workflow "Replace('__INSTALLER_SHA256__', `$env:INSTALLER_SHA256)"
Assert-Contains 'Release workflow' $workflow "Replace('__INSTALLER_VERSION__', `$env:INSTALLER_VERSION)"
if ($workflow.IndexOf('Compute final MSI SHA-256') -lt $workflow.IndexOf('Sign MSI (production)')) {
    throw 'Final MSI hash must be calculated after the optional signing step.'
}

foreach ($field in @(
    'Last Heartbeat', 'Device ID', 'Record Sequence', 'Integrity', 'Agent Health'
)) {
    Assert-Contains 'Health script' $health $field
}

if ($installerPackage -match 'LaunchApp') {
    throw 'The MSI must not launch the interactive agent from the installer service context.'
}
[xml]$packageXml = $installerPackage
$customActions = @($packageXml.SelectNodes("//*[local-name()='CustomAction']"))
foreach ($action in $customActions) {
    if ($action.Id -notin @('SetCollectorCleanup', 'CollectorCleanup')) {
        throw 'Only the uninstall-only collector cleanup custom actions are permitted.'
    }
    if ($action.Id -eq 'SetCollectorCleanup' -and
        ($action.Property -ne 'CollectorCleanup' -or
         $action.Value -notlike '*-NonInteractive*-File*Remove-CollectorTasks.ps1*' -or
         $action.Value -like '*LESLocationAgent.exe*')) {
        throw 'Collector cleanup must invoke only its noninteractive uninstall script.'
    }
}
foreach ($entry in $packageXml.SelectNodes("//*[local-name()='InstallExecuteSequence']/*[local-name()='Custom']")) {
    if ($entry.Action -notin @('SetCollectorCleanup', 'CollectorCleanup') -or
        $entry.Condition -ne 'REMOVE="ALL" AND NOT UPGRADINGPRODUCTCODE') {
        throw 'Collector cleanup must be uninstall-only, never an installer-service collection launch.'
    }
}
Assert-Contains 'Application startup guard' $program 'TryAcquireMachineInstanceLock'
Assert-Contains 'Application startup guard' $program 'FileShare.None'

Write-Host 'Action1 deployment script tests passed.'