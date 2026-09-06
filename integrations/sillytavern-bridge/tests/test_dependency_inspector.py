import json
from pathlib import Path
import subprocess

import pytest


INSPECTOR = Path(__file__).parents[1] / "deploy/windows/inspect-sillytavern-dependencies.mjs"


@pytest.fixture
def runtime(tmp_path: Path) -> Path:
    root = tmp_path / "runtime with spaces"
    root.mkdir()
    (root / "package.json").write_text(
        json.dumps({"dependencies": {"multer": "^2.2.0"}}), encoding="utf-8"
    )
    (root / "package-lock.json").write_text(
        json.dumps({"packages": {
            "": {"name": "sillytavern"},
            "node_modules/multer": {
                "version": "2.2.0",
                "resolved": "https://registry.npmjs.org/multer/-/multer-2.2.0.tgz",
                "integrity": "sha512-reviewed-fixture",
            },
        }}), encoding="utf-8"
    )
    return root


def inspect(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(INSPECTOR), "--root", str(root)],
        capture_output=True, text=True, check=False,
    )


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig"])
def test_reads_npm_empty_root_key_and_windows_bom(runtime: Path, encoding: str) -> None:
    for name in ("package.json", "package-lock.json"):
        file = runtime / name
        file.write_text(file.read_text(encoding="utf-8"), encoding=encoding)
    result = inspect(runtime)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "declaredMulter": "^2.2.0", "lockedMulter": "2.2.0",
        "resolved": "https://registry.npmjs.org/multer/-/multer-2.2.0.tgz",
        "integrity": "sha512-reviewed-fixture",
    }


def test_rejects_malformed_lock_without_success_output(runtime: Path) -> None:
    (runtime / "package-lock.json").write_text('{"packages":', encoding="utf-8")
    result = inspect(runtime)
    assert result.returncode == 1
    assert "package-lock.json is not valid JSON" in result.stderr
    assert result.stdout == ""


@pytest.mark.parametrize("field,value", [
    ("version", None), ("resolved", ""), ("integrity", 123),
])
def test_rejects_incomplete_dependency_identity(runtime: Path, field: str, value) -> None:
    lock = runtime / "package-lock.json"
    payload = json.loads(lock.read_text(encoding="utf-8"))
    payload["packages"]["node_modules/multer"][field] = value
    lock.write_text(json.dumps(payload), encoding="utf-8")
    result = inspect(runtime)
    assert result.returncode == 1
    assert f"['node_modules/multer'].{field} must be a non-empty string" in result.stderr
    assert result.stdout == ""


def test_rejects_missing_dependency_record(runtime: Path) -> None:
    (runtime / "package-lock.json").write_text(
        json.dumps({"packages": {"": {"name": "sillytavern"}}}), encoding="utf-8"
    )
    result = inspect(runtime)
    assert result.returncode == 1
    assert "packages['node_modules/multer'] must be an object" in result.stderr
    assert result.stdout == ""
