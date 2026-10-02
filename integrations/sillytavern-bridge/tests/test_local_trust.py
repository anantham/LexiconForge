"""Synthetic source/config trees only: no upstream/runtime code is executed."""
import json
import os
from pathlib import Path
import subprocess

import pytest


BRIDGE = Path(__file__).parents[1]
VERIFIER = BRIDGE / "deploy/windows/verify-sillytavern-source.mjs"
CONFIGURATOR = BRIDGE / "deploy/windows/configure-sillytavern-security.mjs"


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


@pytest.fixture
def source(tmp_path: Path):
    root = tmp_path / "synthetic source with spaces"
    root.mkdir()
    (root / ".gitignore").write_text("node_modules/\nconfig.yaml\nplugins/\n", encoding="utf-8")
    (root / "package.json").write_text('{"dependencies":{"multer":"base"}}', encoding="utf-8")
    (root / "package-lock.json").write_text('{"packages":{}}', encoding="utf-8")
    (root / "server.js").write_text("// synthetic source; never executed\n", encoding="utf-8")
    git(root, "init", "--quiet")
    git(root, "add", ".")
    git(root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Synthetic source")
    expected = {"commit": git(root, "rev-parse", "HEAD"), "basePair": [
        git(root, "hash-object", "--no-filters", name) for name in ("package.json", "package-lock.json")
    ], "hardenedPair": ["not-a-blob", "not-a-blob"]}
    return root, expected


def verify(source) -> subprocess.CompletedProcess[str]:
    root, expected = source
    script = "import {verifySource} from " + json.dumps(VERIFIER.as_uri()) + "; try { console.log(JSON.stringify(verifySource(process.argv[1],JSON.parse(process.argv[2])))); } catch(e) {console.error(e.message);process.exitCode=1;}"
    return subprocess.run(["node", "--input-type=module", "-e", script, str(root), json.dumps(expected)], capture_output=True, text=True, check=False)


def test_complete_source_and_runtime_data_are_accepted(source) -> None:
    root, _ = source
    (root / "data").mkdir()
    (root / "data/private-fixture.json").write_text("DO NOT INSPECT", encoding="utf-8")
    (root / "config.yaml").write_text("synthetic", encoding="utf-8")
    result = verify(source)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["sourceFiles"] == 4


@pytest.mark.parametrize("hidden", [None, "--assume-unchanged", "--skip-worktree"])
def test_changed_source_rejected_even_when_git_status_hides_it(source, hidden) -> None:
    root, _ = source
    if hidden:
        git(root, "update-index", hidden, "server.js")
    (root / "server.js").write_text("// unreviewed code\n", encoding="utf-8")
    result = verify(source)
    assert result.returncode == 1
    assert "unreviewed working source bytes: server.js" in result.stderr


def test_matching_manifests_do_not_accept_committed_source_changes(source) -> None:
    root, _ = source
    (root / "server.js").write_text("// changed committed code\n", encoding="utf-8")
    git(root, "add", "server.js")
    git(root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Unreviewed descendant")
    result = verify(source)
    assert result.returncode == 1
    assert "exact reviewed official" in result.stderr


def test_manifest_only_import_is_rejected_by_public_cli(source) -> None:
    root, _ = source
    result = subprocess.run(["node", str(VERIFIER), "--root", str(root)], capture_output=True, text=True)
    assert result.returncode == 1
    assert "matching manifests alone are insufficient" in result.stderr


@pytest.mark.parametrize("name", ["untracked.js", "plugins/ignored.js", "public/scripts/extensions/third-party/unreviewed.js"])
def test_unreviewed_executable_additions_are_rejected_including_ignored_plugins(source, name) -> None:
    root, _ = source
    file = root / name
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text("// synthetic unreviewed code", encoding="utf-8")
    result = verify(source)
    assert result.returncode == 1
    assert "unreviewed runtime path" in result.stderr


def test_source_symlink_replacement_is_rejected(source) -> None:
    root, _ = source
    file = root / "server.js"
    file.unlink()
    file.symlink_to(root / "package.json")
    assert "source file type changed" in verify(source).stderr


def test_staged_edits_rejected(source) -> None:
    root, _ = source
    (root / "server.js").write_text("// staged edit", encoding="utf-8")
    git(root, "add", "server.js")
    assert "staged changes" in verify(source).stderr


def test_mixed_or_modified_manifest_pair_rejected(source) -> None:
    root, _ = source
    (root / "package.json").write_text("{}", encoding="utf-8")
    assert "exact reviewed base or hardened pair" in verify(source).stderr


def test_exact_hardened_manifest_pair_is_accepted(source) -> None:
    root, expected = source
    (root / "package.json").write_text('{"dependencies":{"multer":"hardened"}}', encoding="utf-8")
    (root / "package-lock.json").write_text('{"packages":{"reviewed":true}}', encoding="utf-8")
    expected["hardenedPair"] = [git(root, "hash-object", "--no-filters", name) for name in ("package.json", "package-lock.json")]
    result = verify(source)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["hardened"] is True


def test_target_git_fsmonitor_callback_is_never_executed(source) -> None:
    root, _ = source
    marker = root / ".git/callback-executed"
    callback = root / ".git/fsmonitor-fixture"
    callback.write_text("#!/bin/sh\ntouch '" + str(marker) + "'\n", encoding="utf-8")
    callback.chmod(0o755)
    git(root, "config", "core.fsmonitor", str(callback))
    result = verify(source)
    assert result.returncode == 0, result.stderr
    assert not marker.exists()


def test_git_replace_cannot_substitute_unreviewed_source(source) -> None:
    root, expected = source
    (root / "server.js").write_text("// substituted source", encoding="utf-8")
    git(root, "add", "server.js")
    git(root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Substitute")
    substitute = git(root, "rev-parse", "HEAD")
    git(root, "update-ref", "HEAD", expected["commit"])
    git(root, "replace", expected["commit"], substitute)
    assert verify(source).returncode == 1


@pytest.fixture
def config_root(tmp_path: Path) -> Path:
    root = tmp_path / "target with malicious dependency"
    root.mkdir()
    (root / "package.json").write_text("{}", encoding="utf-8")
    (root / "config.yaml").write_text("""# preserved comment
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
""", encoding="utf-8")
    module = root / "node_modules/yaml"
    module.mkdir(parents=True)
    (module / "package.json").write_text('{"main":"index.js"}', encoding="utf-8")
    (module / "index.js").write_text("require('node:fs').writeFileSync(" + json.dumps(str(root / "executed")) + ", 'BAD'); throw Error('target yaml executed');", encoding="utf-8")
    return root


def configure(root: Path, *args: str):
    return subprocess.run(["node", str(CONFIGURATOR), "--root", str(root), "--local-only", *args], capture_output=True, text=True)


def test_trusted_parser_never_executes_target_yaml(config_root) -> None:
    before = (config_root / "config.yaml").read_bytes()
    result = configure(config_root)
    assert result.returncode == 0, result.stderr
    assert not (config_root / "executed").exists()
    assert (config_root / "config.yaml").read_bytes() == before


def test_missing_trusted_parser_fails_without_target_fallback(config_root, tmp_path: Path) -> None:
    script = tmp_path / "isolated-trusted-checkout/deploy/windows/configure-sillytavern-security.mjs"
    script.parent.mkdir(parents=True)
    script.write_bytes(CONFIGURATOR.read_bytes())
    result = subprocess.run(["node", str(script), "--root", str(config_root), "--local-only"], capture_output=True, text=True)
    assert result.returncode != 0
    assert "ERR_MODULE_NOT_FOUND" in result.stderr
    assert not (config_root / "executed").exists()


def test_trusted_parser_applies_whitelist_and_preserves_comments(config_root) -> None:
    config = config_root / "config.yaml"
    original = config.read_bytes().replace(b"  - 127.0.0.1\n", b"  - 127.0.0.1\n  - 100.64.0.42\n")
    config.write_bytes(original)
    result = configure(config_root, "--apply")
    assert result.returncode == 0, result.stderr
    assert config.read_bytes() == original.replace(b"  - 100.64.0.42\n", b"")
    assert len(list(config_root.glob("config.yaml.lexiconforge-backup-*"))) == 1
    assert not (config_root / "executed").exists()


@pytest.mark.parametrize("text,expected", [("[]", "must be a mapping"), ("listen: false\nlisten: true", "invalid YAML"), ("x" * (1024 * 1024 + 1), "exceeds the 1 MiB limit")], ids=["non-mapping", "duplicate-key", "oversized"])
def test_config_boundaries_fail_without_target_code(config_root, text, expected) -> None:
    (config_root / "config.yaml").write_text(text, encoding="utf-8")
    result = configure(config_root)
    assert result.returncode != 0
    assert expected in result.stderr
    assert not (config_root / "executed").exists()


def test_both_preparation_paths_verify_source_before_installation() -> None:
    for relative in ("deploy/windows/apply-sillytavern-hardening.ps1", "deploy/macos/prepare-sillytavern.sh"):
        text = (BRIDGE / relative).read_text(encoding="utf-8")
        assert text.index("verify-sillytavern-source.mjs") < text.rindex("npm ci --ignore-scripts")
    hardener = (BRIDGE / "deploy/windows/apply-sillytavern-hardening.ps1").read_text(encoding="utf-8")
    assert "merge-base --is-ancestor" not in hardener
    assert "Accepted history-independent" not in hardener


def test_unrecognized_source_is_rejected_before_mac_installation(source, tmp_path: Path) -> None:
    root, _ = source
    tools = tmp_path / "tools"
    tools.mkdir()
    marker = tmp_path / "install-executed"
    npm = tools / "npm"
    npm.write_text("#!/bin/sh\ntouch '" + str(marker) + "'\nexit 99\n", encoding="utf-8")
    npm.chmod(0o755)
    result = subprocess.run([
        "bash", str(BRIDGE / "deploy/macos/prepare-sillytavern.sh"),
        "--runtime-root", str(root), "--apply",
    ], capture_output=True, text=True, env={**os.environ, "PATH": str(tools) + os.pathsep + os.environ["PATH"]})
    assert result.returncode != 0
    assert "exact reviewed official" in result.stderr
    assert not marker.exists()
