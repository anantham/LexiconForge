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
# The closing-quote run is a CAPTURE GROUP: re.split removes the whole match, so an
# uncaptured ["”»)]* silently DELETED closing quotes from every sentence that ends
# inside dialogue (watch TV!” -> watch TV!). Captured, split returns them as segments
# and split_sentences reattaches them to the sentence they close.
_SENT_RE = re.compile(r'(?<=[.!?…])(["\'”»\)\]]*)\s+(?=[A-Z"“«\'(—])')


_ABBR_TAIL = re.compile(r"\b(?:Mr|Mrs|Ms|Dr|St|Mme|Mlle|Prof|Sig|etc|vs)\.$", re.I)


def split_sentences(text):
    """Sentence split that reattaches captured closing quotes and does NOT fire on a
    title abbreviation's period ("Mr.")."""
    parts = _SENT_RE.split(text or "")
    # with one capture group, parts = [seg, closers, seg, closers, ..., seg]
    segs = []
    for i in range(0, len(parts), 2):
        seg = (parts[i] or "") + (parts[i + 1] if i + 1 < len(parts) else "")
        segs.append(seg)
    out = []
    for p in segs:
        p = p.strip()
        if not p:
            continue
        if out and _ABBR_TAIL.search(out[-1]):
            out[-1] = (out[-1] + " " + p).strip()
        else:
            out.append(p)
    return out


_PRIORS = {(1, 1): 0.89, (1, 0): 0.0099, (0, 1): 0.0099,
           (2, 1): 0.089, (1, 2): 0.089, (2, 2): 0.011,
           (1, 3): 0.004, (3, 1): 0.004,
           (1, 4): 0.0015, (4, 1): 0.0015, (2, 3): 0.0015, (3, 2): 0.0015}
_S2 = 6.8  # Gale & Church's char-length variance

# PARAGRAPH structure diverges far more than sentence structure: an editor's title line,
# a translator splitting one paragraph in two, a dialogue exchange collapsed into one
# block. The sentence-level bead vocabulary (capped at 1:4) cannot express those, and an
# inexpressible bead forces the DP into a wrong local optimum that cascades forward.
_PRIORS_PARA = dict(_PRIORS)
for _k in [(1, 5), (5, 1), (1, 6), (6, 1), (2, 4), (4, 2), (3, 3), (2, 5), (5, 2)]:
    _PRIORS_PARA[_k] = 0.0008


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


# Optional cross-lingual embedding anchor (scripts/grounding/embeddings.py).
# Set in main() when --embed-cache is given; None keeps the pure gloss-bag path.
EMB = None


def _item_text(item):
    """Text of an alignment item: a token list (Italian) or a plain string (English)."""
    if isinstance(item, str):
        return item
    return "".join(t["s"] + (" " if t.get("ws", True) else "") for t in item).strip()


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


def align_sentences(it_sents, en_sents, lex_weight=8.0, priors=None):
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

    # Embedding anchor: cross-lingual cosine per candidate span. Stronger evidence
    # than gloss bags (the gloss anchor's proven ceiling), so it carries more weight.
    it_vecs = en_vecs = None
    if EMB is not None:
        from embeddings import span_sim
        it_vecs = EMB.vectors([_item_text(x) for x in it_sents])
        en_vecs = EMB.vectors([_item_text(x) for x in en_sents])

    def cost(i0, i1, j0, j1):
        li = sum(it_lens[i0:i1]); lj = sum(en_lens[j0:j1])
        base = -math.log((priors or _PRIORS).get((i1 - i0, j1 - j0), 1e-4))
        if li or lj:
            mean = max(li, 1) * c
            z = abs((lj - mean) / math.sqrt(max(li, 1) * _S2))
            base += -math.log(max(2.0 * (1.0 - _cdf(z)), 1e-12))
        if it_vecs is not None and i1 > i0 and j1 > j0:
            from embeddings import span_sim as _ss
            base -= 14.0 * _ss(it_vecs, en_vecs, i0, i1, j0, j1)
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
            for (di, dj) in (priors or _PRIORS):
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


_TERM = (".", "!", "?", "…")
_CLOSERS = set(")]»”\"'")


