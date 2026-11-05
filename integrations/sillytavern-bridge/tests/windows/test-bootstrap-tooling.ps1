param([string]$SourceDirectory = (Join-Path $PSScriptRoot '../../deploy/windows'))

# Disposable command stubs only: no npm/Python install, runtime or service.
$ErrorActionPreference = 'Stop'
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('lf-bootstrap-test-' + [guid]::NewGuid())
try {
    $windows = New-Item -ItemType Directory -Path (Join-Path $sandbox 'deploy/windows') -Force
    $tools = New-Item -ItemType Directory -Path (Join-Path $sandbox 'deploy/tools') -Force
    Copy-Item -LiteralPath (Join-Path $SourceDirectory 'bootstrap-bridge.ps1') -Destination $windows.FullName
    foreach ($name in @('package.json', 'package-lock.json')) {
        Copy-Item -LiteralPath (Join-Path $SourceDirectory "../tools/$name") -Destination $tools.FullName
    }
    $bootstrap = Join-Path $windows.FullName 'bootstrap-bridge.ps1'
    $python = Join-Path $sandbox 'python-fixture.cmd'
    $uv = Join-Path $sandbox 'uv-fixture.cmd'
    $npm = Join-Path $sandbox 'npm-fixture.cmd'
    $unexpected = Join-Path $sandbox 'unexpected-runtime-call'
    foreach ($file in @($python, $uv)) {
        Set-Content -LiteralPath $file -Value "@echo off`necho BAD> `"$unexpected`"`nexit /b 99"
    }

    function Expect-Rejection([string]$Expected) {
        $message = ''
        try { & $bootstrap -BasePython $python -UvExecutable $uv -NpmExecutable $npm | Out-Null }
        catch { $message = $_.Exception.Message }
        if ($message -notlike "*$Expected*") { throw "Expected '$Expected', received '$message'." }
        if (Test-Path -LiteralPath $unexpected) { throw 'Bootstrap continued after a tooling failure.' }
    }

    $arguments = Join-Path $sandbox 'npm-arguments'
    Set-Content -LiteralPath $npm -Value "@echo off`necho %*> `"$arguments`"`nexit /b 74"
    Expect-Rejection 'frozen trusted tooling lock (exit 74)'
    $invocation = Get-Content -LiteralPath $arguments -Raw
    if ($invocation -notlike '*ci --ignore-scripts --no-audit --no-fund --prefix*' `
        -or $invocation -notlike "*$($tools.FullName)*") { throw 'npm did not receive the fixed trusted tools boundary.' }

    Set-Content -LiteralPath $npm -Value "@echo off`nexit /b 0"
    Expect-Rejection 'Trusted YAML parser is missing after tooling installation'

    Remove-Item -LiteralPath (Join-Path $tools.FullName 'package-lock.json')
    Expect-Rejection 'Required bootstrap input is missing'
    Write-Output 'PASS: npm failure, missing installed parser and missing trusted lock fail before Python/uv.'
} finally {
    if (Test-Path -LiteralPath $sandbox) { Remove-Item -LiteralPath $sandbox -Recurse -Force }
}
