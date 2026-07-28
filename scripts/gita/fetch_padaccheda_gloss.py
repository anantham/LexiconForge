#!/usr/bin/env python3
"""
Gītā TIER-1, stage 1 — the linguistic layer (padaccheda + dictionary glosses).
Chapter-parameterized; NO LLM authors any gloss.

For a chapter it:
  1. fetches the mūla wikitext from sa.wikisource (public domain) and extracts
     the verses from the <poem> blocks (the commentaries are ignored),
  2. runs padaccheda on each written word with sanskrit_parser 0.2.6 — a
     RULE-BASED sandhi splitter + morphological stemmer (deterministic, no
     neural model). The written surface is never altered; splitting only feeds
     the gloss lookup (the surface law keeps the printed word whole),
  3. glosses each lemma from Monier-Williams via the Cologne getword.php
     endpoint (transLit=slp1), taking a short first-substantive-sense head-gloss,
     cached to data/gita/mw-cache.json (public domain; committed for
     reproducibility and to show exactly which dictionary text each gloss is
     drawn from),
  4. writes data/gita/chapter<N>-glosses.json — consumed by the TS render
     builder (scripts/gita/build-tier1.ts), which adds the deterministic sound
     layer and emits the AlignSegment[].

Requires (a venv is fine; NOT the app's node deps):
    pip install sanskrit_parser indic_transliteration

Run:
    python scripts/gita/fetch_padaccheda_gloss.py 2
    python scripts/gita/fetch_padaccheda_gloss.py 2 --page भगवद्गीता/साङ्ख्ययोगः
"""
import sys, os, re, json, time, html, argparse, logging, warnings
import urllib.parse, urllib.request

logging.disable(logging.WARNING)
warnings.filterwarnings("ignore")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data", "gita")
MW_CACHE = os.path.join(DATA, "mw-cache.json")

# sa.wikisource page titles (भगवद्गीता/<adhyāya>). Chapter 2 is verified; the
# rest are the standard adhyāya names — pass --page to override per chapter.
CHAPTER_PAGE = {
    1: "भगवद्गीता/अर्जुनविषादयोगः",
    2: "भगवद्गीता/साङ्ख्ययोगः",
    3: "भगवद्गीता/कर्मयोगः",
    4: "भगवद्गीता/ज्ञानकर्मसंन्यासयोगः",
    5: "भगवद्गीता/कर्मसंन्यासयोगः",
    6: "भगवद्गीता/आत्मसंयमयोगः",
    7: "भगवद्गीता/ज्ञानविज्ञानयोगः",
    8: "भगवद्गीता/अक्षरब्रह्मयोगः",
    9: "भगवद्गीता/राजविद्याराजगुह्ययोगः",
    10: "भगवद्गीता/विभूतियोगः",
    11: "भगवद्गीता/विश्वरूपदर्शनयोगः",
    12: "भगवद्गीता/भक्तियोगः",
    13: "भगवद्गीता/क्षेत्रक्षेत्रज्ञविभागयोगः",
    14: "भगवद्गीता/गुणत्रयविभागयोगः",
    15: "भगवद्गीता/पुरुषोत्तमयोगः",
    16: "भगवद्गीता/दैवासुरसम्पद्विभागयोगः",
    17: "भगवद्गीता/श्रद्धात्रयविभागयोगः",
    18: "भगवद्गीता/मोक्षसंन्यासयोगः",
}

DEVA_DIG = {c: str(i) for i, c in enumerate("०१२३४५६७८९")}
def dnum(s): return int("".join(DEVA_DIG.get(c, "") for c in s))
def dev_digit(n): return "".join("०१२३४५६७८९"[int(d)] for d in str(n))

SPEAKERS = ["सञ्जय उवाच", "अर्जुन उवाच", "श्रीभगवानुवाच", "धृतराष्ट्र उवाच", "भगवानुवाच"]