def _ends_sentence(sent_toks):
    """True only if this run really ends a sentence (terminal punctuation),
    ignoring trailing quotes/brackets. A run ending in ; : - does NOT."""
    for t in reversed(sent_toks):
        srf = t["s"].strip()
        if not srf or srf[-1] in _CLOSERS:
            continue
        return srf.endswith(_TERM)
    return False


def _bead_score(it_sents, en_sents, sb):
    """Mean normalised gloss<->English overlap of a proposed alignment. This is the
    EVIDENCE a bead assignment is right — independent of the length prior that produced it."""
    tot, n = 0.0, 0
    for (i0, i1, j0, j1) in sb:
        if i1 <= i0 or j1 <= j0:
            continue
        ib = set()
        for sgrp in it_sents[i0:i1]:
            ib |= _it_bag(sgrp)
        eb = set(_words(" ".join(en_sents[j0:j1])))
        if ib and eb:
            tot += len(ib & eb) / max(1, min(len(ib), len(eb)))
            n += 1
    return tot / n if n else 0.0


def best_alignment(it_sents, en_sents, weights=(8.0, 14.0, 20.0, 28.0), margin=0.05):
    """Pick the lexical weight PER BEAD on measured evidence, instead of forcing one
    global weight: a high weight rescues drifting passages but corrupts clean ones, and
    no single global value is right for both.

    Prefer the CONSERVATIVE baseline weight and only switch to a more aggressive one on a
    CLEAR win (> margin). Switching on a marginal score gain is how a heavier weight
    silently re-seats a 1:2 bead onto the wrong sentence — an error the drift detector
    cannot see, because both pairs keep some overlap."""
    best = align_sentences(it_sents, en_sents, lex_weight=weights[0])
    best_score = _bead_score(it_sents, en_sents, best)
    for w in weights[1:]:
        sb = align_sentences(it_sents, en_sents, lex_weight=w)
        sc = _bead_score(it_sents, en_sents, sb)
        if sc > best_score + margin:
            best, best_score = sb, sc
    return best


_STRONG = {";", ":", "—", "–"}
_STRONG_RE = re.compile(r'(?<=[;:—–])\s+')


def _clause_tokens(tokens):
    """Split a token run into clauses at STRONG internal punctuation - but NOT inside
    a parenthetical, whose own ; : must not count as a clause seam."""
    out, cur, depth = [], [], 0
    for t in tokens:
        cur.append(t)
        srf = t["s"]
        if srf in "([":
            depth += 1
        elif srf in ")]":
            depth = max(0, depth - 1)
        elif srf in _STRONG and depth == 0:
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    out = [c for c in out if any(x["s"].strip(" ,.") for x in c)]
    # same rule as the English side: a run with no letters is not a clause
    merged = []
    for c in out:
        if merged and not any(re.search(r"[^\W\d_]", t["s"], re.UNICODE) for t in c):
            merged[-1] = merged[-1] + c
        else:
            merged.append(c)
    return merged


def _clause_texts(text):
    out, cur, depth = [], "", 0
    for ch in (text or ""):
        cur += ch
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        elif ch in _STRONG and depth == 0:
            out.append(cur); cur = ""
    if cur.strip():
        out.append(cur)
    return _merge_letterless([p.strip() for p in out if p.strip()])


def _merge_letterless(pieces):
    """A "clause" with no letters in it is not a clause.

    Fiction marks INTERRUPTED SPEECH with an em-dash ('"But I--"'), and the dash is not a
    clause seam: splitting there strands the closing quote as its own empty "clause", which
    then consumes a bead slot and drags the whole neighbourhood out of alignment. Merge any
    letterless fragment back into its predecessor — conservation is untouched (the pieces
    still concatenate to the exact surface), we just refuse to call punctuation a clause.
    """
    out = []
    for p in pieces:
        if out and not re.search(r"[^\W\d_]", p, re.UNICODE):
            out[-1] = (out[-1] + " " + p).strip()
        else:
            out.append(p)
    return out


