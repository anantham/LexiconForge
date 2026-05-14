#!/usr/bin/env python3
"""
Wire packet-level citations to senses via citationIds.

Grounding architecture Phase 0 (docs/sutta-studio/GROUNDING.md):
without this wiring, the 32 minted citations are ORPHANED — they exist in
packet.citations[] but no Sense's citationIds points at them, so the
clickable chips never render.

Matching strategy (conservative, lemma-based):
  - For each Pāli word, build its full surface from segments.
  - If the word's surface matches a citation's `query` field, attach
    that citation's ID to every Sense of the word.
  - Also check per-segment: if a segment's text matches a citation
    query (sub-word lemmas like 'eka' in 'ekaṁ'), attach to the
    parent word's senses.

This is the simplest correct wiring — every dictionary entry that
applies to a word gets surfaced on every sense of that word. A
later refinement (Phase 2 of GROUNDING) can do per-sense matching
based on POS / gloss similarity.

Idempotent — skips citation IDs already present on a sense.

Usage:
    python3 scripts/sutta-studio/wire-citation-ids.py
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

PACKET_PATH = Path(__file__).resolve().parents[2] / "components/sutta-studio/demoPacket.json"


def main() -> int:
    with PACKET_PATH.open() as f:
        packet = json.load(f)

    citations = packet.get("citations", [])
    if not citations:
        print("No citations in packet — nothing to wire.")
        return 0

    # Index citations by their `query` field.
    by_query = defaultdict(list)
    for c in citations:
        q = c.get("query")
        if q:
            by_query[q].append(c["id"])

    senses_touched = 0
    chips_added = 0
    senses_seen = 0

    for phase in packet.get("phases", []):
        for word in phase.get("paliWords", []):
            # Collect all citation IDs that apply to this word.
            relevant_ids = set()

            # Word-level match: surface == query
            surface = "".join(s.get("text", "") for s in word.get("segments", []))
            for cid in by_query.get(surface, []):
                relevant_ids.add(cid)

            # Segment-level match
            for seg in word.get("segments", []):
                for cid in by_query.get(seg.get("text", ""), []):
                    relevant_ids.add(cid)

            if not relevant_ids:
                continue

            # Attach to every sense of this word.
            for sense in word.get("senses", []):
                senses_seen += 1
                existing = set(sense.get("citationIds", []))
                new_ids = relevant_ids - existing
                if new_ids:
                    chips_added += len(new_ids)
                    senses_touched += 1
                    sense["citationIds"] = sorted(existing | relevant_ids)

    if senses_touched == 0:
        print("Nothing wired — all matching senses already have their citation IDs.")
        return 0

    with PACKET_PATH.open("w") as f:
        json.dump(packet, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(
        f"Wired {chips_added} citation references across {senses_touched} senses."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
