#!/bin/bash
# WORKLOG Auto-Cycling Script — delegates to scripts/ci/cycle-worklog.mjs
# DRY-RUN by default; pass --apply to actually archive. See the .mjs header
# for the 2026-08-22 failure this replaces (bottom-tail archiving ate the
# newest appended entries because the date grep could never match).
exec node "$(dirname "$0")/ci/cycle-worklog.mjs" "$@"