def refine_pair(it_toks, en_text):
    """Shortest RELIABLE phrase. A matching clause COUNT is NOT evidence of matching
    clause ORDER - a translator routinely keeps the count while moving which content
    sits on each side of the seam. So after a count match, require that EVERY clause
    pair shares at least one word between the Italian glosses and the English words
    (when both bags are non-empty). If any clause fails, the evidence does not support
    the split: back off to the whole sentence - coarser, but honest."""
    if not en_text:
        return [{"it": it_toks, "en": en_text}]
    ic = _clause_tokens(it_toks)
    ec = _clause_texts(en_text)
    if len(ic) > 1 and len(ic) == len(ec):
        for a, b in zip(ic, ec):
            ib, eb = _it_bag(a), set(_words(b))
            if ib and eb and not (ib & eb):
                return [{"it": it_toks, "en": en_text}]  # count matched, evidence did not
        if EMB is not None:
            iv = EMB.vectors([_item_text(a) for a in ic])
            ev = EMB.vectors([_item_text(b) for b in ec])
            for k in range(len(ic)):
                if float(iv[k] @ ev[k]) < 0.25:
                    return [{"it": it_toks, "en": en_text}]  # semantically unsupported zip
        return [{"it": a, "en": b, "refined": True} for a, b in zip(ic, ec)]
    return [{"it": it_toks, "en": en_text}]


def _sim(a_text, b_text):
    """Cross-lingual cosine, or gloss-bag overlap when embeddings are off."""
    if EMB is not None:
        v = EMB.vectors([a_text, b_text])
        return float(v[0] @ v[1])
    return 0.0


def repair_pairs(pairs):
    """Two deterministic repairs the monotonic aligner cannot do by construction.

    1. ORPHANED ITALIAN. A (1,0) bead leaves Italian with no English (a dialogue
       stammer whose translation the next bead swallowed). Never leave it stranded:
       merge its tokens into whichever neighbour's English actually covers it.

    2. TRANSLATOR REORDERING. A monotonic DP CANNOT represent a swap, but translators
       reorder sentences freely (Murray puts the description before the reaction where
       Collodi puts the reaction first). If two adjacent pairs each prefer the OTHER's
       English — a mutual cross-preference, not a one-sided hunch — exchange them.
       Conservation is untouched: the same strings, re-seated.
    """
    if not pairs:
        return pairs

    # --- 1. orphaned Italian (empty English) ---
    # A (1,0) bead leaves Italian with no English (a dialogue stammer whose translation
    # the next bead swallowed). Never strand it and NEVER drop it: carry the tokens
    # forward and attach them to whichever neighbour's English actually covers them.
    # Carrying (rather than merging into an arbitrary neighbour) preserves token ORDER
    # by construction — an earlier version scrambled consecutive orphans and lost a
    # block outright, which invariant I1 caught.
    merged, pending = [], []
    for p in pairs:
        if not p["en"].strip():
            pending.extend(p["it"])
            continue
        if pending:
            prev = merged[-1] if merged else None
            it_text = _item_text(pending)
            sp = _sim(it_text, prev["en"]) if prev is not None else -1.0
            sn = _sim(it_text, p["en"])
            if prev is not None and sp > sn:
                prev["it"] = prev["it"] + pending      # sits after prev's tokens: order held
            else:
                p["it"] = pending + p["it"]            # sits before p's tokens: order held
            pending = []
        merged.append(p)
    if pending:
        if merged:
            merged[-1]["it"] = merged[-1]["it"] + pending
        else:
            merged.append({"it": pending, "en": ""})
    pairs = merged

    return pairs


