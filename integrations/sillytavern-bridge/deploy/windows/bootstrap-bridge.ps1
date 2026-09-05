param(
    [Parameter(Mandatory = $true)]
    [string]$BasePython,
    [string]$UvExecutable = 'uv'
)

$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeRoot = (Resolve-Path (Join-Path $scriptDirectory '..\..')).Path
$uv = (Get-Command $UvExecutable -CommandType Application -ErrorAction Stop).Source
$virtualEnvironment = Join-Path $bridgeRoot '.venv-native'
$virtualPython = Join-Path $virtualEnvironment 'Scripts\python.exe'
$requirements = Join-Path $bridgeRoot '.runtime-requirements.txt'

foreach ($requiredFile in @($uv, $basePython)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required runtime executable is missing: $requiredFile"
    }
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
