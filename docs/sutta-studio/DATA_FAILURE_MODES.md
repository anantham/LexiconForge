# Liturgy / Sutta data — failure modes

> **Status:** Drafted 2026-05-20 from the Metta Sutta depth pass + the
> cross-chant QC sweep that followed it.
> **Companions:** `CURATION_PROTOCOL.md` (how a phase gets curated),
> `tests/components/liturgy/liturgy-data-quality.test.ts` (the machine
> guards described below).

This catalogues the classes of error found while hand-curating the
liturgy chant data, **so a future generation pipeline (LLM curation,
where no human reviews every word) can avoid producing them — or
detect them automatically when it does.**

The organising distinction is **how the error announces itself**:

- **Silent** — nothing crashes, no test fails, the page renders. The
  reader just gets a degraded artifact. These are the dangerous ones:
  without a guard they survive indefinitely.
- **Loud** — a test fails or the build breaks. Cheap to catch.
- **Judgment** — no mechanical check is decisive; needs a taste call.
  A pipeline can *flag* these for review but not auto-resolve them.

Every silent class below now has a guard (see the test file). The
goal for any generator: **emit data that passes all guards, and when
it cannot, degrade cleanly rather than emit broken data.**

---

## 1. Morpheme reconstruction failure — *silent*

**What.** A word carries a `morphemes[]` array whose `text` values,
concatenated, do not equal the surface `form`. The renderer's
`splitByMorphemes` walks the surface slicing one morpheme at a time;
if the pieces don't reconstruct it returns `null` and the word
**silently** falls back to a single whole-word hover. The per-morpheme
tooltips and arrows just vanish — no error, no warning.

**Why it happens.** Pāli/Sanskrit *sandhi* at the morpheme join: two
vowels merge (`na`+`ati` → `nāti`, `a`+`ā` → `ā`), a vowel shortens
before the next piece, or `i`→`y` before a vowel. A curator writes the
morphemes in their *citation* form (`na`, `ati`) instead of their
*surface* form (`nā`, `ti`).

**Found in.** 13 words across Metta Sutta, morning-chants, Sho Sai,
Heart Sutra, Bodhi Heart Sutra.

**Guard.** `morphemes[]` (and per-script `scriptMorphemes[]`) must
concatenate back to the surface form. Test enforces it across every
word in every chant.

**Pipeline rule.** A generator emitting morphemes **must self-check
reconstruction before emitting**. If the morphemes it produced don't
reconstruct the surface, it must either (a) fix the split to the
surface form, naming the sandhi in the gloss, or (b) emit *no*
`morphemes` at all — whole-word hover is a clean degradation; a
broken split is not. Never emit morphemes you haven't reconstruction-
checked.

---

## 2. Internal-ID leak into reader text — *silent*

