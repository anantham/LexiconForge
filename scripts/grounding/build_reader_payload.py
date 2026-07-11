#!/usr/bin/env python
"""
Build a single reader payload the Calvino reader imports: per unit, the Italian
token stream (surface/lemma/upos/morph + spacing) plus optional Wiktionary senses
and the aligned English witness text.

Degrades gracefully if glosses.json isn't built yet (senses omitted).

Usage:
  python scripts/grounding/build_reader_payload.py \
    --session out/calvino-session.json --grounded data/calvino --out data/calvino/reader-payload.json
"""
import argparse, glob, json, os


def align_paragraphs(it_lens, en_lens):
    """Length-based paragraph alignment (Gale-Church family). Returns a list of
    beads (it_start, it_end, en_start, en_end), allowing 1-1, 1-0, 0-1, 2-1, 1-2,
    2-2 so translator merges/splits pair correctly. Deterministic, no LLM."""
    n, m = len(it_lens), len(en_lens)
    INF = float("inf")
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    ops = [(1, 1, 0.0), (1, 0, 1.2), (0, 1, 1.2), (2, 1, 0.5), (1, 2, 0.5), (2, 2, 0.5)]

    def cost(i0, i1, j0, j1, pen):
        li = sum(it_lens[i0:i1]); lj = sum(en_lens[j0:j1])
        return pen + abs(li - lj) / (li + lj + 1)

    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] == INF:
                continue
            for di, dj, pen in ops:
                if i + di <= n and j + dj <= m:
                    c = dp[i][j] + cost(i, i + di, j, j + dj, pen)
                    if c < dp[i + di][j + dj]:
                        dp[i + di][j + dj] = c
                        back[i + di][j + dj] = (i, j, di, dj)
    beads, i, j = [], n, m
    while (i, j) != (0, 0):
        pi, pj, di, dj = back[i][j]
        beads.append((pi, pi + di, pj, pj + dj))
        i, j = pi, pj
    beads.reverse()
    return beads


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", required=True)
    ap.add_argument("--grounded", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    session = json.load(open(args.session, encoding="utf-8"))
    english = {c["stableId"]: (c.get("fanTranslation") or "") for c in session["chapters"]}
    titles = {c["stableId"]: c.get("title") for c in session["chapters"]}

    gloss_path = os.path.join(args.grounded, "glosses.json")
    glosses = json.load(open(gloss_path, encoding="utf-8")) if os.path.exists(gloss_path) else {}
    if glosses:
        print(f"glosses: {len(glosses)} lemmas")
    else:
        print("glosses: none yet (senses omitted; rebuild after glosses.json lands)")

    # Wiktionary "form-of" glosses ("inflection of stare", "plural of staio") are
    # noise — the base lemma already carries the real definition. Drop them unless
    # nothing else survives.
    FORM_OF = ("inflection of", "plural of", "singular of", "feminine ", "masculine ",
               "past participle of", "gerund of", "present participle of", "form of",
               "alternative ", "obsolete ", "misspelling of", "abbreviation of")

    def senses_for(lemma):
        e = glosses.get((lemma or "").lower())
        if not e:
            return []
        real, formof = [], []
        for pos, sl in e.items():
            for s in sl:
                bucket = formof if s.lower().startswith(FORM_OF) else real
                if s not in bucket:
                    bucket.append(s)
        return (real or formof)[:3]

    units = []
    for ch in session["chapters"]:
        uid = ch["stableId"]
        gp = os.path.join(args.grounded, f"{uid}.grounded.json")
        toks = []
        if os.path.exists(gp):
            g = json.load(open(gp, encoding="utf-8"))
            for s in g["sentences"]:
                for t in s["tokens"]:
                    tok = {"s": t["surface"], "ws": t.get("ws", True)}
                    if t.get("pbr"):
                        tok["pbr"] = True
                    if t.get("isAlpha") and t["upos"] in ("NOUN","VERB","ADJ","ADV","PROPN","PRON","DET","ADP","AUX","NUM","SCONJ","CCONJ"):
                        tok["l"] = t["lemma"]
                        tok["p"] = t["upos"]
                        if t.get("morph"):
                            tok["m"] = t["morph"]
                        se = senses_for(t["lemma"])
                        if se:
                            tok["g"] = se
                    toks.append(tok)

        # Group Italian tokens into paragraphs (pbr flag), split English on blank
        # lines, and align the two paragraph streams by LENGTH (Gale-Church style,
        # deterministic, no LLM) so 2:1 / 1:2 merges pair correctly instead of drifting.
        it_paras, cur = [], []
        for tok in toks:
            cur.append(tok)
            if tok.get("pbr"):
                it_paras.append(cur); cur = []
        if cur:
            it_paras.append(cur)
        en_paras = [p.strip() for p in (english[uid] or "").split("\n\n") if p.strip()]
        it_lens = [sum(len(t["s"]) for t in p) for p in it_paras]
        en_lens = [len(p) for p in en_paras]
        beads = align_paragraphs(it_lens, en_lens)
        blocks = [{"it": it_paras[a:b], "en": en_paras[c:d]} for (a, b, c, d) in beads]

        units.append({
            "n": ch["chapterNumber"],
            "id": uid,
            "title": titles[uid],
            "blocks": blocks,
        })

    payload = {
        "work": session.get("novels", [{}])[0].get("title", "Se una notte d'inverno un viaggiatore"),
        "witness": "William Weaver (1981)",
        "hasGlosses": bool(glosses),
        "units": units,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(payload, open(args.out, "w", encoding="utf-8"), ensure_ascii=False)
    tot = sum(len(t) for u in units for b in u["blocks"] for p in b["it"] for t in [p])
    nblocks = sum(len(u["blocks"]) for u in units)
    print(f"wrote {args.out}: {len(units)} units, {nblocks} aligned blocks, glosses={'yes' if glosses else 'no'}")

if __name__ == "__main__":
    main()
