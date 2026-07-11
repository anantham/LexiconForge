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
        units.append({
            "n": ch["chapterNumber"],
            "id": uid,
            "title": titles[uid],
            "italian": toks,
            "english": english[uid],
        })

    payload = {
        "work": session.get("novels", [{}])[0].get("title", "Se una notte d'inverno un viaggiatore"),
        "witness": "William Weaver (1981)",
        "hasGlosses": bool(glosses),
        "units": units,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(payload, open(args.out, "w", encoding="utf-8"), ensure_ascii=False)
    tot = sum(len(u["italian"]) for u in units)
    print(f"wrote {args.out}: {len(units)} units, {tot} tokens, glosses={'yes' if glosses else 'no'}")

if __name__ == "__main__":
    main()
