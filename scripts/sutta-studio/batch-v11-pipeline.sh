#!/bin/bash
# Batch v11 pipeline run on all un-V2-curated phases of MN10.
# Reads OPENROUTER_API_KEY from .env.local. Outputs per-phase JSON files into
# docs/sutta-studio/experiments/.
#
# Cost: ~$0.02 per phase × 42 phases = ~$0.85 with Gemini Flash.
# Wall time: ~25 minutes (sequential, ~35 sec per phase).
#
# Usage:
#   bash scripts/sutta-studio/batch-v11-pipeline.sh
#
# Re-running is safe — overwrites existing experiment files. Skip option:
# set SKIP_EXISTING=1 to skip phases whose output file already exists.

set -e

cd "$(dirname "$0")/../.."

set -a
source .env.local
set +a

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "OPENROUTER_API_KEY not set. Aborting."
  exit 1
fi

# Phases that ARE NOT V2-curated: phase-4 to phase-7, the x/y/z trio, and
# the alphabetic continuation phase-aa through phase-bg.
PHASES=(
  phase-4 phase-5 phase-6 phase-7
  phase-x phase-y phase-z
  phase-aa phase-ab phase-ac phase-ad phase-ae phase-af phase-ag phase-ah
  phase-ai phase-aj phase-ak phase-al phase-am phase-an phase-ao phase-ap
  phase-aq phase-ar phase-as phase-at phase-au phase-av phase-aw phase-ax
  phase-ay phase-az phase-ba phase-bb phase-bc phase-bd phase-be phase-bf
  phase-bg
)

mkdir -p docs/sutta-studio/experiments

total="${#PHASES[@]}"
idx=0
fails=()
total_cost=0

for phase in "${PHASES[@]}"; do
  idx=$((idx + 1))
  out="docs/sutta-studio/experiments/${phase}-v11-output.json"

  if [ "$SKIP_EXISTING" = "1" ] && [ -f "$out" ]; then
    echo "[$idx/$total] $phase  ⏭  skipping (exists)"
    continue
  fi

  echo "[$idx/$total] $phase  ⏳  running..."
  if ./node_modules/.bin/tsx scripts/sutta-studio/run-phase-experiment.ts \
      --phase "$phase" --out "$out" > "/tmp/v11-${phase}.log" 2>&1; then
    cost=$(grep -oE '\$0\.[0-9]+' "/tmp/v11-${phase}.log" | tail -1)
    echo "    ✓ done  $cost"
  else
    echo "    ✗ FAILED — see /tmp/v11-${phase}.log"
    fails+=("$phase")
  fi
done

echo ""
echo "=== Batch complete: $((idx - ${#fails[@]}))/$total succeeded ==="
if [ "${#fails[@]}" -gt 0 ]; then
  echo "Failed phases: ${fails[*]}"
fi
