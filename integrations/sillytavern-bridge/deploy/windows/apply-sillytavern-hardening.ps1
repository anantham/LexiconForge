param(
    [Parameter(Mandatory = $true)]
    [string[]]$AllowedDeviceIp,
    [Parameter(Mandatory = $true)]
    [string]$SillyTavernRoot,
    [string]$NodeExecutable = 'node',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$expectedBaseCommit = '51ad27fb86d39a3daca3adaa970375c9670c12df'
$expectedBasePackageBlob = '12c30fc061e38c0a35becca70fab9c6fb991a7f0'
$expectedBaseLockBlob = '95b4dbc33c62829e2aff383f286889ebdcc15ffd'
$expectedHardenedPackageBlob = '47898a96d79c053a90acb5502283161ff8c49b16'
$expectedHardenedLockBlob = 'c4f410036f0dfe5194764ae56620eb76a362ea44'
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRoot = (Resolve-Path (Join-Path $scriptDirectory '..\..')).Path
$patchPath = Join-Path $bridgeRoot 'security\sillytavern-1.18.0-multer-2.2.0.patch'
$configuratorPath = Join-Path $scriptDirectory 'configure-sillytavern-security.mjs'
$dependencyInspectorPath = Join-Path $scriptDirectory 'inspect-sillytavern-dependencies.mjs'

foreach ($requiredFile in @(
    $patchPath,
    $configuratorPath,
    $dependencyInspectorPath,
    (Join-Path $SillyTavernRoot 'package.json'),
    (Join-Path $SillyTavernRoot 'package-lock.json')
)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required hardening input is missing: $requiredFile"
    }
}

function Get-DependencyInspection {
    $output = @(& $NodeExecutable $dependencyInspectorPath '--root' $SillyTavernRoot 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "SillyTavern dependency inspection failed (exit $LASTEXITCODE): $($output -join [Environment]::NewLine)"
    }
    try {
        return ($output -join [Environment]::NewLine) | ConvertFrom-Json
    } catch {
        throw "SillyTavern dependency inspector returned invalid JSON: $($output -join [Environment]::NewLine)"
    }
}

$SillyTavernRoot = (Resolve-Path -LiteralPath $SillyTavernRoot).Path
Push-Location $SillyTavernRoot
try {
    $resolvedBase = & git rev-parse --verify --quiet "$($expectedBaseCommit)^{commit}"
    $hasExpectedAncestor = $false
    if ($LASTEXITCODE -eq 0 -and $resolvedBase) {
        & git merge-base --is-ancestor $expectedBaseCommit HEAD
        $hasExpectedAncestor = $LASTEXITCODE -eq 0
    }

    if (-not $hasExpectedAncestor) {
        $committedPackageBlob = & git rev-parse --verify 'HEAD:package.json'
        if ($LASTEXITCODE -ne 0 -or -not $committedPackageBlob) {
            throw 'Cannot resolve committed SillyTavern package.json provenance at HEAD:package.json.'
        }
        $committedLockBlob = & git rev-parse --verify 'HEAD:package-lock.json'
        if ($LASTEXITCODE -ne 0 -or -not $committedLockBlob) {
            throw 'Cannot resolve committed SillyTavern package-lock.json provenance at HEAD:package-lock.json.'
        }
        if ($committedPackageBlob -ne $expectedBasePackageBlob `
            -or $committedLockBlob -ne $expectedBaseLockBlob) {
            throw "SillyTavern lacks expected release ancestry and its committed HEAD manifest blobs do not match the reviewed v1.18.0 snapshot: package.json=$committedPackageBlob package-lock.json=$committedLockBlob."
        }
        Write-Host 'Accepted history-independent v1.18.0 import by exact committed HEAD manifest blob hashes.'
    }

    $workingManifestBlobs = @(& git hash-object -- package.json package-lock.json)
    if ($LASTEXITCODE -ne 0 -or $workingManifestBlobs.Count -ne 2) {
        throw 'Cannot compute working SillyTavern package manifest blob hashes.'
    }
    $workingPackageBlob = $workingManifestBlobs[0]
    $workingLockBlob = $workingManifestBlobs[1]
    $isReviewedBasePair = $workingPackageBlob -eq $expectedBasePackageBlob `
        -and $workingLockBlob -eq $expectedBaseLockBlob
    $isReviewedHardenedPair = $workingPackageBlob -eq $expectedHardenedPackageBlob `
        -and $workingLockBlob -eq $expectedHardenedLockBlob
    if (-not $isReviewedBasePair -and -not $isReviewedHardenedPair) {
        throw "Working SillyTavern manifests are neither the reviewed v1.18.0 pair nor the reviewed Multer 2.2.0 pair: package.json=$workingPackageBlob package-lock.json=$workingLockBlob."
    }

    $dirtyPaths = @(& git status --porcelain | ForEach-Object { $_.Substring(3) })
    $unexpectedDirtyPaths = @($dirtyPaths | Where-Object {
        $path = $_
        $isManifest = $path -in @('package.json', 'package-lock.json')
        $isConfiguratorBackup = $path -match '^config\.yaml\.lexiconforge-backup-\d+$'
        -not ($isManifest -or $isConfiguratorBackup)
    })
    if ($unexpectedDirtyPaths.Count -gt 0) {
        throw "SillyTavern runtime has unrelated uncommitted files: $($unexpectedDirtyPaths -join ', ')."
    }

    $dependencyBefore = Get-DependencyInspection
    $declaredMulter = $dependencyBefore.declaredMulter
    $lockedMulter = $dependencyBefore.lockedMulter

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

    $dependencyAfter = Get-DependencyInspection
    if ($dependencyAfter.declaredMulter -ne '^2.2.0' -or $dependencyAfter.lockedMulter -ne '2.2.0') {
        throw "Multer overlay did not produce the expected manifest state: package.json=$($dependencyAfter.declaredMulter) package-lock.json=$($dependencyAfter.lockedMulter)."
    }
    if ($dependencyAfter.resolved -ne 'https://registry.npmjs.org/multer/-/multer-2.2.0.tgz' `
        -or $dependencyAfter.integrity -ne 'sha512-6rdyFg2kLrMh9Jee7/BMPuV9lEAd7lLW2YUpF9/YxR7njyoUwwQ0ZPh3TaIY50Sw6vlyD2HW3wGOkTS4P79xrQ==') {
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
