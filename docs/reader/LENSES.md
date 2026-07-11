# Reader lenses — every element fights for its existence

> Status: design law, extracted 2026-07-11 from the Malayalam pilot session
> (`/malayalam`, `feat/opus-malayalam-reader`) and the first look at the
> Calvino substrate (`feat/local-grounding-pipeline`). Companion to
> `docs/sutta-studio/POLYGLOT.md` (each language gets its own lens) and
> `SUBSTRATE_NOT_EXEGESIS.md` (the pipeline makes substrate, not teaching).

## The law

A UI element exists only if it answers a question **this reader**, at **this
barrier**, actually has — for **this language's** hidden machinery. Nothing is
inherited from another language's reader by default.

Two corollaries, both learned the hard way in one session:

1. **No substrate leakage.** `lemma`, `POS`, `Mood=Ind|Number=Sing` are the
   grounding pipeline's *internal vocabulary*. They are INPUTS to tooltip copy,
   never the copy. A tooltip that says "lemma: essere · AUX · 1sg pres" has
   told a non-speaker nothing; the same facts rendered honestly say:
   **"am — the 'I' form of *essere*, to be."** (This is CURATION_PROTOCOL §3.4's
   no-jargon rule, extended from grammar labels to ALL pipeline vocabulary.)
2. **Surface law** (SUTTA-025, adopted for Malayalam, applies everywhere):
   displayed pieces must reconstruct the exact written surface; fused forms
   collapse and the tooltip teaches the split. Italian has sandhi too — it
   just spells it with apostrophes (`d'inverno`) and fused articles (`nel`).

## The audit: reader barrier × language machinery

| Reader | Barrier | What the language compresses |
|---|---|---|
| Aditya reading Malayalam | can SPEAK it; script decoding is the wall | agglutination; script assembly; two registers |
| Anglophone reading Italian | can PRONOUNCE it; **vocabulary** is the wall | endings carry the subject; fused function words; a giant Latinate cognate web English already half-owns |

Element-by-element verdicts:

| Element | Malayalam | Italian |
|---|---|---|
| Big source text | KEEP — it's the object | KEEP |
| Always-on sound line under every piece | **KEEP** — the barrier is decoding script | **KILL** — orthography is ~phonetic and the reader said "I can pronounce these words." Replace with: stress mark where it surprises (leggère vs lèggere class), hard/soft c·g flag in etym hover. An element that answers no live question is clutter. |
| Hover tooltip (align) | meaning first + register | **meaning first + COGNATE BRIDGE** — anchor the unknown word to English the reader owns: *notte* → night, kin to **nocturnal**; *inverno* → winter, kin to **hibernate**; *viaggiatore* → traveller, kin to **voyager**. This is the whole game for an anglophone: Italian vocabulary is ~40% already-paid-for. |
| False friends | (n/a) | KEEP as a badge — *camera* = room, *libreria* = bookshop. Wrong-certainty is worse than ignorance. |
| Base form ("lemma") | shown as plain words when surface ≠ base | Only when surface ≠ base, phrased as a story: "*sono* — the 'I' form of **essere**, to be." Never the word "lemma." |
| Grammar features | plain words only ("to/for — possession is 'to X there is'") | plain words only, and only the features that unlock READING: **who acts** (the ending replaces the dropped pronoun: -o = I, -ai = you), **when** (past/now/will). Gender/number agreement: silent unless it disambiguates. |
| Etym mode (reach inward) | script assembly — akshara welds, chillu, chandrakkala visibility | **word-building** — derivation is Italian's inner structure: *viaggia·tore* (-tore = English -er), *-mente* = -ly, *s-* = un-/dis-, *-ino/-etto* = little-. Plus the cognate chain: *inverno* ← Lat. *hibernum* → Eng. *hibernate*. Suffix recognition multiplies vocabulary; that's what "inward" buys this reader. |
| Fusion pedagogy | sandhi collapse (പണ്ടൊരു) | IDENTICAL LAW — *nel* = in+il, *della* = di+la, *d'inverno* = di+inverno (elision), *leggerlo* = leggere+lo. Pieces where boundaries are clean (d' | inverno), collapse where they aren't (nel). `validate-surface.ts` generalizes as-is. |
| Alignment threads / unit spine | KEEP | KEEP — adjective-after-noun reordering is exactly what threads show well |
| Witness provenance | named, disclosed | named, disclosed (Weaver 1981 is a real witness — see sourcing below) |
| Font slider | KEEP | KEEP |

## What is special about Malayalam (the lens's load-bearing facts)

1. **One word is a clause.** Agglutination stacks noun+plural+case+clitic and
   verb+auxiliary chains into single written words (കണക്കെഴുത്തുമുണ്ടായിരുന്നു
   = "and he also had the accounts-writing"). Token ≠ unit is the norm, not
   the exception — the whole AlignSegment many-to-many model earns its keep here.
2. **The script is assembled, and the akshara is the atomic unit of ink.**
   Welds (koottaksharam), gemination, chillu finals, and a chandrakkala that is
   typed but often not drawn. Hover granularity must follow ink (cluster), with
   typed symbols inspected by drawing them apart (exploded tooltip) — pointing
   at sub-glyph ink that doesn't exist is false precision.
3. **Two registers live INSIDE the language.** Sanskrit-borrowed (tatsama,
   conjuncts intact: ക്ഷേത്രം) vs the Dravidian core (നട, കാവൽ, എഴുത്ത്) —
   every literary sentence plays them against each other. The register lens is
   to Malayalam what the cognate bridge is to Italian.
