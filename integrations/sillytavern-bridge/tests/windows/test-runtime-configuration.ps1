param([string]$SourceDirectory = (Join-Path $PSScriptRoot '../../deploy/windows'))

$ErrorActionPreference = 'Stop'
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('lf-runtime-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $sandbox | Out-Null
try {
    foreach ($name in @('cutover-portal.ps1', 'start-bridge.cmd', 'start-sillytavern.cmd')) {
        Copy-Item -LiteralPath (Join-Path $SourceDirectory $name) -Destination $sandbox
    }
    # Stop before any task, runtime or network access, even for matching configuration.
    Set-Content -LiteralPath (Join-Path $sandbox 'apply-sillytavern-hardening.ps1') -Value "throw 'HARDENING_REACHED'"
    $rootA = New-Item -ItemType Directory -Path (Join-Path $sandbox 'a')
    $rootB = New-Item -ItemType Directory -Path (Join-Path $sandbox 'b')
    $cases = @(
        @{ Root = $null; Expected = 'Set LF_ST_ROOT' },
        @{ Root = $rootB.FullName; Expected = 'must match' },
        @{ Root = (Join-Path $rootA.FullName '.'); Expected = 'HARDENING_REACHED' }
    )
    foreach ($case in $cases) {
        $env:LF_ST_ROOT = $case.Root
        $message = ''
        try {
            & (Join-Path $sandbox 'cutover-portal.ps1') -SillyTavernRoot $rootA.FullName -AllowedDeviceIp '127.0.0.1' -OwnerLogin 'owner@example.invalid'
        } catch {
            $message = $_.Exception.Message
        }
        if ($message -notlike "*$($case.Expected)*") {
            throw "Cutover expected '$($case.Expected)', received '$message'."
        }
    }
    $required = @('LF_PORTAL_VAULT_ROOT', 'LF_PORTAL_ST_PUBLIC_URL', 'LF_PORTAL_OWNER_LOGINS')
    foreach ($missing in ($required + 'LF_ST_ROOT')) {
        foreach ($name in $required) { [Environment]::SetEnvironmentVariable($name, 'test-placeholder', 'Process') }
        [Environment]::SetEnvironmentVariable($missing, $null, 'Process')
        $launcher = if ($missing -eq 'LF_ST_ROOT') { 'start-sillytavern.cmd' } else { 'start-bridge.cmd' }
        $logName = if ($missing -eq 'LF_ST_ROOT') { 'sillytavern.log' } else { 'bridge.log' }
        $log = Join-Path $sandbox "logs/$logName"
        if (Test-Path -LiteralPath $log) { Clear-Content -LiteralPath $log }
        & $env:ComSpec /d /c (Join-Path $sandbox $launcher) | Out-Null
        if ($LASTEXITCODE -ne 2) { throw "$launcher did not reject missing $missing with exit code 2." }
        if (-not (Test-Path -LiteralPath $log) -or (Get-Content -LiteralPath $log -Raw) -notlike "*ERROR: Set $missing*") {
            throw "$launcher did not persist the missing $missing diagnostic."
        }
    }
    Write-Output 'PASS: three cutover path cases and four logged launcher configuration failures.'
} finally {
    Remove-Item -LiteralPath $sandbox -Recurse -Force
}