def mark_reorderings(pairs):
    """--- translator REORDERING: detect and DISCLOSE, never silently "repair" ---
    # A monotonic DP cannot represent a swap, and swapping the English here was tried
    # and REJECTED: on rapid dialogue, adjacent short lines have near-identical
    # embeddings, so a mutual-preference test misfires and REVERSES correctly-ordered
    # lines (invariant I2, which pins English to witness ORDER, caught it corrupting the
    # text). Conservation is the stronger guarantee. So when two adjacent pairs each
    # decisively prefer the other's English — the signature of a source-side reordering,
    # not an aligner bug — MARK both and let the reader see the pairing is uncertain.
    Runs UNIT-WIDE, not per paragraph block: a reordering routinely straddles a
    paragraph boundary, and a per-block scan simply cannot see it.
    """
    if EMB is not None:
        MARGIN, MIN_CHARS = 0.10, 60
        for i in range(len(pairs) - 1):
            a, b = pairs[i], pairs[i + 1]
            if not a["en"].strip() or not b["en"].strip():
                continue
            ita, itb = _item_text(a["it"]), _item_text(b["it"])
            if len(ita) < MIN_CHARS or len(itb) < MIN_CHARS:
                continue
            v = EMB.vectors([ita, itb, a["en"], b["en"]])
            a_own, a_other = float(v[0] @ v[2]), float(v[0] @ v[3])
            b_own, b_other = float(v[1] @ v[3]), float(v[1] @ v[2])
            if a_other > a_own + MARGIN and b_other > b_own + MARGIN:
                for q in (a, b):
                    q["reorder"] = True
                    q["conf"] = "low"
    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", required=True)
    ap.add_argument("--grounded", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--embed-cache", default=None,
                    help="npz vector cache; enables the cross-lingual embedding anchor")
    args = ap.parse_args()

    global EMB
    if args.embed_cache:
        import sys as _sys, os as _os
        _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
        from embeddings import SentenceSim
        EMB = SentenceSim(args.embed_cache)
        print(f"embedding anchor ON (cache: {args.embed_cache})")

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
        # Paragraph alignment ALSO gets the lexical anchor: a paragraph misaligned on
        # length alone cascades into every sentence inside it (the worst failure class).
        # align_sentences takes exactly this shape (token-lists vs strings).
        beads = align_sentences(it_paras, en_paras, priors=_PRIORS_PARA)

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
            # spaCy splits Calvino's ;/:-chained sentences into fake "sentences" whose
            # last real token is ; or : - Weaver's single English sentence cannot match
            # them, forcing the DP into a wrong local optimum that cascades. Glue them.
            merged = []
            for sgrp in it_sents:
                if merged and not _ends_sentence(merged[-1]):
                    merged[-1].extend(sgrp)
                else:
                    merged.append(sgrp)
            it_sents = merged
            en_sents = split_sentences(en_text)
            if not en_sents:
                pairs = [{"it": s, "en": ""} for s in it_sents]
                if pending_en and pairs:
                    pairs[0]["en"] = pending_en
                    pending_en = ""
                blocks.append({"pairs": pairs})
                continue
            sb = best_alignment(it_sents, en_sents)
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
                shape = [i1 - i0, j1 - j0]
                for pr in refine_pair([t for s in it_sents[i0:i1] for t in s], en_txt):
                    pr["beadShape"] = shape
                    pairs.append(pr)
            blocks.append({"pairs": pairs})
        if pending_en and blocks and blocks[-1]["pairs"]:
            last = blocks[-1]["pairs"][-1]
            last["en"] = (last["en"] + " " + pending_en).strip()

        for b in blocks:
            b["pairs"] = repair_pairs(b["pairs"])
        blocks = [b for b in blocks if b["pairs"]]
        mark_reorderings([pr for b in blocks for pr in b["pairs"]])

        # ---- per-pair alignment CONFIDENCE (deterministic) ----
        # The heuristic has a real ceiling on literary translation. Rather than hide the
        # residual, score it: a pair whose Italian glosses find NO support in its own
        # English (or whose length is wildly off) is marked, so the reader is told the
        # pairing is uncertain instead of being quietly shown the wrong sentence.
        allp = [pr for b in blocks for pr in b["pairs"]]
        li = [sum(len(t["s"]) for t in pr["it"]) for pr in allp]
        le = [len(pr["en"]) for pr in allp]
        cratio = (sum(le) or 1) / (sum(li) or 1)
        for k, pr in enumerate(allp):
            ib = _it_bag(pr["it"])
            eb = set(_words(pr["en"]))
            z = 0.0
            if li[k] >= 20:
                z = abs((le[k] - li[k] * cratio) / math.sqrt(max(li[k], 1) * _S2))
            if ib and eb:
                lex = len(ib & eb) / max(1, min(len(ib), len(eb)))
                if lex == 0 or z > 4:
                    pr["conf"] = "low"
                elif lex < 0.12:
                    pr["conf"] = "mid"
            elif z > 4:
                pr["conf"] = "low"

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
    if EMB is not None:
        EMB.save()
    tot = sum(len(p["it"]) for u in units for b in u["blocks"] for p in b["pairs"])
    nblocks = sum(len(u["blocks"]) for u in units)
    print(f"wrote {args.out}: {len(units)} units, {nblocks} aligned blocks, glosses={'yes' if glosses else 'no'}")

if __name__ == "__main__":
    main()
