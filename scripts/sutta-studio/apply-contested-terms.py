#!/usr/bin/env python3
"""
Apply the contested-terms registry to demoPacket.json.

Grounding architecture Phase 1.5 (docs/sutta-studio/GROUNDING.md):
reads data/sutta-studio/grounding/contested-terms.json, converts each
registry entry into Citation objects, adds them to packet.citations[],
and wires citationIds to the senses of phase-words that match the term.

This is the deterministic application of registry data without the
full compiler-pass automation (Phase 2 of GROUNDING). When the registry
is small, this script is the consumer. When the registry grows, a
GroundingProvider + groundingPass replaces this script.

Matching strategy (deliberate over-inclusion for small registry):
  - Word-level: registry term IS a substring of word's full surface
    (catches compounds like 'dukkhadomanassānaṁ' for term 'dukkha')
  - Segment-level: any segment.text EXACTLY equals registry term
    (catches sub-word components)

Citation ID format: `cite:term:<term>:<source-key>` where source-key
is short and stable (e.g., 'sc-bodhi', 'wikipedia', 'thanissaro-mn10').

Idempotent — skips citations already in packet.citations and IDs
already attached to a sense.

Usage:
    python3 scripts/sutta-studio/apply-contested-terms.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKET_PATH = ROOT / "components/sutta-studio/demoPacket.json"
REGISTRY_PATH = ROOT / "data/sutta-studio/grounding/contested-terms.json"


def slugify_url(url: str) -> str:
    """Stable short key derived from URL."""
    if "wikipedia.org" in url:
        return "wikipedia"
    if "dhammatalks.org" in url:
        return "thanissaro-dhammatalks"
    if "suttacentral.net/mn10/en/bodhi" in url:
        return "sc-bodhi-mn10"
    if "suttacentral.net/mn10/en/sujato" in url:
        return "sc-sujato-mn10"
    if "suttacentral.net/mn10/en/anandajoti" in url:
        return "sc-anandajoti-mn10"
    if "windhorsepublications.com" in url:
        return "analayo-monograph"
    if "tipitaka.org" in url:
        return "vri-tipitaka"
    # Fallback — sanitise URL into a short key
    return re.sub(r"[^a-z0-9]+", "-", url.lower())[:40].strip("-")


def collect_citations_for_term(term: str, entry: dict) -> list:
    """Convert a registry entry into Citation objects."""
    citations = []
    seen_urls = set()

    # Walk every dict that has a `url` field and treat it as a citation source.
    def walk(obj, context_label=None):
        if isinstance(obj, dict):
            url = obj.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                source_key = slugify_url(url)
                # Build a descriptive short label
                translator = obj.get("translator")
                rendering = obj.get("rendering")
                source = obj.get("source")  # for encyclopedic refs
                ref = obj.get("ref")  # for primary scholarship
                if translator and rendering:
                    short = f'{translator}: "{rendering}" ({term})'
                elif source:
                    short = f"{source}"
                elif ref:
                    short = ref[:80] + ("…" if len(ref) > 80 else "")
                else:
                    short = f"{term} — source"
                # Excerpt: prefer quotedClaim, context, then note
                excerpt = (
                    obj.get("quotedClaim")
                    or obj.get("context")
                    or obj.get("note")
                    or ""
                )
                verified = obj.get("verified")
                citations.append(
                    {
                        "id": f"cite:term:{term}:{source_key}",
                        "short": short,
                        "url": url,
                        "excerpt": excerpt,
                        "provenance": "manual",
                        "query": term,
                        "fetchedAt": verified or "2026-05-14",
                        "license": (
                            "CC BY-SA 3.0 (Wikipedia)"
                            if "wikipedia" in url
                            else "see source for license"
                        ),
                    }
                )
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(entry)
    return citations


PALI_VOWELS = set("aāiīuūeoṁ")


def term_matches_word(term: str, word: dict) -> bool:
    """Returns True if `term` matches `word`.

    Three match levels:
    1. Exact substring (catches 'dukkha' in 'dukkhadomanassānaṁ')
    2. Stem-prefix (catches 'satipaṭṭhāna' lemma → 'satipaṭṭhānā' nominative,
       where final short-a inflects to long-ā). Strips final Pāli vowel
       from term, requires stem to be a prefix of surface.
    3. Segment exact match
    """
    surface = "".join(s.get("text", "") for s in word.get("segments", []))
    if term in surface:
        return True
    # Stem-prefix: strip final vowel of term, check surface starts with stem.
    if term and term[-1].lower() in PALI_VOWELS and len(term) >= 4:
        stem = term[:-1]
        if surface.startswith(stem):
            return True
    for seg in word.get("segments", []):
        if seg.get("text", "") == term:
            return True
    return False


def main() -> int:
    with REGISTRY_PATH.open() as f:
        registry = json.load(f)
    with PACKET_PATH.open() as f:
        packet = json.load(f)

    existing_citation_ids = {c["id"] for c in packet.get("citations", [])}
    citations_added = 0
    chips_added = 0
    senses_touched = set()

    for term, entry in registry.items():
        if term.startswith("_"):
            continue

        term_citations = collect_citations_for_term(term, entry)
        if not term_citations:
            print(f"  [{term}] no URL-bearing sources found, skipping")
            continue

        # Add new citations to packet
        new_for_term = []
        for c in term_citations:
            if c["id"] not in existing_citation_ids:
                packet.setdefault("citations", []).append(c)
                existing_citation_ids.add(c["id"])
                citations_added += 1
                new_for_term.append(c["id"])

        # Wire ALL term citations (new and pre-existing) to matching word senses
        all_term_cite_ids = [c["id"] for c in term_citations]

        for phase in packet.get("phases", []):
            for word in phase.get("paliWords", []):
                if not term_matches_word(term, word):
                    continue
                for sense in word.get("senses", []):
                    existing = set(sense.get("citationIds", []))
                    additions = [
                        cid for cid in all_term_cite_ids if cid not in existing
                    ]
                    if additions:
                        sense["citationIds"] = sorted(existing | set(additions))
                        chips_added += len(additions)
                        senses_touched.add(f'{phase.get("id")}/{word.get("id")}')

        print(
            f"  [{term}] {len(term_citations)} citations "
            f"({len(new_for_term)} new); matched word senses across "
            f"{len([t for t in senses_touched if t.startswith(phase.get('id','')) ])} phase-words"
        )

    if citations_added == 0 and chips_added == 0:
        print("Nothing changed — already applied (idempotent).")
        return 0

    with PACKET_PATH.open("w") as f:
        json.dump(packet, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(
        f"\nApplied: {citations_added} new citations; "
        f"{chips_added} citationId references attached across "
        f"{len(senses_touched)} phase-words."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
