param(
    [Parameter(Mandatory = $true)]
    [string]$BasePython,
    [string]$UvExecutable = 'uv',
    [string]$NpmExecutable = 'npm'
)

$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRoot = (Resolve-Path (Join-Path $scriptDirectory '..\..')).Path
$uv = (Get-Command $UvExecutable -CommandType Application -ErrorAction Stop).Source
$npm = (Get-Command $NpmExecutable -CommandType Application -ErrorAction Stop).Source
$toolsDirectory = Join-Path $bridgeRoot 'deploy\tools'
$trustedParser = Join-Path $toolsDirectory 'node_modules\yaml\dist\index.js'
$virtualEnvironment = Join-Path $bridgeRoot '.venv-native'
$virtualPython = Join-Path $virtualEnvironment 'Scripts\python.exe'
$requirements = Join-Path $bridgeRoot '.runtime-requirements.txt'

foreach ($requiredFile in @(
    $uv, $basePython, $npm,
    (Join-Path $toolsDirectory 'package.json'),
    (Join-Path $toolsDirectory 'package-lock.json')
)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required bootstrap input is missing: $requiredFile"
    }
}

# Provision only the tool-owned lock, never a target SillyTavern installation.
# A fixed working directory also prevents an unrelated caller's .npmrc/package
# from becoming the installation context.
Push-Location $toolsDirectory
try {
    & $npm ci --ignore-scripts --no-audit --no-fund --prefix $toolsDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "npm failed to install the frozen trusted tooling lock (exit $LASTEXITCODE)"
    }
    if (-not (Test-Path -LiteralPath $trustedParser -PathType Leaf)) {
        throw "Trusted YAML parser is missing after tooling installation: $trustedParser"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $virtualPython -PathType Leaf)) {
    & $basePython -m venv $virtualEnvironment
    if ($LASTEXITCODE -ne 0) {
        throw "Python failed to create $virtualEnvironment (exit $LASTEXITCODE)"
    }
}

& $uv export `
    --quiet `
    --project $bridgeRoot `
    --frozen `
    --no-emit-project `
    --format requirements.txt `
    --output-file $requirements
if ($LASTEXITCODE -ne 0) {
    throw "uv failed to export the frozen bridge lock (exit $LASTEXITCODE)"
}

& $uv pip sync --python $virtualPython $requirements
if ($LASTEXITCODE -ne 0) {
    throw "uv failed to synchronize the bridge environment (exit $LASTEXITCODE)"
}

Push-Location $bridgeRoot
try {
    & $virtualPython -m pytest -q -p no:cacheprovider
    if ($LASTEXITCODE -ne 0) {
        throw "Bridge tests failed on the runtime (exit $LASTEXITCODE)"
    }
} finally {
    Pop-Location
}

Write-Host "Bridge runtime bootstrapped and verified at $bridgeRoot"
