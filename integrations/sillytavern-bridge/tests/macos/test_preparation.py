"""Executable Mac preparation probe; only disposable clones are mutated.

Run with --seed pointing to the reviewed upstream checkout with yaml 2.8.3
installed. npm is simulated; this does not certify a real dependency install.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=Path, required=True)
    args = parser.parse_args()
    bridge = Path(__file__).resolve().parents[2]
    script = bridge / "deploy/macos/prepare-sillytavern.sh"
    configurator = bridge / "deploy/windows/configure-sillytavern-security.mjs"
    seed = args.seed.resolve()
    yaml = seed / "node_modules/yaml"
    assert json.loads((yaml / "package.json").read_text())["version"] == "2.8.3"
    assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=seed, text=True).strip() == "51ad27fb86d39a3daca3adaa970375c9670c12df"

    with tempfile.TemporaryDirectory(prefix="lf-macos-preparation-") as temporary:
        fixture = Path(temporary)
        runtime = fixture / "runtime with spaces"
        subprocess.run(["git", "clone", "--shared", str(seed), str(runtime)], check=True, capture_output=True)
        base_lock = (runtime / "package-lock.json").read_bytes()
        tools = fixture / "bin"
        tools.mkdir()
        npm = tools / "npm"
        npm.write_text('''#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == 'ci --ignore-scripts' ]] || exit 91
printf 'install\n' >> "$LF_TEST_INSTALLS"
mkdir -p node_modules/multer
printf '{"version":"2.2.0"}\n' > node_modules/multer/package.json
cp -R "$LF_TEST_YAML" node_modules/yaml
''')
        npm.chmod(0o755)
        installs = fixture / "installs"
        env = dict(os.environ, PATH=f"{tools}:{os.environ['PATH']}", LF_TEST_INSTALLS=str(installs), LF_TEST_YAML=str(yaml))
        env.pop("LF_ST_ROOT", None)
        results = []

        def invoke(name, extra=(), expected=None, command=None):
            result = subprocess.run(command or ["bash", str(script), "--runtime-root", str(runtime), *extra], env=env, text=True, capture_output=True)
            if expected is None:
                assert result.returncode == 0, (name, result.stdout, result.stderr)
            else:
                assert result.returncode != 0 and expected in result.stderr, (name, result.stdout, result.stderr)
            results.append(name)

        def snapshot():
            return {
                str(p.relative_to(runtime)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in runtime.rglob("*") if p.is_file()
                and not {".git", "node_modules"}.intersection(p.relative_to(runtime).parts)
            }

        invoke("explicit runtime root required", expected="set LF_ST_ROOT or pass --runtime-root", command=["bash", str(script)])
        invoke("pristine requests overlay", expected="overlay is required")
        assert not installs.exists()
        invoke("real overlay and loopback configuration", ("--apply",))
        assert installs.read_text().splitlines() == ["install"]
        before = snapshot()
        invoke("first no-write verification")
        invoke("second no-write verification")
        assert snapshot() == before and installs.read_text().splitlines() == ["install"]

        package = runtime / "package.json"
        original = package.read_bytes()
        changed = json.loads(original)
        changed["description"] = "synthetic unreviewed edit"
        package.write_text(json.dumps(changed))
        invoke("changed patched manifest rejected before npm", ("--apply",), "exact reviewed base or hardened pair")
        assert installs.read_text().splitlines() == ["install"]
        package.write_bytes(original)

        lock = runtime / "package-lock.json"
        original = lock.read_bytes()
        lock.write_bytes(base_lock)
        invoke("mixed manifest pair", expected="exact reviewed base or hardened pair")
        lock.write_bytes(original)

        server = runtime / "server.js"
        original = server.read_bytes()
        server.write_bytes(original + b"\n// synthetic change\n")
        invoke("unrelated tracked source", expected="unrelated uncommitted path")
        server.write_bytes(original)
        unknown = runtime / "unexpected-fixture.txt"
        unknown.write_text("synthetic")
        invoke("unrelated untracked file", expected="unrelated uncommitted path")
        unknown.unlink()

        extension = runtime / "public/scripts/extensions/lexiconforge-portal/manifest.json"
        original = extension.read_bytes()
        extension.write_text("{}")
        invoke("changed extension rejected before npm", ("--apply",), "installed extension differs")
        assert installs.read_text().splitlines() == ["install"]
        extension.write_bytes(original)

        installed = runtime / "node_modules/multer/package.json"
        installed.write_text('{"version":"2.1.1"}')
        invoke("wrong installed version", expected="Installed Multer must be 2.2.0")
        installed.write_text('{"version":"2.2.0"}')
        config = runtime / "config.yaml"
        original = config.read_bytes()
        assert b"disableCsrfProtection: false" in original
        config.write_bytes(original.replace(b"disableCsrfProtection: false", b"disableCsrfProtection: true"))
        invoke("disabled CSRF rejected", expected="disableCsrfProtection must be false")
        config.write_bytes(original)

        command = ["node", str(configurator), "--root", str(runtime)]
        invoke("missing boundary rejected", expected="at least one --allowed-ip or --local-only", command=command)
        invoke("mixed boundary rejected", expected="cannot be combined", command=[*command, "--local-only", "--allowed-ip", "100.64.0.1", "--apply"])
        assert config.read_bytes() == original
        invoke("tailnet configuration still supported", command=[*command, "--allowed-ip", "100.64.0.1", "--apply"])
        invoke("tailnet whitelist rejected in local mode", expected="whitelist must contain only loopback")
        invoke("explicit local mode removes tailnet allowance", command=[*command, "--local-only", "--apply"])
        assert config.read_bytes() == original
        invoke("repeat checks accept exact configurator backups")

        subprocess.run(["git", "add", "package.json", "package-lock.json"], cwd=runtime, check=True)
        invoke("staged changes rejected", expected="runtime contains staged changes")
        subprocess.run(["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "synthetic revision"], cwd=runtime, check=True, capture_output=True)
        invoke("different upstream revision rejected", expected="reviewed official SillyTavern 1.18.0 commit")
        assert installs.read_text().splitlines() == ["install"]
        print(json.dumps({"passed": len(results), "cases": results, "npmSimulated": True, "liveRuntimeChanged": False}))


if __name__ == "__main__":
    main()