# ── stage 1a: fetch + extract mūla ──────────────────────────────────────────
def fetch_verses(page, chapter):
    api = ("https://sa.wikisource.org/w/api.php?action=parse&prop=wikitext&format=json&page="
           + urllib.parse.quote(page))
    req = urllib.request.Request(api, headers={"User-Agent": "lexicon-research"})
    wt = json.load(urllib.request.urlopen(req, timeout=60))["parse"]["wikitext"]["*"]
    poems = re.findall(r"<poem>(.*?)</poem>", wt, re.DOTALL)
    mark = re.compile(r"॥\s*%s\s*-\s*([०-९]+)\s*॥" % dev_digit(chapter))
    lines = []
    for p in poems:
        for raw in p.split("\n"):
            s = raw.replace("'''", "").strip()
            if s:
                lines.append(s)
    source, speaker_buf, buf_a = {}, [], None
    invocation = re.compile(r"^(ॐ|श्री.*नमः|अथ .*ऽध्यायः)$")
    for s in lines:
        if invocation.match(s):
            continue
        if s in SPEAKERS:
            speaker_buf.append(s)
            continue
        m = mark.search(s)
        if m:
            n = dnum(m.group(1))
            for sp in speaker_buf:
                source[f"{n}s"] = sp
            speaker_buf = []
            source[f"{n}a"] = buf_a if buf_a is not None else ""
            source[f"{n}b"] = s
            buf_a = None
        else:
            buf_a = s if buf_a is None else buf_a + " " + s
    return source

# ── stage 1b: Monier-Williams head-gloss (Cologne) ──────────────────────────
_UA = {"User-Agent": "Mozilla/5.0 (lexicon research; adityaprasadiskool@gmail.com)"}
CIT = re.compile(r"^[A-ZĀĪŪṚṜḶṆṬḌṄÑŚṢḤṀṂ][A-Za-zĀĪŪṚṜāīūṛ]*\.?$")
STUB = re.compile(r"(See pp\b|see s\.v|See s\.v|^\s*=\s)", re.I)
POS = re.compile(r"^(mfn?\.|m\.|n\.|f\.|ind\.|mf\([^)]*\)n\.|A\.|L\.)\s*")
BAD_LEAD = re.compile(r"^(either\b|prob\.|and\b|See below|=\s|the above|for\b)", re.I)

def _mw_raw(stem):
    url = ("https://www.sanskrit-lexicon.uni-koeln.de/scans/MWScan/2020/web/webtc/getword.php"
           "?key=%s&transLit=slp1" % urllib.parse.quote(stem))
    req = urllib.request.Request(url, headers=_UA)
    return urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "replace")

def _clean_parts(text, limit=3):
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"√\S+", "", text).lstrip(" ),.;:—-")
    first = re.split(r";", text)[0]
    keep = []
    for p in first.split(","):
        p = p.strip(" ),.;:")
        if not p or CIT.match(p) or p in ("&c.", "&c", "&amp;c."):
            continue
        keep.append(p)
        if len(keep) >= limit:
            break
    return ", ".join(keep).strip(" ,.;:")

def _entry_gloss(sense1):
    seg = re.sub(r"(Whitney )?Roots links:.*?Dhatupatha links:\s*[\d.,\s]*", "", sense1, flags=re.S)
    seg = re.sub(r"\[Printed book page[^\]]*\]", "", seg)
    seg = re.sub(r"\[[^\]]*\]", "", seg)
    seg = " ".join(l.strip() for l in seg.splitlines() if l.strip())
    seg = re.sub(r"^\S+\s+", "", seg)  # drop leading repeated headword
    is_verb = (re.search(r"\bcl\.\s*\d", seg) or seg.startswith("P.") or seg.startswith("Ā.")
               or seg.startswith("-") or "Roots links:" in seg)
    if is_verb:
        # a verb entry's meaning follows the conjugation/roots preamble at "to …"
        mto = re.search(r"\bto\s+\S.*", seg)
        if mto:
            return _clean_parts("to " + re.sub(r"^to\s+", "", mto.group(0)), limit=5)
    return _clean_parts(POS.sub("", seg))

