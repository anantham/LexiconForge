param(
    [Parameter(Mandatory = $true)][string]$SeedDirectory,
    [string]$SourceDirectory = (Join-Path $PSScriptRoot '../../deploy/windows')
)

# Seed: exact upstream v1.18.0 package.json/package-lock.json and a yaml package
# directory matching the lock (2.8.3). No download, real installation or activation.
$ErrorActionPreference = 'Stop'
$SeedDirectory = (Resolve-Path -LiteralPath $SeedDirectory).Path
$SourceDirectory = (Resolve-Path -LiteralPath $SourceDirectory).Path
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('lf-hardening-test-' + [guid]::NewGuid())
$hardening = Join-Path $SourceDirectory 'apply-sillytavern-hardening.ps1'
$probeState = @{ Cases = @(); InstallCalls = 0 }

function Expect-Rejection([string]$Name, [string]$Expected) {
    $message = ''
    try {
        & $hardening -SillyTavernRoot $sandbox -AllowedDeviceIp '100.64.0.42' | Out-Null
    } catch { $message = $_.Exception.Message }
    if ($message -notlike "*$Expected*") {
        throw "$Name expected '$Expected'; received '$message'."
    }
    $probeState.Cases += $Name
}

try {
    New-Item -ItemType Directory -Path $sandbox | Out-Null
    foreach ($name in @('package.json', 'package-lock.json')) {
        Copy-Item -LiteralPath (Join-Path $SeedDirectory $name) -Destination $sandbox
    }
    Set-Content -LiteralPath (Join-Path $sandbox '.gitignore') -Value "node_modules/`nconfig.yaml"
    & git -C $sandbox init --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Fixture git init failed.' }
    & git -C $sandbox -c core.autocrlf=false add package.json package-lock.json .gitignore
    if ($LASTEXITCODE -ne 0) { throw 'Fixture git add failed.' }
    & git -C $sandbox -c user.name='LexiconForge QA' -c user.email='qa@example.invalid' -c commit.gpgsign=false -c core.hooksPath=NUL commit --quiet -m 'Public manifest fixture'
    if ($LASTEXITCODE -ne 0) { throw 'Fixture git commit failed.' }
    New-Item -ItemType Directory -Path (Join-Path $sandbox 'node_modules') | Out-Null
    Copy-Item -LiteralPath (Join-Path $SeedDirectory 'yaml') -Destination (Join-Path $sandbox 'node_modules/yaml') -Recurse
    $configPath = Join-Path $sandbox 'config.yaml'
    Set-Content -LiteralPath $configPath -Encoding UTF8 -Value @'
listen: false
whitelistMode: true
enableForwardedWhitelist: true
basicAuthMode: false
enableUserAccounts: false
disableCsrfProtection: false
securityOverride: false
forwardedHeaders:
  xForwardedFor: true
whitelist:
  - ::1
  - 127.0.0.1
'@
    # Simulate the installed manifest only. Any unexpected npm invocation fails.
    function npm {
        if (($args -join ' ') -ne 'ci --ignore-scripts') { throw 'Unexpected npm arguments.' }
        $probeState.InstallCalls++
        if ($probeState.InstallCalls -ne 1) { throw 'Unexpected repeated npm installation.' }
        New-Item -ItemType Directory -Path (Join-Path $sandbox 'node_modules/multer') | Out-Null
        Set-Content -LiteralPath (Join-Path $sandbox 'node_modules/multer/package.json') -Value '{"version":"2.2.0"}'
        $global:LASTEXITCODE = 0
    }

    Expect-Rejection 'pristine verification requires overlay' 'Multer 2.1.1 is still installed'
    & $hardening -SillyTavernRoot $sandbox -AllowedDeviceIp '100.64.0.42' -Apply | Out-Null
    $probeState.Cases += 'real overlay and configurator apply'
    $backups = @(Get-ChildItem -LiteralPath $sandbox -Filter 'config.yaml.lexiconforge-backup-*')
    if ($backups.Count -ne 1) { throw 'Configurator did not create exactly one backup.' }
    $before = @(Get-ChildItem -LiteralPath $sandbox -File | Get-FileHash | Sort-Object Path | Select-Object -ExpandProperty Hash)
    & $hardening -SillyTavernRoot $sandbox -AllowedDeviceIp '100.64.0.42' | Out-Null
    & $hardening -SillyTavernRoot $sandbox -AllowedDeviceIp '100.64.0.42' | Out-Null
    $after = @(Get-ChildItem -LiteralPath $sandbox -File | Get-FileHash | Sort-Object Path | Select-Object -ExpandProperty Hash)
    if (($before -join ',') -ne ($after -join ',') -or $probeState.InstallCalls -ne 1) {
        throw "Repeated verification changed files or installation count: installs=$($probeState.InstallCalls), before=$($before -join ','), after=$($after -join ',')."
    }
    $probeState.Cases += 'two no-write verifications preserve manifests, config and backup'

    $packagePath = Join-Path $sandbox 'package.json'
    $packageBytes = [IO.File]::ReadAllBytes($packagePath)
    Copy-Item -LiteralPath (Join-Path $SeedDirectory 'package.json') -Destination $packagePath -Force
    Expect-Rejection 'mixed manifest pair' 'neither the reviewed'
    [IO.File]::WriteAllBytes($packagePath, $packageBytes)
    Add-Content -LiteralPath $packagePath -Value ' '
    Expect-Rejection 'unreviewed manifest edit' 'neither the reviewed'
    [IO.File]::WriteAllBytes($packagePath, $packageBytes)

    foreach ($name in @('unrelated.txt', 'config.yaml.lexiconforge-backup-invalid')) {
        $probe = Join-Path $sandbox $name
        Set-Content -LiteralPath $probe -Value 'synthetic probe'
        Expect-Rejection $name 'unrelated uncommitted files'
        Remove-Item -LiteralPath $probe
    }
    $installed = Join-Path $sandbox 'node_modules/multer/package.json'
    Set-Content -LiteralPath $installed -Value '{"version":"2.1.1"}'
    Expect-Rejection 'incorrect installed version' 'Installed Multer must be 2.2.0'
    Set-Content -LiteralPath $installed -Value '{"version":"2.2.0"}'
    $configBytes = [IO.File]::ReadAllBytes($configPath)
    (Get-Content -LiteralPath $configPath -Raw).Replace('disableCsrfProtection: false', 'disableCsrfProtection: true') | Set-Content -LiteralPath $configPath -Encoding UTF8
    Expect-Rejection 'disabled CSRF' 'config hardening failed'
    [IO.File]::WriteAllBytes($configPath, $configBytes)

    # A pristine working pair cannot disguise an unreviewed committed import.
    & git -C $sandbox -c core.autocrlf=false add package.json
    if ($LASTEXITCODE -ne 0) { throw 'Fixture provenance staging failed.' }
    & git -C $sandbox -c user.name='LexiconForge QA' -c user.email='qa@example.invalid' -c commit.gpgsign=false -c core.hooksPath=NUL commit --quiet -m 'Unreviewed import fixture'
    if ($LASTEXITCODE -ne 0) { throw 'Fixture provenance commit failed.' }
    foreach ($name in @('package.json', 'package-lock.json')) {
        Copy-Item -LiteralPath (Join-Path $SeedDirectory $name) -Destination $sandbox -Force
    }
    Expect-Rejection 'pristine files over an unreviewed committed import' 'committed HEAD manifest blobs do not match'

    [ordered]@{ PowerShell=$PSVersionTable.PSVersion.ToString(); Node=(& node --version); Cases=$probeState.Cases; InstallCalls=$probeState.InstallCalls; Limits='Disposable manifests and config; npm simulated, real git overlay and configurator. No live runtime or service changes.' } | ConvertTo-Json -Depth 3
} finally {
    Remove-Item Function:\npm -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $sandbox) { Remove-Item -LiteralPath $sandbox -Recurse -Force }
}
