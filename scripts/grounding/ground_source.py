#!/usr/bin/env python
"""
Stage GROUND (deterministic fact layer) — reusable across books.

Reads a bilingual session JSON (chapter `content` = source-language text) and
produces per-unit grounded token data using spaCy: for every source token,
its lemma, coarse POS (UPOS), and morphological features. No LLM — this is the
deterministic substrate that the reader renders and that an optional gloss/
lexicographer pass later builds on.

The linguistics is spaCy's; this script is just glue. spaCy handles Italian
clitics/elisions (sporgendosi -> sporgere, s'intersecano) that a dictionary
lookup cannot.

Usage:
  python scripts/grounding/ground_source.py \
      --session out/calvino-session.json \
      --model it_core_news_sm \
      --out-dir data/calvino
"""
import argparse
import json
import os
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", required=True, help="bilingual session JSON")
    ap.add_argument("--model", default="it_core_news_sm", help="spaCy model")
    ap.add_argument("--out-dir", required=True, help="dir for per-unit grounded JSON")
    args = ap.parse_args()

    import spacy

    nlp = spacy.load(args.model)
    with open(args.session, encoding="utf-8") as f:
        session = json.load(f)

    os.makedirs(args.out_dir, exist_ok=True)
    chapters = session.get("chapters", [])
    print(f"Grounding {len(chapters)} units with {args.model}...")

    # Sentence-initial capitals defeat the lemmatizer (Stai -> "Stai" not "stare",
    # Leggere -> "Leggere"). Re-lemmatize the lowercased form for capitalised
    # content words (never PROPN, so Calvino/Italo stay intact). Cached by surface.
    _lemma_cache = {}
    def corrected_lemma(t):
        lem = t.lemma_
        # Any capitalised content word whose lemma stayed capitalised is almost
        # always a mis-lemmatised post-capital word (proper nouns are PROPN, excluded),
        # not gated on is_sent_start because a heading like "I" can absorb the start.
        if t.text[:1].isupper() and t.pos_ in ("VERB", "AUX", "NOUN", "ADJ", "ADV") and lem[:1].isupper():
            low = t.text.lower()
            if low not in _lemma_cache:
                _lemma_cache[low] = nlp(low)[0].lemma_
            cand = _lemma_cache[low]
            if cand and cand[:1].islower():
                return cand
        return lem

    index = []
    for ch in chapters:
        text = ch.get("content", "") or ""
        doc = nlp(text)
        sentences = []
        tok_total = 0
        ntok = len(doc)
        for si, sent in enumerate(doc.sents):
            toks = []
            for t in sent:
                if t.is_space:
                    continue
                # Gap to the next NON-space token, read from raw offsets. spaCy emits
                # "\n\n" as its own (skipped) whitespace token, so token.whitespace_ is
                # empty there — measuring the offset gap recovers the paragraph break.
                j = t.i + 1
                while j < ntok and doc[j].is_space:
                    j += 1
                nxt = doc[j].idx if j < ntok else len(doc.text)
                gap = doc.text[t.idx + len(t.text): nxt]
                toks.append({
                    "i": t.i,
                    "surface": t.text,
                    "lemma": corrected_lemma(t),
                    "upos": t.pos_,
                    "morph": str(t.morph),
                    "isAlpha": t.is_alpha,
                    "isStop": t.is_stop,
                    "ws": len(gap) > 0,       # any whitespace before next word -> render a space
                    "pbr": "\n" in gap,       # paragraph break follows this token
                })
            if toks:
                sentences.append({"idx": si, "text": sent.text.strip(), "tokens": toks})
                tok_total += len(toks)

        unit = {
            "unitId": ch.get("stableId"),
            "chapterNumber": ch.get("chapterNumber"),
            "title": ch.get("title"),
            "lang": "it",
            "model": args.model,
            "sentenceCount": len(sentences),
            "tokenCount": tok_total,
            "sentences": sentences,
        }
        out_path = os.path.join(args.out_dir, f"{ch.get('stableId')}.grounded.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(unit, f, ensure_ascii=False, indent=1)
        index.append({
            "unitId": unit["unitId"],
            "chapterNumber": unit["chapterNumber"],
            "title": unit["title"],
            "sentenceCount": unit["sentenceCount"],
            "tokenCount": unit["tokenCount"],
            "file": os.path.basename(out_path),
        })
        print(f"  u{unit['chapterNumber']:>2} {unit['tokenCount']:>5} tok  {unit['sentenceCount']:>4} sent  {str(unit['title'])[:40]}")

    with open(os.path.join(args.out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"model": args.model, "units": index}, f, ensure_ascii=False, indent=1)
    total = sum(u["tokenCount"] for u in index)
    print(f"\nWrote {len(index)} grounded units ({total} tokens) to {args.out_dir}/")


if __name__ == "__main__":
    sys.exit(main())