def mw_head_gloss(stem):
    txt = html.unescape(re.sub(r"<[^>]+>", "", _mw_raw(stem)))
    if "ID=" not in txt:
        return ""
    parts = re.split(r"\(H\d+[A-Z]?\)", txt)
    for e in (parts[1:] if len(parts) > 1 else [txt]):
        m = re.search(r"\[ID=\d+\s*\]", e)
        sense1 = e[:m.start()] if m else e
        if STUB.search(re.sub(r"\([^)]*\)", "", sense1)):
            continue
        g = _entry_gloss(sense1)
        g = re.sub(r"^\S+\s+(?=(mfn?\.|m\.|n\.|f\.|ind\.))", "", g)
        g = re.sub(r"^(mfn?\.|m\.|n\.|f\.|ind\.|A\.|L\.)\s*", "", g).strip(" ,.;:")
        g = re.sub(r"\s+", " ", g)
        if not g or len(g) < 2 or BAD_LEAD.search(g) or "cf." in g[:6] or "Pāṇ" in g:
            continue
        return g
    return ""

# ── stage 1c: sandhi split + morphological stemming ─────────────────────────
def make_lemmatizer():
    from sanskrit_parser import Parser
    from sanskrit_parser.base.sanskrit_base import SanskritObject
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import SLP1
    parser = Parser(output_encoding="slp1")
    la = parser.sandhi_analyzer

    def morph_stems(slp):
        cands = [slp] + ([slp[:-1] + "s", slp[:-1] + "r", slp[:-1]] if slp.endswith("H") else [])
        for c in cands:
            try:
                tags = la.getMorphologicalTags(SanskritObject(c, encoding=SLP1))
            except Exception:
                tags = None
            if tags:
                seen = []
                for stem, _ in tags:
                    s = str(stem).split("#")[0]
                    if s not in seen:
                        seen.append(s)
                return seen
        return []

    def to_slp(deva):
        return sanscript.transliterate(deva, sanscript.DEVANAGARI, sanscript.SLP1)

    def analyses(deva):
        out, slp = [], to_slp(deva)
        ws = morph_stems(slp)
        if ws:
            out.append([(slp, ws[0])])
        try:
            splits = list(parser.split(deva, limit=3))
        except Exception:
            splits = []
        for sp in splits:
            pieces = [str(x) for x in sp.split]
            if len(pieces) <= 1:
                if not ws and pieces:
                    st = morph_stems(pieces[0])
                    out.append([(pieces[0], st[0] if st else None)])
                continue
            out.append([(pc, (morph_stems(pc) or [None])[0]) for pc in pieces])
        uniq, seen = [], set()
        for a in out:
            k = tuple(a)
            if k not in seen:
                seen.add(k)
                uniq.append(a)
        return uniq

    return analyses

# ── driver ──────────────────────────────────────────────────────────────────
# A shown gloss must be trustworthy, not merely present: mechanical sandhi
# splitting mis-cuts fused words and short fragments spuriously match MW
# letter/particle entries. Keep a single whole-word hit, or a CLEAN compound
# (<=3 pieces, every piece glossed, no garbage sense); else show nothing —
# an honest blank, never a guess.
# Garbage = MW cross-reference stubs and spurious short-fragment matches. The
# "see …" branch catches cross-refs ("See idam", "See cols.", "see a-jara")
# WITHOUT rejecting the verb sense ("to see, behold") — it fires only when
# "see" is followed by a reference token (a directive word or a hyphenated
# lemma), not a comma/synonym.
_GARBAGE = re.compile(
    r"(letter of the alphabet|semivowel|dental consonant|guttural|palatal consonant"
    r"|labial|sibilant|nasal consonant|Dhātup|Uṇ\.|q\.v|˚|a form of [SŚsś]iva|Ah! Oh"
    r"|the \d+(st|nd|rd|th)"
    r"|\bthe\s+[\w-]*\s*(letter|consonant|vowel|semivowel|nasal|dental|guttural|labial|palatal|cerebral|sibilant)\b"
    r"|\bsee\s+(idam|ayam|imam|above|below|under|cols?|cf\b|p\.|s\.v|[a-zāīūṛñśṣṭḍ]+-))", re.I)

# Indeclinable particles (a small CLOSED class): MW's stem lookup returns a noun
# or verb homograph ("vā = wind", "hi = to impel", "na = the dental nasal"), not
# the particle sense. Mechanically unreliable → suppress (blank), never guess.
# These are the single clearest candidate for a small curated gloss table.
_INDECL = {"na", "ca", "vA", "mA", "hi", "eva", "api", "iva", "tu", "vE", "u",
           "ha", "sma", "aTa", "uta", "atra", "iti", "aho", "nu", "kila", "KMalu"}