**What.** A gloss or etymology string contains a curator's internal
identifier — segment-ID shorthand like `v7d`, `v1a` ("same word as
v7d"). Meaningless to a reader; it only ever made sense to the person
authoring the file.

**Why it happens.** Cross-reference glosses ("same root as X in …")
are written while the curator is thinking in segment IDs.

**Found in.** 26 glosses in the Metta Sutta.

**Guard.** Reader-facing text must not match `/\bv\d+[a-z]\b/`.

**Pipeline rule.** The generator should never be *given* internal IDs
in a context where they can leak into prose — or a post-filter strips
them. Cross-references in reader text must resolve to human-facing
labels ("verse 7"), never internal handles. This generalises: **no
internal identifier of any kind belongs in reader-facing strings.**

---

## 3. Alignment-array shape errors — *loud*

**What.** `alignTo[]` length ≠ the witness's whitespace-split English
word count (off-by-one shifts every downstream arrow); or an entry
points past the segment's Pāli word count.

**Why it happens.** English text edited without re-counting; Pāli
re-segmented without re-indexing.

**Guard.** `alignment-audit.test.ts` — pre-existing; this class was
already loud. It fired ~15× during the verse-by-verse authoring and
each was fixed before commit.

**Pipeline rule.** Trivially machine-checkable; a generator should run
the same length + range check on its own output before emitting. This
is the cheap class — make every silent class look like this one.

---

## 4. Crossed morpheme arrows — *judgment, now authorable*

**What.** When several English words map to one Pāli word, the
renderer distributes their arrows across that word's morphemes *by
position* (1st English → 1st morpheme). When English reorders the
morphemes, the arrows cross — e.g. `kusalena` = `kusal` (skilled) +
`ena` (by-an-agent), rendered "one … skilled", so the heuristic sends
`kusal`'s arrow to "one".

**Why it's judgment.** Which English word belongs to which morpheme
is a semantic decision; position is only a guess.

**Mitigation.** The `Witness.morphemeAlignTo` field lets a curator
state the pairing explicitly. 41 witnesses authored for Metta.

**Pipeline rule.** A generator that produces `alignTo` should produce
`morphemeAlignTo` in the same pass — it already had to decide the
word↔word mapping; the word↔morpheme mapping is the same reasoning one
level finer. Falling back to the positional heuristic is acceptable
*only* when English and Pāli morpheme order agree.

---

## 5. Grammar jargon in plain-register text — *judgment, tripwired*

**What.** A gloss names a grammatical concept with a term a reader
with no Pāli training doesn't know — "gerundive", "accusative
singular", "past participle", a bare "(nominative)" appended as noise.

**Why it's judgment.** `CURATION_PROTOCOL.md` §3.4's pay-rent rule:
a technical term *may* stay if it does work plain English cannot AND
is glossed in the same sentence. So it's not an absolute ban — but the
default is to *show* the idea ("the object of 'I go to'", "the 'X-ed'
form") rather than *name* it.

**Found in.** 84+ hits across 9 chant files.

**Guard.** A jargon tripwire in the test — *not* an absolute ban. A
term that genuinely pays rent goes in `JARGON_ALLOWLIST` with a
rationale. (The guard's case-insensitive scan already caught one hit
— `Optative` — that a case-sensitive grep had missed.)

**Pipeline rule.** Generate glosses for the stated default reader (a
thoughtful adult, no Indic-linguistics training). A generator should
run the jargon scan on its own output and, for any hit, either rewrite
to plain English or justify the term inline. Treat a jargon hit as a
*signal to re-read*, exactly as a human curator would.

---

## 6. Framing / commentary prose — *judgment*

**What.** Curator-voice paragraphs above the chant body explaining
"what this chant is about" — often AI-generated, displacive, and not
what the reader came for.

**Found in.** Heart Sutra, Metta Sutta, Way of Compassion, Om Mani,
sangha descriptions.

**Why no guard.** Whether a prose block earns its place is a pure
taste call; a regex can't decide it. A pipeline can *flag* every
`prose-commentary` section for human review but should not auto-strip.

**Pipeline rule.** Default to *not* generating framing prose. The
chant body, word glosses, and witness translations carry the meaning;
a separate prose paragraph usually duplicates them. If commentary is
generated, it must be sourced, not asserted.

---

## 7. Tokenization mismatches — *silent*

**What.** The renderer's tokenizer splits a word the data did not
expect — e.g. `c'assa` splits on the apostrophe into `c` + `assa`;
a hyphenated compound splits on the hyphen. The `alignTo`/`words`
indices then refer to the wrong tokens.

**Mitigation.** The `tokens` hint on a `ScriptVariant` overrides
tokenization for that line.

**Pipeline rule.** A generator must tokenize with the *same* tokenizer
the renderer uses (or emit an explicit `tokens` hint) and index
`alignTo`/`words` against *that* token stream — never against a
naive whitespace split when the text contains apostrophes, hyphens,
or script-specific separators.

---

## 8. Script-mixed transliteration — *judgment*

**What.** One transliteration line bundles two scripts' romanizations
(Sino-Japanese romaji + Mandarin pinyin under the same Hanzi), so when
the reader cycles to one script they see both readings layered.

**Pipeline rule.** A transliteration belongs to exactly one script
variant. When the source script is Hanzi, show pinyin; when Japanese,
show romaji — never both on one line.

---

## The meta-lesson

The two genuinely dangerous classes (**1** and **2**) were *silent* —
they survived from first authoring until a human happened to hover the
wrong word. The fix was not "curate more carefully"; it was **make the
silent classes loud**: a `test()` per word, per chant, that re-derives
the invariant the renderer depends on.

For an auto-generation pipeline the principle is the same and sharper:
**a generator must run, on its own output, every guard the renderer's
correctness silently assumes** — reconstruction, index shape, token
agreement — and degrade cleanly (emit less, not broken) when it cannot
satisfy one. The judgment classes (4–6, 8) it cannot resolve alone;
those it should *flag*, with the specific reason, for the smallest
possible human review — never silently guess and move on.
