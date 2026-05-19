#!/usr/bin/env python3
"""
Build data/liturgy/bodhi-heart-sutra.ts by transforming heart-sutra.ts.

The Bodhi Sangha Heart Sutra is the same canonical text as MAPLE's — same
Sanskrit, Chinese, Japanese, Tibetan, same chant-line segments — but
chanted in a different English recension (Aitken-Rochester / Diamond
Sangha lineage). This script preserves all the multi-script data and
word/morpheme breakdowns; only the English witness changes per segment.

Per segment we:
  - strip the MAPLE 'after Sheng-yen' witness (by-name)
  - prepend a Bodhi witness with the curated text from Bodhi's booklet
  - leave Conze / Red Pine / Plum Village witnesses untouched for
    comparison
  - prefix segment IDs with `bodhi-` to avoid collisions across pages
  - rewrite top-level metadata for the Bodhi sangha
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "liturgy" / "heart-sutra.ts"
DST = ROOT / "data" / "liturgy" / "bodhi-heart-sutra.ts"

# Bodhi witness text + alignTo per segment ID (canonical id, before
# bodhi- prefix is added). Texts come from the Bodhi Sangha Sutras
# booklet (May 2016, p.3). alignTo entries are hand-tuned: each index is
# the position of the Pāli word the English token maps to (or -1 for
# articles / supplied English / interpretive additions). Lengths must
# match the whitespace-split English word count; mismatches are caught
# by tests/components/liturgy/alignment-audit.test.ts.
BODHI_TEXTS = {
    "opening-avalokita":
        ("Avalokiteshvara Bodhisattva,", [0, 1]),
    "opening-practice":
        ("practicing deep Prajna Paramita", [2, 0, 1, 1]),
    "opening-seeing":
        ("clearly saw that all five skandhas are empty, transforming all suffering and distress.",
         [0, 7, -1, -1, 2, 3, -1, 6, -1, -1, -1, -1, -1]),
    "form-not-different-emptiness":
        ("Shariputra, form is no other than emptiness,",
         [-1, 0, -1, 1, 2, -1, 3]),
    "emptiness-not-different-form":
        ("emptiness no other than form;", [0, 1, 2, -1, 3]),
    "form-is-emptiness":
        ("form is emptiness,", [0, -1, 1]),
    "emptiness-is-form":
        ("emptiness is form;", [0, -1, 1]),
    "middle-shariputra":
        ("Shariputra,", [1]),
    "middle-all-dharmas-empty":
        ("all dharmas are essentially empty:", [0, 0, -1, 1, 1]),
    "middle-no-arise-no-cease":
        ("not born, not destroyed;", [-1, 0, -1, 1]),
    "middle-no-defile-no-pure":
        ("not stained, not pure,", [-1, 0, 1, 2]),
    "middle-no-increase-no-decrease":
        ("without loss, without gain.", [-1, 0, 1, 2]),
    "middle-emptiness-no-form":
        ("Therefore in emptiness there is no form,",
         [0, -1, 2, -1, -1, 3, 4]),
    "middle-no-other-skandhas":
        ("no feeling, no perception, mental reaction, consciousness;",
         [0, 1, 2, 3, 4, 5, 7]),
    "middle-no-six-faculties":
        ("no eye, ear, nose, tongue, body, mind;",
         [0, 1, 3, 5, 7, 9, 11]),
    "middle-no-six-objects":
        ("no colour, sound, smell, taste, touch, objects of mind;",
         [0, 1, 3, 5, 7, 9, 11, -1, -1]),
    "middle-no-dhatus":
        ("no seeing and so on to no thinking;",
         [0, 1, 2, 2, 2, 2, 3, 4]),
    "middle-no-ignorance":
        ("no ignorance and also no ending of ignorance",
         [0, 1, -1, -1, 2, 3, 3, 3]),
    "middle-no-aging-death":
        ("and so on to no old age and death, and also no ending of old age and death;",
         [0, 0, 0, 0, 1, 2, 2, -1, 2, -1, -1, 3, 4, 4, 4, 4, -1, 4]),
    "middle-no-four-truths":
        ("no suffering, cause of suffering, cessation, path;",
         [0, 1, 2, 2, 1, 3, 4]),
    "middle-no-wisdom-no-attainment":
        ("no wisdom and no attainment.", [0, 1, -1, 2, 3]),
    "middle-because-no-attainment":
        ("Since there is nothing to attain,", [0, -1, -1, 1, 1, 1]),
    "result-no-obstruction":
        ("the Bodhisattva lives by Prajna Paramita with no hindrance in the mind;",
         [-1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 0]),
    "result-because-no-obstruction":
        ("no hindrance,", [0, 0]),
    "result-no-fear":
        ("thus no fear;", [-1, 0, 0]),
    "result-far-from-inversion":
        ("far beyond delusive thinking", [0, 0, 0, 0]),
    "result-ultimate-nirvana":
        ("right here is Nirvana.", [-1, -1, -1, 0]),
}

WITNESS_BY = "Bodhi Sangha (Aitken-Rochester / Diamond Sangha line)"
WITNESS_URL = "https://en.wikipedia.org/wiki/Heart_Sutra#English_translations"
WITNESS_LICENSE = "Bodhi Sangha Sutras booklet, May 2016 — quoted with attribution"


def count_words(text: str) -> int:
    """Mirror tests/components/liturgy/alignment-audit.test.ts countEnglishWords."""
    return sum(1 for s in text.split() if s)


def build_bodhi_witness(text: str, indent: int) -> str:
    """Render a fresh Bodhi witness object to be injected as the first
    element of a segment's witnesses[] array."""
    pad = " " * indent
    n = count_words(text)
    # All -1s until we hand-tune; the audit will pass on length, then we
    # refine the actual indices for the alignment lines to be meaningful.
    align = "[" + ", ".join(["-1"] * n) + "]"
    return (
        f"{pad}{{\n"
        f"{pad}  by: {js_str(WITNESS_BY)},\n"
        f"{pad}  text: {js_str(text)},\n"
        f"{pad}  alignTo: {align},\n"
        f"{pad}  url: {js_str(WITNESS_URL)},\n"
        f"{pad}  license: {js_str(WITNESS_LICENSE)},\n"
        f"{pad}}},"
    )


