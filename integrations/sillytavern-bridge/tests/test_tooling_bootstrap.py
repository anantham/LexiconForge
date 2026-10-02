"""Offline checks for bootstrap's fixed installation boundary and tool lock."""
import json
import os
from pathlib import Path
import shutil
import subprocess


BRIDGE = Path(__file__).parents[1]
BOOTSTRAP = BRIDGE / "deploy/windows/bootstrap-bridge.ps1"


def install_arguments(text: str, tools: Path) -> list[str]:
    line = next(line.strip() for line in text.splitlines() if line.strip().startswith("& $npm ci "))
    arguments = line.split()[2:]
    assert arguments[-2:] == ["--prefix", "$toolsDirectory"]
    assert arguments[:-2] == ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]
    return [*arguments[:-1], str(tools)]


def test_windows_bootstrap_requires_trusted_lock_and_stops_on_failure() -> None:
    text = BOOTSTRAP.read_text(encoding="utf-8")
    assert "$toolsDirectory = Join-Path $bridgeRoot 'deploy\\tools'" in text
    assert "(Join-Path $toolsDirectory 'package-lock.json')" in text
    assert "$trustedParser = Join-Path $toolsDirectory 'node_modules\\yaml\\dist\\index.js'" in text
    install = text.index("& $npm ci ")
    assert text.index("Push-Location $toolsDirectory") < install
    failure = text.index('throw "npm failed to install the frozen trusted tooling lock', install)
    assert "if ($LASTEXITCODE -ne 0)" in text[install:failure]
    parser = text.index("Test-Path -LiteralPath $trustedParser -PathType Leaf", failure)
    assert install < failure < parser < text.index("& $basePython -m venv") < text.index("& $uv export")
    assert "LF_ST_ROOT" not in text and "$SillyTavernRoot" not in text
    assert "finally {\n    Pop-Location\n}" in text[install:]
    install_arguments(text, Path("trusted tools"))


def test_tool_lock_is_exact_and_contains_only_the_known_yaml_parser() -> None:
    package = json.loads((BRIDGE / "deploy/tools/package.json").read_text(encoding="utf-8"))
    lock = json.loads((BRIDGE / "deploy/tools/package-lock.json").read_text(encoding="utf-8"))
    assert package["dependencies"] == {"yaml": "2.8.3"}
    assert lock["packages"][""]["dependencies"] == package["dependencies"]
    assert set(lock["packages"]) == {"", "node_modules/yaml"}
    yaml = lock["packages"]["node_modules/yaml"]
    assert yaml["version"] == "2.8.3"
    assert yaml["resolved"] == "https://registry.npmjs.org/yaml/-/yaml-2.8.3.tgz"
    assert yaml["integrity"] == "sha512-AvbaCLOO2Otw/lW5bmh9d/WEdcDFdQp2Z2ZUH3pX9U2ihyUY0nvLv7J6TrWowklRGPYbB/IuIMfYgxaCPg5Bpg=="


def test_bootstrap_install_command_is_offline_locked_and_suppresses_lifecycle(tmp_path: Path) -> None:
    npm = shutil.which("npm")
    assert npm is not None, "Bootstrap requires an installed trusted npm executable"
    tools = tmp_path / "trusted bridge/deploy/tools"
    tools.mkdir(parents=True)
    package = {"name": "trusted-tooling-fixture", "version": "1.0.0", "private": True,
               "scripts": {"postinstall": "node -e \"require('fs').writeFileSync('lifecycle-executed','BAD')\""}}
    (tools / "package.json").write_text(json.dumps(package), encoding="utf-8")
    # A dependency-free synthetic lock needs no package download or code execution.
    (tools / "package-lock.json").write_text(json.dumps({
        "name": package["name"], "version": "1.0.0", "lockfileVersion": 3,
        "requires": True, "packages": {"": {"name": package["name"], "version": "1.0.0", "hasInstallScript": True}},
    }), encoding="utf-8")
    target = tmp_path / "untrusted target"
    target.mkdir()
    (target / "package.json").write_text(json.dumps({**package, "name": "untrusted-target"}), encoding="utf-8")
    before = {file.name: file.read_bytes() for file in tools.iterdir()}
    result = subprocess.run(
        [npm, *install_arguments(BOOTSTRAP.read_text(encoding="utf-8"), tools)],
        cwd=target, capture_output=True, text=True, check=False, timeout=30,
        env={**os.environ, "npm_config_offline": "true", "npm_config_cache": str(tmp_path / "npm-cache")},
    )
    assert result.returncode == 0, result.stderr
    assert not (tools / "lifecycle-executed").exists()
    assert not (target / "lifecycle-executed").exists()
    assert not (target / "package-lock.json").exists()
    assert not (target / "node_modules").exists()
    assert all((tools / name).read_bytes() == content for name, content in before.items())
