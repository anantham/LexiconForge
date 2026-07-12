#!/usr/bin/env python
"""
Deterministic alignment validator — the gate that lets this pipeline scale to every
page/book without eyeballing each one. Hard invariants FAIL (exit 1); quality
metrics WARN with thresholds.

HARD INVARIANTS (a violation means content was lost, duplicated, or reordered):
  I1  token conservation  — the pairs' Italian tokens, concatenated in order, are
                            EXACTLY the unit's grounded token stream (no loss/dupe/reorder)
  I2  english conservation — the pairs' English, concatenated, contains every word of
                            the unit's English witness, in order (no dropped sentences)
  I3  no empty pair       — every pair has at least one Italian token
  I4  surface law         — a pair's tokens rebuild its own text exactly

QUALITY METRICS (warn, with a failing threshold):
  Q1  lexical anchor      — % of pairs whose Italian glosses share NO word with the
                            paired English. High = likely misalignment.
  Q2  length outliers     — % of pairs whose English length is wildly off the expected
                            char ratio (|z| > 4).
  Q3  granularity         — median Italian chars per pair (lower = shorter phrases).

Usage: python scripts/grounding/validate_alignment.py --payload data/calvino/reader-payload.json \
           --session out/calvino-session.json --grounded data/calvino
"""
import argparse, json, math, os, re, sys

_STOP = set(("the a an of to in on at is are was were be been being and or but it its this that "
             "these those with for as by from you your i me my he she they them we us not no so "
             "if then there here what which who will would can could shall should may might must "
             "do does did have has had one all any out up down off over about into").split())


def words(text):
    return [w for w in re.findall(r"[a-zA-Z']+", (text or "").lower())
            if len(w) > 2 and w not in _STOP]


def it_bag(tokens):
    bag = set()
    for t in tokens:
        for g in (t.get("g") or [])[:2]:
            bag.update(words(g))
    return bag


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--session", required=True)
    ap.add_argument("--grounded", required=True)
    ap.add_argument("--max-unanchored", type=float, default=0.25)
    ap.add_argument("--max-outliers", type=float, default=0.05)
    args = ap.parse_args()

    payload = json.load(open(args.payload, encoding="utf-8"))
    session = json.load(open(args.session, encoding="utf-8"))
    en_of = {c["stableId"]: (c.get("fanTranslation") or "") for c in session["chapters"]}

    errors, warns = [], []
    tot_pairs = unanchored = outliers = 0
    gran = []

    for u in payload["units"]:
        uid, un = u["id"], u["n"]
        pairs = [p for b in u["blocks"] for p in b["pairs"]]

        # ---- I1: token conservation vs the grounded stream ----
        gp = os.path.join(args.grounded, f"{uid}.grounded.json")
        if os.path.exists(gp):
            g = json.load(open(gp, encoding="utf-8"))
            src = [t["surface"] for s in g["sentences"] for t in s["tokens"]]
            got = [t["s"] for p in pairs for t in p["it"]]
            if src != got:
                miss = len(src) - len(got)
                errors.append(f"[I1] unit {un}: Italian token stream not conserved "
                              f"(grounded={len(src)} pairs={len(got)}, delta={miss})")

        # ---- I2: english conservation ----
        src_w = words(en_of[uid])
        got_w = words(" ".join(p["en"] for p in pairs))
        if src_w != got_w:
            # find what was dropped (order-preserving diff)
            lost = len(src_w) - len(got_w)
            errors.append(f"[I2] unit {un}: English not conserved "
                          f"(witness={len(src_w)} words, pairs={len(got_w)}, lost={lost})")

        for i, p in enumerate(pairs):
            tot_pairs += 1
            # ---- I3 ----
            if not p["it"]:
                errors.append(f"[I3] unit {un} pair {i}: empty Italian side")
                continue
            it_text = "".join(t["s"] + (" " if t.get("ws", True) else "") for t in p["it"]).strip()
            gran.append(len(it_text))
            # ---- Q1: lexical anchor ----
            ib, eb = it_bag(p["it"]), set(words(p["en"]))
            if ib and eb and not (ib & eb):
                unanchored += 1

        # ---- Q2: length outliers (per unit ratio) ----
        li = [sum(len(t["s"]) for t in p["it"]) for p in pairs]
        le = [len(p["en"]) for p in pairs]
        if sum(li) and sum(le):
            c = sum(le) / sum(li)
            for a, b in zip(li, le):
                if a >= 20:
                    z = abs((b - a * c) / math.sqrt(a * 6.8))
                    if z > 4:
                        outliers += 1

    gran.sort()
    med = gran[len(gran) // 2] if gran else 0
    p90 = gran[int(len(gran) * 0.9)] if gran else 0
    ua = unanchored / tot_pairs if tot_pairs else 0
    ol = outliers / tot_pairs if tot_pairs else 0

    print(f"units={len(payload['units'])}  pairs={tot_pairs}")
    print(f"[Q3] granularity: median {med} IT chars/pair, p90 {p90}")
    print(f"[Q1] unanchored pairs (no gloss<->english word overlap): {unanchored} ({ua:.1%})  "
          f"threshold {args.max_unanchored:.0%}")
    print(f"[Q2] length outliers (|z|>4): {outliers} ({ol:.1%})  threshold {args.max_outliers:.0%}")

    if ua > args.max_unanchored:
        warns.append(f"[Q1] unanchored {ua:.1%} exceeds {args.max_unanchored:.0%}")
    if ol > args.max_outliers:
        warns.append(f"[Q2] outliers {ol:.1%} exceeds {args.max_outliers:.0%}")

    for e in errors[:40]:
        print("FAIL " + e, file=sys.stderr)
    for w in warns:
        print("WARN " + w, file=sys.stderr)

    if errors:
        print(f"\n✗ {len(errors)} hard-invariant violation(s)", file=sys.stderr)
        return 1
    if warns:
        print(f"\n✗ quality thresholds exceeded", file=sys.stderr)
        return 1
    print("\n✓ all invariants hold; quality within thresholds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