def _bad(p):
    return (not p["gloss"]) or len(p["stem"]) <= 1 or p["stem"] in _INDECL or bool(_GARBAGE.search(p["gloss"]))

def confident_gloss(pieces):
    real = [p for p in pieces if p["stem"]]
    if not real:
        return ""
    if len(real) == 1:
        return "" if _bad(real[0]) else real[0]["gloss"]
    if len(real) > 3 or any(_bad(p) for p in real):
        return ""
    return " + ".join(p["gloss"] for p in real)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("--page", default=None, help="override sa.wikisource page title")
    args = ap.parse_args()
    chapter = args.chapter
    page = args.page or CHAPTER_PAGE.get(chapter)
    if not page:
        sys.exit(f"no page mapping for chapter {chapter}; pass --page")

    os.makedirs(DATA, exist_ok=True)
    try:
        mw = json.load(open(MW_CACHE))
    except Exception:
        mw = {}

    def gloss(stem):
        if stem in mw:
            return mw[stem]
        try:
            g = mw_head_gloss(stem)
        except Exception:
            g = ""
        mw[stem] = g
        time.sleep(0.15)
        return g

    print(f"chapter {chapter}: fetching {page} …", file=sys.stderr)
    source = fetch_verses(page, chapter)
    analyses = make_lemmatizer()

    is_marker = lambda t: t == "।" or "॥" in t

    def choose(deva):
        best, best_key = None, (-1.0, -10**9)
        for a in analyses(deva):
            covered = sum(1 for _, st in a if st and gloss(st))
            key = (covered / len(a), -len(a))  # coverage RATIO, then fewest pieces
            if key > best_key:
                best_key, best = key, a
        if not best:
            return {"gloss": "", "lemmas": [], "pieces": []}
        pieces, lemmas = [], []
        for pc, st in best:
            g = gloss(st) if st else ""
            gs = ", ".join(x.strip() for x in g.split(",")[:3]).strip() if g else ""
            pieces.append({"slp": pc, "stem": st, "gloss": gs})
            if st:
                lemmas.append(st)
        return {"gloss": confident_gloss(pieces), "lemmas": lemmas, "pieces": pieces}

    verses, wtot, wgot = {}, 0, 0
    keys = sorted(source, key=lambda k: (int(re.match(r"\d+", k).group()), {"s": 0, "a": 1, "b": 2}[k[-1]]))
    t0 = time.time()
    for k in keys:
        toks = []
        for tk in source[k].split():
            if is_marker(tk):
                toks.append({"surface": tk, "isMarker": True, "gloss": "", "lemmas": [], "pieces": []})
            else:
                r = choose(tk)
                wtot += 1
                wgot += 1 if r["gloss"] else 0
                toks.append({"surface": tk, "isMarker": False, **r})
        verses[k] = {"line": source[k], "tokens": toks}
        json.dump(mw, open(MW_CACHE, "w"), ensure_ascii=False, indent=0)
        print(f"  {k}  ({time.time()-t0:.0f}s, {wgot}/{wtot} glossed)", file=sys.stderr)

    out = {
        "meta": {
            "source": f"sa.wikisource.org {page} (public domain)",
            "chapter": chapter,
            "padaccheda": "sanskrit_parser 0.2.6 (rule-based sandhi split + morphological stemming)",
            "dictionary": "Monier-Williams (Cologne getword.php, transLit=slp1), first-substantive-sense head-gloss",
        },
        "verses": verses,
    }
    outpath = os.path.join(DATA, f"chapter{chapter}-glosses.json")
    json.dump(out, open(outpath, "w"), ensure_ascii=False, indent=1)
    print(f"\nwrote {os.path.relpath(outpath, ROOT)}", file=sys.stderr)
    print(f"word gloss coverage {wgot}/{wtot} = {100*wgot/max(wtot,1):.1f}%", file=sys.stderr)


if __name__ == "__main__":
    main()
