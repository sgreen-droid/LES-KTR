#Requires -Version 5.1
# Uninstall only: remove tasks whose sole action is this installed collector.
$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot 'LESLocationCollector.exe'
$tasks = @(Get-ScheduledTask -TaskName 'LES Location Collector -*' -ErrorAction SilentlyContinue)
foreach ($task in $tasks) {
    $actions = @($task.Actions)
    if ($actions.Count -eq 1 -and $actions[0].Execute -eq $exe) {
        if ($task.State -eq 'Running') {
            Stop-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath
        }
        Unregister-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Confirm:$false
    }
}
