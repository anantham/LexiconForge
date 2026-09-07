#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
bridge_root="$(cd "$script_dir/../.." && pwd -P)"
runtime_root="${LF_ST_ROOT:-}"
apply=false
fail() { printf 'SillyTavern preparation failed: %s\n' "$1" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runtime-root) [[ $# -ge 2 ]] || fail '--runtime-root requires a path'; runtime_root="$2"; shift 2 ;;
    --apply) apply=true; shift ;;
    --help|-h) printf '%s\n' 'Usage: prepare-sillytavern.sh [--runtime-root PATH] [--apply]'; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

[[ -n "$runtime_root" ]] || fail 'set LF_ST_ROOT or pass --runtime-root for the approved checkout'
[[ -d "$runtime_root" ]] || fail "runtime directory is missing: $runtime_root"
runtime_root="$(cd "$runtime_root" && pwd -P)"
for executable in git node npm diff; do
  command -v "$executable" >/dev/null || fail "required executable is missing: $executable"
done
[[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 20 ]] \
  || fail 'SillyTavern 1.18.0 requires Node 20 or newer'
[[ "$(git -C "$runtime_root" rev-parse --show-toplevel)" == "$runtime_root" ]] \
  || fail 'runtime must be the Git checkout root'
[[ "$(git -C "$runtime_root" rev-parse HEAD)" == '51ad27fb86d39a3daca3adaa970375c9670c12df' ]] \
  || fail 'runtime must be the reviewed official SillyTavern 1.18.0 commit'
git -C "$runtime_root" diff --cached --quiet || fail 'runtime contains staged changes'

base_pair=$'12c30fc061e38c0a35becca70fab9c6fb991a7f0\n95b4dbc33c62829e2aff383f286889ebdcc15ffd'
hardened_pair=$'47898a96d79c053a90acb5502283161ff8c49b16\nc4f410036f0dfe5194764ae56620eb76a362ea44'
manifest_pair="$(cd "$runtime_root" && git hash-object -- package.json package-lock.json)"
[[ "$manifest_pair" == "$base_pair" || "$manifest_pair" == "$hardened_pair" ]] \
  || fail 'working manifests must be the exact reviewed base or hardened pair'

extension_source="$bridge_root/st-extension"
extension_target="$runtime_root/public/scripts/extensions/lexiconforge-portal"
[[ -f "$extension_source/manifest.json" ]] || fail 'reviewed extension source is missing'
if [[ -e "$extension_target" ]]; then
  diff -qr "$extension_source" "$extension_target" >/dev/null \
    || fail 'installed extension differs from the reviewed source; reconcile it before preparation'
fi
dirty="$(git -C "$runtime_root" status --porcelain --untracked-files=normal)"
while IFS= read -r entry; do
  [[ -n "$entry" ]] || continue
  file="${entry:3}"
  case "$file" in
    package.json|package-lock.json|public/scripts/extensions/lexiconforge-portal/) continue ;;
  esac
  [[ "$file" =~ ^config\.yaml\.lexiconforge-backup-[0-9]+$ ]] \
    || fail "unrelated uncommitted path: $file"
done <<< "$dirty"

if [[ "$manifest_pair" == "$base_pair" ]]; then
  [[ "$apply" == true ]] || fail 'reviewed Multer overlay is required; run with --apply'
  overlay="$bridge_root/security/sillytavern-1.18.0-multer-2.2.0.patch"
  git -C "$runtime_root" apply --check "$overlay"
  git -C "$runtime_root" apply "$overlay"
fi
[[ "$(cd "$runtime_root" && git hash-object -- package.json package-lock.json)" == "$hardened_pair" ]] \
  || fail 'overlay did not produce the exact reviewed hardened pair'

if [[ "$apply" == true ]]; then
  printf '%s\n' 'Installing the reviewed lock with lifecycle scripts disabled.'
  (cd "$runtime_root" && npm ci --ignore-scripts)
fi
node -e '
  const fs = require("node:fs"), path = require("node:path");
  const file = path.join(process.argv[1], "node_modules/multer/package.json");
  const installed = JSON.parse(fs.readFileSync(file, "utf8")).version;
  if (installed !== "2.2.0") throw new Error(`Installed Multer must be 2.2.0; found ${installed}`);
' "$runtime_root"
(cd "$runtime_root" && npm ls --omit=dev --all --package-lock-only=false --json >/dev/null) \
  || fail 'installed production dependency tree is incomplete or invalid; run with --apply to reinstall the reviewed lock'

if [[ ! -f "$runtime_root/config.yaml" && "$apply" == true ]]; then
  cp "$runtime_root/default/config.yaml" "$runtime_root/config.yaml"
fi
config_args=(--root "$runtime_root" --local-only)
[[ "$apply" != true ]] || config_args+=(--apply)
node "$bridge_root/deploy/windows/configure-sillytavern-security.mjs" "${config_args[@]}"

if [[ ! -e "$extension_target" ]]; then
  [[ "$apply" == true ]] || fail 'reviewed extension is missing; run with --apply'
  cp -R "$extension_source" "$extension_target"
fi
diff -qr "$extension_source" "$extension_target" >/dev/null || fail 'extension verification failed'
printf 'Reviewed source, dependencies, loopback configuration and extension verified at %s.\n' "$runtime_root"
