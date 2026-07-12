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
import argparse, glob, json, math, os, re

# Split English prose into sentences: end punctuation, optional closing quote/bracket,
# whitespace, then an opening capital/quote. Good enough for Weaver's prose.
_SENT_RE = re.compile(r'(?<=[.!?…])["\'”»\)\]]*\s+(?=[A-Z"“«\'(—])')


def split_sentences(text):
    return [p.strip() for p in _SENT_RE.split(text or "") if p.strip()]


_PRIORS = {(1, 1): 0.89, (1, 0): 0.0099, (0, 1): 0.0099,
           (2, 1): 0.089, (1, 2): 0.089, (2, 2): 0.011,
           (1, 3): 0.004, (3, 1): 0.004}
_S2 = 6.8  # Gale & Church's char-length variance


def _cdf(z):
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def align_paragraphs(it_lens, en_lens):
    """Gale-Church length-based alignment. Returns beads (it0, it1, en0, en1),
    allowing 1-1, 1-0, 0-1, 2-1, 1-2, 2-2, 1-3, 3-1 so a translator's merges and
    splits pair correctly instead of drifting. Deterministic, no LLM."""
    n, m = len(it_lens), len(en_lens)
    if n == 0 or m == 0:
        return [(0, n, 0, m)] if (n or m) else []
    tot_i, tot_j = sum(it_lens) or 1, sum(en_lens) or 1
    c = tot_j / tot_i  # mean target/source char ratio, measured from this text

    def bead_cost(i0, i1, j0, j1):
        li = sum(it_lens[i0:i1]); lj = sum(en_lens[j0:j1])
        prior = _PRIORS.get((i1 - i0, j1 - j0), 1e-4)
        if li == 0 and lj == 0:
            return -math.log(prior)
        mean = max(li, 1) * c
        z = abs((lj - mean) / math.sqrt(max(li, 1) * _S2))
        p = max(2.0 * (1.0 - _cdf(z)), 1e-12)
        return -math.log(p) - math.log(prior)

    INF = float("inf")
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] == INF:
                continue
            for (di, dj) in _PRIORS:
                if i + di <= n and j + dj <= m and (di or dj):
                    v = dp[i][j] + bead_cost(i, i + di, j, j + dj)
                    if v < dp[i + di][j + dj]:
                        dp[i + di][j + dj] = v
                        back[i + di][j + dj] = (i, j, di, dj)
    beads, i, j = [], n, m
    while (i, j) != (0, 0):
        if back[i][j] is None:
            beads.append((0, i, 0, j)); break
        pi, pj, di, dj = back[i][j]
        beads.append((pi, pi + di, pj, pj + dj))
        i, j = pi, pj
    beads.reverse()
    return beads


_STOP = set(("the a an of to in on at is are was were be been being and or but it its this that "
             "these those with for as by from you your i me my he she they them we us not no so "
             "if then there here what which who will would can could shall should may might must "
             "do does did have has had one all any out up down off over about into").split())


def _words(text):
    return [w for w in re.findall(r"[a-zA-Z']+", (text or "").lower())
            if len(w) > 2 and w not in _STOP]


def _it_bag(tokens):
    bag = set()
    for t in tokens:
        for g in (t.get("g") or [])[:2]:
            bag.update(_words(g))
    return bag


def align_sentences(it_sents, en_sents, lex_weight=8.0):
    """Gale-Church length model PLUS a LEXICAL anchor taken from the Italian tokens'
    English glosses. Length alone cannot align runs of short sentences
    ("Rilassati." / "Relax." / "Concentrate.") — gloss overlap disambiguates them."""
    n, m = len(it_sents), len(en_sents)
    if n == 0 or m == 0:
        return [(0, n, 0, m)] if (n or m) else []
    it_lens = [sum(len(t["s"]) for t in s) for s in it_sents]
    en_lens = [len(s) for s in en_sents]
    it_bags = [_it_bag(s) for s in it_sents]
    en_bags = [set(_words(s)) for s in en_sents]
    c = (sum(en_lens) or 1) / (sum(it_lens) or 1)

    def cost(i0, i1, j0, j1):
        li = sum(it_lens[i0:i1]); lj = sum(en_lens[j0:j1])
        base = -math.log(_PRIORS.get((i1 - i0, j1 - j0), 1e-4))
        if li or lj:
            mean = max(li, 1) * c
            z = abs((lj - mean) / math.sqrt(max(li, 1) * _S2))
            base += -math.log(max(2.0 * (1.0 - _cdf(z)), 1e-12))
        ib = set().union(*it_bags[i0:i1]) if i1 > i0 else set()
        eb = set().union(*en_bags[j0:j1]) if j1 > j0 else set()
        if ib and eb:
            base -= lex_weight * (len(ib & eb) / max(1, min(len(ib), len(eb))))
        return base

    INF = float("inf")
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] == INF:
                continue
            for (di, dj) in _PRIORS:
                if i + di <= n and j + dj <= m and (di or dj):
                    v = dp[i][j] + cost(i, i + di, j, j + dj)
                    if v < dp[i + di][j + dj]:
                        dp[i + di][j + dj] = v
                        back[i + di][j + dj] = (i, j, di, dj)
    beads, i, j = [], n, m
    while (i, j) != (0, 0):
        if back[i][j] is None:
            beads.append((0, i, 0, j)); break
        pi, pj, di, dj = back[i][j]
        beads.append((pi, pi + di, pj, pj + dj))
        i, j = pi, pj
    beads.reverse()
    return beads


