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
    ap.add_argument("--max-drift", type=float, default=0.0)
    args = ap.parse_args()

    payload = json.load(open(args.payload, encoding="utf-8"))
    session = json.load(open(args.session, encoding="utf-8"))
    en_of = {c["stableId"]: (c.get("fanTranslation") or "") for c in session["chapters"]}

    errors, warns = [], []
    tot_pairs = unanchored = outliers = 0
    refined_pairs = unanchored_refined = 0
    drift = []
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

        # ---- I2: english conservation — EXACT, not filtered ----
        # A filtered word-bag comparison is blind to swallowed phrases made only of
        # stopwords/short words ("So do I.") or digits ("Here is 115."). Compare the
        # FULL normalised character stream: every character of the witness, in order.
        # Whitespace-free streams: pair-joining legitimately reflows spacing (clause
        # splits, carried English), but every non-space CHARACTER must survive in order.
        src_t = re.sub(r"\s+", "", en_of[uid] or "")
        got_t = re.sub(r"\s+", "", " ".join(p["en"] for p in pairs))
        if src_t != got_t:
            k = next((j for j, (a, b) in enumerate(zip(src_t, got_t)) if a != b),
                     min(len(src_t), len(got_t)))
            errors.append(f"[I2] unit {un}: English not conserved EXACTLY "
                          f"(witness {len(src_t)} chars, pairs {len(got_t)}; first divergence at "
                          f"char {k}: witness '...{src_t[max(0,k-30):k+30]}...' vs "
                          f"pairs '...{got_t[max(0,k-30):k+30]}...')")

        # ---- I5: NEIGHBOUR-LEXICAL-DOMINANCE (the local-correspondence check) ----
        # Global conservation (I1/I2) cannot see a pair-i/pair-i+1 content SWAP: the flat
        # concatenation is unchanged. This is the direct mechanical signature of drift —
        # the Italian's glosses match the NEXT pair's English better than their own.
        for i in range(len(pairs) - 1):
            ib = it_bag(pairs[i]["it"])
            own = set(words(pairs[i]["en"]))
            nxt = set(words(pairs[i + 1]["en"]))
            if not ib or not own or not nxt:
                continue
            own_n, nxt_n = len(ib & own), len(ib & nxt)
            # CALIBRATED on inspection: a bare "next overlaps by one more" fires on ~50
            # pairs that are CORRECTLY aligned — a gloss bag shares one common word with
            # the neighbour by coincidence (e.g. "Ora si."/"Now." trips on 'yes'). The
            # diagnostic signal is: NO support for its own English, and clearly more for
            # the next. Everything else is noise, and thresholding noise hides real bugs.
            if own_n == 0 and nxt_n - own_n >= 2:
                drift.append((un, i))

        # ---- I6: orphaned swallow (empty English, then an oversized neighbour) ----
        for i in range(len(pairs) - 1):
            if pairs[i]["en"].strip():
                continue
            if pairs[i]["it"] and len(pairs[i + 1]["en"]) > 2.5 * max(
                    sum(len(t["s"]) for t in pairs[i + 1]["it"]), 1):
                errors.append(f"[I6] unit {un} pair {i}: empty English followed by an oversized neighbour "
                              f"(dropout-then-dump signature)")

        last_in_block = set()
        k = 0
        for b in u["blocks"]:
            k += len(b["pairs"])
            if b["pairs"]:
                last_in_block.add(k - 1)

        for i, p in enumerate(pairs):
            tot_pairs += 1
            if p.get("refined"):
                refined_pairs += 1
            # ---- I3 ----
            if not p["it"]:
                errors.append(f"[I3] unit {un} pair {i}: empty Italian side")
                continue
            # ---- I8: a NON-refined, NON-block-final pair must not end at a ; : seam.
            # A paragraph may legitimately END on ';' (Calvino writes semicolon-separated
            # LIST items, each its own paragraph) — that is the real text, not a fake
            # boundary. Only a ';'-ending fragment with MORE text still to come inside the
            # same paragraph is a missed glue.
            if (not p.get("refined") and i not in last_in_block
                    and p["it"][-1]["s"] in (";", ":", "\u2014", "\u2013")):
                errors.append(f"[I8] unit {un} pair {i}: mid-paragraph pair ends at a '{p['it'][-1]['s']}' seam "
                              f"(fake sentence boundary not glued)")
            it_text = "".join(t["s"] + (" " if t.get("ws", True) else "") for t in p["it"]).strip()
            gran.append(len(it_text))
            # ---- Q1: lexical anchor ----
            ib, eb = it_bag(p["it"]), set(words(p["en"]))
            if ib and eb and not (ib & eb):
                unanchored += 1
                if p.get("refined"):
                    unanchored_refined += 1

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
    ur = unanchored_refined / refined_pairs if refined_pairs else 0
    print(f"[I7] clause-refined pairs: {refined_pairs}; of those unanchored: {unanchored_refined} ({ur:.1%})")
    dr = len(drift) / tot_pairs if tot_pairs else 0
    print(f"[I5] neighbour-dominant (drift signature): {len(drift)} ({dr:.2%})  threshold {args.max_drift:.2%}")
    if drift[:10]:
        print("     e.g. " + ", ".join(f"u{u}p{i}" for u, i in drift[:10]))
    if dr > args.max_drift:
        errors.append(f"[I5] {len(drift)} pairs ({dr:.2%}) whose Italian matches the NEXT pair's English better "
                      f"than their own — drift; threshold {args.max_drift:.2%}")

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
