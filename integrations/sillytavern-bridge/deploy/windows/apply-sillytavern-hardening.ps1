param(
    [Parameter(Mandatory = $true)]
    [string[]]$AllowedDeviceIp,
    [string]$SillyTavernRoot = 'C:\Users\adity\Documents\Ongoing Local\ST\runtime\SillyTavern-1.18.0',
    [string]$NodeExecutable = 'node',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$expectedBaseCommit = '51ad27fb86d39a3daca3adaa970375c9670c12df'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRoot = (Resolve-Path (Join-Path $scriptDirectory '..\..')).Path
$patchPath = Join-Path $bridgeRoot 'security\sillytavern-1.18.0-multer-2.2.0.patch'
$configuratorPath = Join-Path $scriptDirectory 'configure-sillytavern-security.mjs'

foreach ($requiredFile in @($patchPath, $configuratorPath, (Join-Path $SillyTavernRoot 'package.json'))) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required hardening input is missing: $requiredFile"
    }
}

Push-Location $SillyTavernRoot
try {
    & git merge-base --is-ancestor $expectedBaseCommit HEAD
    if ($LASTEXITCODE -ne 0) {
        throw "SillyTavern HEAD does not contain expected v1.18.0 base $expectedBaseCommit. Refusing version-specific overlay."
    }

    $dirtyPaths = @(& git status --porcelain | ForEach-Object { $_.Substring(3) })
    $unexpectedDirtyPaths = @($dirtyPaths | Where-Object { $_ -notin @('package.json', 'package-lock.json') })
    if ($unexpectedDirtyPaths.Count -gt 0) {
        throw "SillyTavern runtime has unrelated uncommitted files: $($unexpectedDirtyPaths -join ', ')."
    }

    $package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
    $lock = Get-Content -LiteralPath 'package-lock.json' -Raw | ConvertFrom-Json
    $declaredMulter = $package.dependencies.multer
    $lockedMulter = $lock.packages.'node_modules/multer'.version

    if ($declaredMulter -eq '^2.1.1' -and $lockedMulter -eq '2.1.1') {
        if (-not $Apply) {
            throw 'Multer 2.1.1 is still installed. Re-run with -Apply after reviewing the exact overlay.'
        }
        & git apply --check $patchPath
        if ($LASTEXITCODE -ne 0) {
            throw "Multer overlay does not apply cleanly to $SillyTavernRoot."
        }
        & git apply $patchPath
        if ($LASTEXITCODE -ne 0) {
            throw "git apply failed for $patchPath."
        }
        Write-Host 'Applied versioned Multer 2.2.0 manifest and lock overlay.'
    } elseif ($declaredMulter -ne '^2.2.0' -or $lockedMulter -ne '2.2.0') {
        throw "Unexpected Multer state: package.json=$declaredMulter package-lock.json=$lockedMulter."
    }

    $lockedMulterRecord = $lock.packages.'node_modules/multer'
    if ($lockedMulterRecord.resolved -ne 'https://registry.npmjs.org/multer/-/multer-2.2.0.tgz' `
        -or $lockedMulterRecord.integrity -ne 'sha512-6rdyFg2kLrMh9Jee7/BMPuV9lEAd7lLW2YUpF9/YxR7njyoUwwQ0ZPh3TaIY50Sw6vlyD2HW3wGOkTS4P79xrQ==') {
        throw 'Multer 2.2.0 lock source or integrity differs from the reviewed overlay.'
    }

    if ($Apply) {
        & npm ci --ignore-scripts
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed after applying the Multer overlay (exit $LASTEXITCODE)."
        }
    }

    $installedMulterPath = Join-Path $SillyTavernRoot 'node_modules\multer\package.json'
    if (-not (Test-Path -LiteralPath $installedMulterPath -PathType Leaf)) {
        throw "Installed Multer manifest is missing: $installedMulterPath"
    }
    $installedMulter = (Get-Content -LiteralPath $installedMulterPath -Raw | ConvertFrom-Json).version
    if ($installedMulter -ne '2.2.0') {
        throw "Installed Multer must be 2.2.0; found $installedMulter."
    }

    $configArguments = @($configuratorPath, '--root', $SillyTavernRoot)
    foreach ($ip in $AllowedDeviceIp) {
        $configArguments += @('--allowed-ip', $ip)
    }
    if ($Apply) {
        $configArguments += '--apply'
    }
    & $NodeExecutable @configArguments
    if ($LASTEXITCODE -ne 0) {
        throw "SillyTavern config hardening failed (exit $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

Write-Host 'SillyTavern dependency and forwarded-IP boundary are verified.'