_STRONG = {";", ":", "—", "–"}
_STRONG_RE = re.compile(r'(?<=[;:—–])\s+')


def _clause_tokens(tokens):
    """Split a token run into clauses at STRONG internal punctuation."""
    out, cur = [], []
    for t in tokens:
        cur.append(t)
        if t["s"] in _STRONG:
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    return [c for c in out if any(x["s"].strip(" ,.") for x in c)]


def _clause_texts(text):
    return [p.strip() for p in _STRONG_RE.split(text or "") if p.strip()]


def refine_pair(it_toks, en_text):
    """Shortest RELIABLE phrase: if both sides break into the same number of clauses
    at strong punctuation (; : —), pair them 1:1 — translators preserve these seams.
    If the counts disagree, the evidence doesn't support a finer split, so keep the
    sentence intact rather than inventing a false correspondence."""
    if not en_text:
        return [{"it": it_toks, "en": en_text}]
    ic = _clause_tokens(it_toks)
    ec = _clause_texts(en_text)
    if len(ic) > 1 and len(ic) == len(ec):
        return [{"it": a, "en": b} for a, b in zip(ic, ec)]
    return [{"it": it_toks, "en": en_text}]


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
                    tok["si"] = s["idx"]
                    toks.append(tok)

        # Two-level alignment, both length-based (Gale-Church family, deterministic):
        #   1. paragraphs (Italian pbr flag  <->  English blank lines)
        #   2. SENTENCES within each paragraph bead  <- the reading unit.
        # The sentence is the unit because Weaver's English maps phrase-to-phrase but
        # NOT word-to-word ("per ... a" -> "about to"), so a sentence pair can carry
        # his real prose under the Italian instead of a pidgin word-gloss.
        it_paras, cur = [], []
        for tok in toks:
            cur.append(tok)
            if tok.get("pbr"):
                it_paras.append(cur); cur = []
        if cur:
            it_paras.append(cur)
        en_paras = [p.strip() for p in (english[uid] or "").split("\n\n") if p.strip()]
        beads = align_paragraphs(
            [sum(len(t["s"]) for t in p) for p in it_paras],
            [len(p) for p in en_paras],
        )

        blocks = []
        pending_en = ""  # English with no Italian counterpart — carried, NEVER dropped
        for (a, b, c, d) in beads:
            bead_toks = [t for p in it_paras[a:b] for t in p]
            en_text = " ".join(en_paras[c:d])
            if not bead_toks:
                pending_en = (pending_en + " " + en_text).strip()
                continue
            # regroup this bead's tokens into sentences (spaCy boundaries, via si)
            it_sents, curs, last_si = [], [], None
            for t in bead_toks:
                if last_si is not None and t.get("si") != last_si and curs:
                    it_sents.append(curs); curs = []
                curs.append(t); last_si = t.get("si")
            if curs:
                it_sents.append(curs)
            en_sents = split_sentences(en_text)
            if not en_sents:
                pairs = [{"it": s, "en": ""} for s in it_sents]
                if pending_en and pairs:
                    pairs[0]["en"] = pending_en
                    pending_en = ""
                blocks.append({"pairs": pairs})
                continue
            sb = align_sentences(it_sents, en_sents)
            pairs = []
            for (i0, i1, j0, j1) in sb:
                en_txt = " ".join(en_sents[j0:j1])
                if i1 <= i0:
                    if en_txt:
                        if pairs:
                            pairs[-1]["en"] = (pairs[-1]["en"] + " " + en_txt).strip()
                        else:
                            pending_en = (pending_en + " " + en_txt).strip()
                    continue
                if pending_en:
                    en_txt = (pending_en + " " + en_txt).strip()
                    pending_en = ""
                pairs.extend(refine_pair([t for s in it_sents[i0:i1] for t in s], en_txt))
            blocks.append({"pairs": pairs})
        if pending_en and blocks and blocks[-1]["pairs"]:
            last = blocks[-1]["pairs"][-1]
            last["en"] = (last["en"] + " " + pending_en).strip()

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
    tot = sum(len(p["it"]) for u in units for b in u["blocks"] for p in b["pairs"])
    nblocks = sum(len(u["blocks"]) for u in units)
    print(f"wrote {args.out}: {len(units)} units, {nblocks} aligned blocks, glosses={'yes' if glosses else 'no'}")

if __name__ == "__main__":
    main()