def js_str(text: str) -> str:
    """Encode as a single-quoted JS string with minimal escaping."""
    escaped = text.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


# ── transformations ─────────────────────────────────────────────────────────

def main():
    src = SRC.read_text(encoding="utf-8")

    # 1. Header comment — rewrite the file-top docstring
    src = re.sub(
        r"^/\*\*\n( \*[^\n]*\n)+ \*/",
        '/**\n'
        ' * Maha Prajna Paramita Hrdaya Sutra — Bodhi Sangha rendering.\n'
        ' *\n'
        ' * The same Heart Sutra that lives under /liturgy/maple/heart-sutra,\n'
        ' * chanted at Bodhi Sangha in the Aitken-Rochester / Diamond Sangha\n'
        ' * English recension. The Sanskrit / Devanāgarī / Chinese Xuanzang /\n'
        ' * Sino-Japanese / Tibetan canonical scripts and all word-level\n'
        ' * morpheme data are identical to the MAPLE version — concept-graph\n'
        ' * auto-resolves from the same registry. The differentiator is the\n'
        ' * English: Bodhi\'s witness sits first; Conze / Red Pine / Thich Nhat\n'
        ' * Hanh remain available for comparison via the witness-dots.\n'
        ' *\n'
        ' * Bodhi text source: Bodhi Sangha Sutras booklet (May 2016), p.3.\n'
        ' */',
        src, count=1
    )

    # 2. Top-level metadata
    src = src.replace(
        "export const heartSutra: LiturgyDoc = {",
        "export const bodhiHeartSutra: LiturgyDoc = {",
    )
    src = src.replace(
        "  sangha: 'maple',\n  order: 4,",
        "  sangha: 'bodhi-sangha',\n  order: 3,",
    )
    src = src.replace(
        "  title: 'The Scripture on the Heart of Transcendent Wisdom',",
        "  title: 'Maha Prajna Paramita Hrdaya Sutra',",
    )
    src = src.replace(
        "  subtitle: 'Prajñāpāramitā Hṛdaya Sūtra · MAPLE chant text (after Sheng-yen)',",
        "  subtitle: 'The Heart Sutra — Bodhi Sangha (Aitken-Rochester / Diamond Sangha line)',",
    )
    src = src.replace(
        "  context: 'The shortest Mahāyāna sutra — the *hṛdaya* (heart, essence) of the Perfection-of-Wisdom literature. Avalokiteśvara speaks to Śāriputra: form is emptiness, emptiness is form.',",
        "  context: 'Bodhi\\'s English recension reads close to the Aitken-Rochester / Diamond Sangha line used across Zen centres in the Yamada Roshi / Sanbo Kyodan tradition.',",
    )
    # Replace ritual sources to point at Bodhi's booklet
    src = re.sub(
        r"    ritual: \[\n      \{ label: 'Chanted at MAPLE and at Zen/Chan/Tibetan/Pure Land centres worldwide' \},\n    \],",
        "    ritual: [\n      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.3' },\n    ],",
        src,
    )
    # Update the curator note
    src = re.sub(
        r"  curator:\n    \"Curation by Aditya[^\"]+\",",
        "  curator:\n    \"Curation by Aditya. Bodhi Sangha's English text is the primary witness here, with Conze (1958), Red Pine (2004), and Thich Nhat Hanh / Plum Village (2014) kept as comparative witnesses. The Sanskrit / Chinese / Tibetan canonical data and word-level morpheme breakdowns are identical to the MAPLE Heart Sutra page; concept-graph hover auto-resolves from the same 30-concept registry.\",",
        src,
    )

    # 3. Per-TSW-segment transformations
    #    - prefix every `id: '<known-id>'` with `bodhi-`
    #    - replace the MAPLE chant-sheet witness with a Bodhi witness
    for seg_id, (bodhi_text, bodhi_align) in BODHI_TEXTS.items():
        # Sanity check: alignTo length must equal English word count.
        assert len(bodhi_align) == count_words(bodhi_text), (
            f"{seg_id}: alignTo len {len(bodhi_align)} != words {count_words(bodhi_text)} in '{bodhi_text}'"
        )
        # Find the segment block by its id line (multi-line indent).
        # Build pattern via concatenation to avoid f-string brace conflicts.
        pat = (
            r"(          id: ')"
            + re.escape(seg_id)
            + r"('[\s\S]+?)(\n          \},)"
        )
        seg_pattern = re.compile(pat, re.MULTILINE)

        def replace_segment(m, txt=bodhi_text, align=bodhi_align, sid=seg_id):
            inner = m.group(2)
            # Locate the MAPLE witness object inside this segment and swap
            # its `by` and `text` lines, and the alignTo, to Bodhi's. The
            # MAPLE witness is the first one — has the chant-sheet `by`.
            new_witness = (
                "              by: 'Bodhi Sangha (Aitken-Rochester / Diamond Sangha line)',\n"
                f"              text: {js_str(txt)},\n"
                f"              alignTo: [{', '.join(str(x) for x in align)}],\n"
                "              url: 'https://en.wikipedia.org/wiki/Heart_Sutra#English_translations',\n"
                "              license: 'Bodhi Sangha Sutras booklet, May 2016 — quoted with attribution',"
            )
            inner = re.sub(
                r"              by: 'MAPLE chant sheet \(after Sheng-yen\)',\n"
                r"              text: '[^']*',\n"
                r"              alignTo: \[[^\]]*\],\n"
                r"              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\\'s translation',",
                new_witness,
                inner,
                count=1,
            )
            return f"          id: 'bodhi-{sid}'{inner}{m.group(3)}"

        src = seg_pattern.sub(replace_segment, src)

    # 4. Update section IDs that we want to prefix too
    src = src.replace(
        "      id: 'heart-core',", "      id: 'bodhi-heart-core',"
    )
    src = src.replace(
        "      id: 'heart-middle',", "      id: 'bodhi-heart-middle',"
    )
    src = src.replace(
        "      id: 'heart-result',", "      id: 'bodhi-heart-result',"
    )

    # 5. Adjust the MAPLE-specific prose sections — Bodhi has its own:
    #    maple-all-buddhas → bodhi-all-buddhas with Bodhi text
    #    maple-great-spell → bodhi-great-mantra with Bodhi text
    # re.sub interprets `\n` in the replacement string as a real newline
    # even when the source is a raw string, so we use lambdas to pass the
    # replacement through verbatim. The bodies need LITERAL backslash-n
    # so TypeScript parses them as escape sequences in the string.
    src = re.sub(
        r"    \{\n      id: 'maple-all-buddhas',\n      shape: 'prose-commentary',\n      body: '[^']*',\n    \},",
        lambda _m: (
            "    {\n"
            "      id: 'bodhi-all-buddhas',\n"
            "      shape: 'prose-commentary',\n"
            "      body: 'All Buddhas past, present, and future\\nlive by Prajna Paramita,\\nattaining Anuttara Samyak Sambodhi.',\n"
            "    },"
        ),
        src,
    )
    src = re.sub(
        r"    \{\n      id: 'maple-great-spell',\n      shape: 'prose-commentary',\n      body: '[^']*',\n    \},",
        lambda _m: (
            "    {\n"
            "      id: 'bodhi-great-mantra',\n"
            "      shape: 'prose-commentary',\n"
            "      body: 'Therefore know that Prajna Paramita is the great mantra, the wisdom mantra,\\nthe unsurpassed mantra, the supreme mantra,\\nwhich completely removes all suffering.\\nThis is truth, not mere formality.\\nTherefore set forth the Prajna Paramita mantra,\\nset forth this mantra and proclaim:',\n"
            "    },"
        ),
        src,
    )

    # 6. Strip the MAPLE-only Sino-Japanese extended dharani (Bodhi doesn't
    #    chant the second long Japanese form).
    src = re.sub(
        r"\n    // ─[^\n]+\n    // 3b\. Longer Japanese[^\n]+\n    //[^\n]+\n    // ─[^\n]+\n    \{\n      id: 'dharani-japanese-extended',[\s\S]+?\n    \},",
        "",
        src,
    )

    # 7. Final export rename
    src = src.replace(
        "export default heartSutra;",
        "export default bodhiHeartSutra;",
    )

    DST.write_text(src, encoding="utf-8")
    print(f"Wrote {DST} ({len(src.splitlines())} lines)")


if __name__ == "__main__":
    main()
