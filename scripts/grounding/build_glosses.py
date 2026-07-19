#!/usr/bin/env python
"""
Stage GROUND 2b — gloss layer. Streams a kaikki.org Wiktionary JSONL extract
(one JSON object per line: word/lang/pos/senses[].glosses[]) from stdin and keeps
only the lemmas we actually need, producing a compact lemma -> senses map.

The English glosses come straight from Wiktionary (kaikki extracts English
Wiktionary's entries for the language), so this is a deterministic dictionary
layer — no LLM. Pair with ground_source.py's lemma output.

Usage:
  curl -s <kaikki-jsonl-url> | python build_glosses.py --lemmas lemmas.txt --out glosses.json
"""
import argparse
import json
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lemmas", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.lemmas, encoding="utf-8") as f:
        want = {w.strip().lower() for w in f if w.strip()}
    print(f"want {len(want)} lemmas", file=sys.stderr)

    glosses = {}
    lines = 0
    for line in sys.stdin:
        lines += 1
        if lines % 200000 == 0:
            print(f"  scanned {lines} lines, matched {len(glosses)}", file=sys.stderr)
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        word = (e.get("word") or "").lower()
        if word not in want:
            continue
        pos = e.get("pos")
        senses = []
        for s in e.get("senses", []):
            gl = s.get("glosses") or s.get("raw_glosses")
            if gl:
                senses.append(gl[0] if isinstance(gl, list) else gl)
        if not senses:
            continue
        entry = glosses.setdefault(word, {})
        # keep up to 4 senses per (word,pos)
        entry.setdefault(pos or "?", [])
        for s in senses:
            if s not in entry[pos or "?"] and len(entry[pos or "?"]) < 4:
                entry[pos or "?"].append(s)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(glosses, f, ensure_ascii=False, indent=1)
    print(f"scanned {lines} lines; wrote {len(glosses)}/{len(want)} lemmas ({100*len(glosses)//max(1,len(want))}% covered) to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
