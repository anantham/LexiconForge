#!/usr/bin/env python3
"""
Mint clickable URLs on existing citations in demoPacket.json.

Grounding architecture Phase 0 (docs/sutta-studio/GROUNDING.md):
takes existing citations whose `url` field is missing and populates it
with the canonical lookup URL for their provenance.

Idempotent — citations with a URL already set are left untouched.

Provenance → URL pattern map:
    dpd        → https://suttacentral.net/define/{urlencoded(lemma)}
                 (SC hosts DPD; /define/ is the public dictionary
                  page; works for diacritic-encoded lemmas.)

Future provenances (sc-bilara, vri-attha, etc.) will be added here
as their citations start appearing in the data.

Usage:
    python3 scripts/sutta-studio/mint-citation-urls.py
"""

import json
import sys
import urllib.parse
from pathlib import Path
from typing import Optional

PACKET_PATH = Path(__file__).resolve().parents[2] / "components/sutta-studio/demoPacket.json"

URL_TEMPLATES = {
    "dpd": lambda c: f"https://suttacentral.net/define/{urllib.parse.quote(c['query'])}"
    if c.get("query")
    else None,
}


def mint_for_citation(c: dict) -> Optional[str]:
    """Return a minted URL for citation `c` or None if not applicable."""
    if c.get("url"):
        return None  # idempotent: don't overwrite

    prov = c.get("provenance")
    if not prov:
        return None

    minter = URL_TEMPLATES.get(prov)
    if not minter:
        return None

    return minter(c)


def main() -> int:
    with PACKET_PATH.open() as f:
        packet = json.load(f)

    citations = packet.get("citations", [])
    if not citations:
        print("No citations in packet — nothing to mint.")
        return 0

    minted = 0
    skipped_existing = 0
    skipped_no_template = 0

    for c in citations:
        if c.get("url"):
            skipped_existing += 1
            continue

        url = mint_for_citation(c)
        if url is None:
            skipped_no_template += 1
            continue

        c["url"] = url
        minted += 1

    if minted == 0:
        print(
            f"Nothing minted. {skipped_existing} already had URLs; "
            f"{skipped_no_template} had no template match."
        )
        return 0

    with PACKET_PATH.open("w") as f:
        json.dump(packet, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(
        f"Minted {minted} URLs. "
        f"{skipped_existing} already had URLs (idempotent skip); "
        f"{skipped_no_template} had no template match (provenance not yet supported)."
    )

    print("\nSample minted URLs:")
    for c in citations[:5]:
        if c.get("url"):
            print(f"  {c['short']:50s} → {c['url']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