4. **Grammar the reader won't expect from English:** no articles (English
   "the/a" are ghost units flowing the other way); possession is dative
   ("to him there was" = he had); postpositions and SOV order make the
   alignment threads genuinely informative.
5. **The letter and the mouth diverge lawfully.** Single unvoiced stops soften
   after vowels (ട ta → spoken da in തിരുവടി) — name the rule, never leave
   the glyph/sound mismatch silent. Geminates never soften.
6. **This reader** (heritage speaker, rusty script): sound line always-on is
   the point of the instrument; meaning tooltips are support, not the lead.

## What is special about Aithihyamala (the work-lens)

A lens is language × work × reader. This work adds:

1. **It marks its own transmission.** The prose is dense with evidential
   forms — പറയപ്പെടുന്നു "it is said", കേട്ടുകേൾവി "heard-hearing"
   (hearsay), അത്രേ "so they say" — a legend collection continuously citing
   its own epistemics. Surface these as a facet: HOW the legend knows what it
   claims is the memeplex-transmission data the graphic-novel research wants.
   (Ch. 64 opens by saying the temple's records were burned and the account
   rests on the memory of the very old — the frame is load-bearing.)
2. **Honorific machinery.** Temple-and-court register: തിരു- prefixes,
   തിരുമനസ്സുകൊണ്ട് ("by the sacred mind" = His Highness), respect-plurals.
   Kerala's social hierarchy is IN the morphology; glossing it plainly is
   cultural translation, not grammar.
3. **Titles are a social map.** Menon, Namboothiri, Bhattathiri, Moosad,
   Kathanar… each encodes community and role the text assumes. Title concept
   cards (like `concept.menon`) are first-class, not optional trivia.
4. **Legends are territorial.** Deities have jurisdictions; place names
   decompose (ഊരകം = ūru+akam, "village-inside") and geography cards tie
   legends to walkable places — for this reader, literally a field guide.
5. **1909 formal prose.** Higher tatsama density and heavier sandhi fusion
   than modern print, occasional old orthography on Wikisource, dates in the
   Malayalam era (Kollavarsham — convert to CE in a facet), archaic measures.
   The Tier-1 converter must expect all of these.

## What is special about Italian (the lens's load-bearing facts)

1. **Register-inverted cognate web.** Everyday Italian maps to LEARNED English
   (notte→nocturnal, acqua→aquatic, libro→library, leggere→lecture): plain
   Italian *is* scholarly English. The inverse of Malayalam, whose two
   registers live INSIDE the language (tatsama vs Dravidian); Italian's
   register split runs ACROSS the bridge. This is why the cognate bridge is
   the primary lens: it teaches through vocabulary the reader already owns.
2. **The verb ending is the sentence's engine.** Pronouns are absorbed into
   endings (*diranno* = "they will say"). The ending-decoder answers the
   reader's live question — who is acting, when — not a grammar checkbox.
3. **Stress is sometimes grammar.** *parlo* "I speak" vs *parlò* "he spoke":
   the only difference is stress, and it is TENSE. Stress marks ship only
   where they carry meaning or surprise — as semantics, not elocution.
4. **Fusion confesses in print.** Italian sandhi is typographically visible
   (*d'inverno*, *nel* = in+il, *leggerlo* = read+it) — same surface law as
   Malayalam, easier because the seams show.
5. **Book-Italian ≠ spoken Italian.** Novels run on the passato remoto, the
   storytelling past modern speech has abandoned. Name it plainly, once:
   "the story-telling past — the tense books use." (Calvino ch. 1 is the
   gentle exception: second-person PRESENT — the easiest grammar in the
   language, doing metafiction.)

## Rendering function, not fact dump

The `local-grounding` branch's substrate (spaCy facts + kaikki glosses) is the
right INPUT. What's missing is a **rendering layer**: facts → reader copy.

```
{lemma: "essere", pos: "AUX", person: 1, number: sing, tense: pres}
        ↓ render(facts, lens=italian)
"am — the 'I' form of essere, to be"

{lemma: "notte", pos: "NOUN", gloss: "night", etym: "Latin noctem"}
        ↓
"night — kin to nocturnal"          ← cognate bridge drafted from etym,
                                       curated/reviewed like any gloss
```

Deterministic where possible (person/tense → plain-word table; elision/fusion
splits), LLM-drafted + reviewed where judgment lives (cognate choice, false
friends), exactly like the Malayalam gloss layer.

## Sourcing split (same rule as Malayalam/Khasak)

- **Public site**: public domain only. The Italian public book should be
  **Pinocchio (Collodi, 1883) + Mary Alice Murray's 1892 English** — both PD,
  a real historical translation witness (the Indulekha–Dumergue configuration).
  Its opening line ("C'era una volta… — Un re! — diranno subito i miei piccoli
  lettori…") already demos the lens: *c'era* = ci+era fusion, *diranno* =
  "they-will-say" in one ending, *lettori* → **lectors/lecture** cognate.
- **Calvino / Weaver**: in copyright. Local-only track — owned EPUBs in
  gitignored `import/`, built artifacts never published. The lens/UI is shared;
  only the data's distribution differs.

## Adding language N

Fill the two rows before writing any code: who is the reader and what's their
barrier; what does this language compress (POLYGLOT.md's four questions). Then
run the element audit above. If an element can't name the question it answers,
it doesn't ship.
