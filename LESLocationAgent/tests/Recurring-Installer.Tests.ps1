#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot '../scripts/Action1-Install-LESLocationAgent.ps1'
$text = Get-Content $path -Raw -Encoding UTF8
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw 'Recurring installer does not parse.' }
$helper = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-InstallationCurrent' }, $true)
if ($null -eq $helper) { throw 'Missing repeat-install guard.' }
Invoke-Expression $helper.Extent.Text
$target = [version]'1.1.10.0'
foreach ($case in @(
    @('1.1.9.0', '1.1.9.0', $true, $false),
    @('1.1.10.0', '1.1.10.0', $true, $true),
    @('1.1.11.0', '1.1.11.0', $true, $true),
    @('1.1.10.0', '1.1.9.0', $true, $false),
    @('1.1.10.0', '1.1.10.0', $false, $false),
    @('', '', $false, $false),
    @('bad', '1.1.10.0', $true, $false)
)) {
    if ((Test-InstallationCurrent $target $case[0] $case[1] $case[2]) -ne $case[3]) {
        throw 'Repeated execution version/file guard failed.'
    }
}
if ($text.IndexOf('if (-not $alreadyCurrent)') -gt $text.IndexOf('Invoke-WebRequest') -or
    $text -notmatch 'ALREADY_CURRENT' -or $text -notmatch 'refusing to downgrade' -or
    $text -notmatch 'SKIPPED_UNSUPPORTED' -or $text -notmatch '/norestart' -or
    $text -match '/forcerestart') { throw 'Recurring rollout must skip current/unsupported versions and never request a reboot.' }
Write-Host 'Recurring installer version, repair, platform, and reboot guards passed.'
