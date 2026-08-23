$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskDefinitions = @(
    @{
        Name = 'LexiconForge-SillyTavern'
        Launcher = Join-Path $scriptDirectory 'start-sillytavern.cmd'
    },
    @{
        Name = 'LexiconForge-Portal-Bridge'
        Launcher = Join-Path $scriptDirectory 'start-bridge.cmd'
    }
)

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

foreach ($definition in $taskDefinitions) {
    if (-not (Test-Path -LiteralPath $definition.Launcher -PathType Leaf)) {
        throw "Required launcher is missing: $($definition.Launcher)"
    }

    $quotedLauncher = '"' + $definition.Launcher + '"'
    $action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument "/d /c $quotedLauncher"
    Register-ScheduledTask `
        -TaskName $definition.Name `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description 'Tailnet-only LexiconForge self-insert portal runtime.' `
        -Force | Out-Null
    Start-ScheduledTask -TaskName $definition.Name
    Write-Host "Registered and started $($definition.Name) using $($definition.Launcher)"
}
