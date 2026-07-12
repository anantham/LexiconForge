#!/usr/bin/env python
"""Inspect aligned pairs. For auditing alignment quality.

  python scripts/grounding/dump_pairs.py --unit 6 --start 0 --count 30
  python scripts/grounding/dump_pairs.py --unit 6 --filter unanchored
  python scripts/grounding/dump_pairs.py --unit 6 --filter outlier
  python scripts/grounding/dump_pairs.py --unit 6 --filter clause   # clause-split pairs only
"""
import argparse, json, math, re

_STOP = set(("the a an of to in on at is are was were be been being and or but it its this that "
             "these those with for as by from you your i me my he she they them we us not no so "
             "if then there here what which who will would can could shall should may might must "
             "do does did have has had one all any out up down off over about into").split())


def words(t):
    return [w for w in re.findall(r"[a-zA-Z']+", (t or "").lower()) if len(w) > 2 and w not in _STOP]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", default="data/calvino/reader-payload.json")
    ap.add_argument("--unit", type=int, required=True)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--count", type=int, default=25)
    ap.add_argument("--filter", choices=["all", "unanchored", "outlier", "clause"], default="all")
    a = ap.parse_args()

    d = json.load(open(a.payload, encoding="utf-8"))
    u = next(x for x in d["units"] if x["n"] == a.unit)
    pairs = [p for b in u["blocks"] for p in b["pairs"]]
    li = [sum(len(t["s"]) for t in p["it"]) for p in pairs]
    le = [len(p["en"]) for p in pairs]
    c = (sum(le) or 1) / (sum(li) or 1)

    print(f"# unit {u['n']} — {u['title']} — {len(pairs)} pairs")
    shown = 0
    for i, p in enumerate(pairs):
        it = "".join(t["s"] + (" " if t.get("ws", True) else "") for t in p["it"]).strip()
        en = p["en"]
        ib = set()
        for t in p["it"]:
            for g in (t.get("g") or [])[:2]:
                ib.update(words(g))
        eb = set(words(en))
        anchored = bool(ib & eb)
        z = abs((le[i] - li[i] * c) / math.sqrt(max(li[i], 1) * 6.8))
        is_clause = it.rstrip().endswith((";", ":", "—")) or bool(re.search(r"[;:—]", it))

        if a.filter == "unanchored" and (anchored or not (ib and eb)):
            continue
        if a.filter == "outlier" and not (z > 4 and li[i] >= 20):
            continue
        if a.filter == "clause" and not is_clause:
            continue
        if a.filter == "all" and not (a.start <= i < a.start + a.count):
            continue
        shown += 1
        if shown > a.count:
            break
        flag = ("" if anchored else " [UNANCHORED]") + (" [OUTLIER z=%.1f]" % z if z > 4 else "")
        print(f"\n[{i}]{flag}\n  IT: {it}\n  EN: {en}")


if __name__ == "__main__":
    main()
