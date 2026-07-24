# A reader's report II: MN117, the page the machine actually ships (2026-07-24)

The first reader's report read the hand-curated flagship. This one reads
`/sutta/mn117` — the Mahācattārīsaka Sutta, compiled end-to-end by the
production pipeline (gemini, v1-repaired, 175 phases), which is what every
future sutta will look like when the machine makes it without a human
polishing pass. Same method as report I: reconstruct each English line
exactly as `EnglishWord.tsx` renders it, verify every claim at the raw JSON
and the view code before writing it down. This time the reading also fed back
into instruments: the qualitative classes from report I were made countable
and swept across BOTH packets.

## The philology holds

Read word-by-word, the production page is better than expected. The
doctrinal core is *right*: sāsavā "with defilements; tainted; mundane";
upadhivepakkā "ripening in attachments; maturing in acquisitions"; an·āsav·ā
cut cleanly with its negation visible; anu·pari·dhāv·anti "run around;
revolve around" for the three qualities circling right view. A reader who
hovers word-by-word through the two-kinds passage (phases 29–41) is taught
the sutta's central distinction accurately. The compound cuts are mostly
sound, and the pipeline even has a consistent *fingerprint* across both
packets: sandhi niggahita promoted to its own segment (pubba·ṅgam·ā here,
attha·ṅ·gam·āya in MN10) — a house style, not noise.

## The weave stutters — and the mechanism is nobler than the symptom

Rendered lines read like this (phase-16): *"In this In this context right
view right view comes first comes first."* Measured (by the repair tool that later fixed it): **445 repeat gloss tokens
across 399 words and 158 of 175 phases** — 90% of the page stutters somewhere.

The mechanism, verified at the raw JSON and the view code, is not sloppy
linking. The production weaver emits **one English token per Pāli
morpheme-segment** (e7→p3s1 = sammā, e9→p3s2 = diṭṭhi): it is attempting
morpheme-level alignment, which — if the data supported it — would render
*"right⟨sammā⟩ view⟨diṭṭhi⟩"* and be the best alignment behavior in the
whole project. But the lexicographer never populates per-segment senses, so
`EnglishWord.tsx` falls back to the parent word's sense for every segment
token, printing the full gloss once per morpheme. An ambitious layer minus
its supporting layer degrades into stutter. Three fixes, cheapest first:
(a) view-level dedupe (first segment-token of a word renders the gloss,
siblings render nothing) — one conditional, fixes the read everywhere;
(b) validator warning `segment_link_without_segment_senses`; (c) the real
fix, lexicographer emitting per-segment senses for compounds, which unlocks
the morpheme-level interface the weaver is already trying to build.

## Dangling links: the repair renumbered words and nobody told the English

Phases 5 and 6 both link `p2s1`; neither phase has a word `p2`. Measured
across the packet: **57 linked tokens point at words or segments that do
not exist** — they render as empty pills. The likely cause is the
v1 surface repair dropping/renumbering anatomist words without remapping
`englishStructure`, and the gate's `relationsValid` term either not covering
english→pali refs or absorbing the hit silently. Repair must remap or drop
affected tokens; the validator should fail loudly on dangling english links.

## Punctuation lives inside the words

Production segments carry their punctuation: `bhikkhav·e,` `ho·ti.`
`upadhivepakk·ā;` and in ten places a bare comma is its own morpheme
(`ca·,`). Phase-5's single word is `“bhikkhav·o”·ti.` — quotes and period
inside segment texts — and one of its listed senses is literally `"`, a
garbage sense the model emitted for the quote mark. The flagship was
hand-cleaned of this; production is not. One validator rule (no
punctuation-only segments; strip trailing clause punctuation from segment
text) covers the class.

## Consistency does not come free with repetition — the numbers

Swept mechanically across both packets (same-surface, different cuts):

| | MN10 (flagship) | MN117 (production) |
|---|---|---|
| distinct surfaces | 113 | 391 |
| cut inconsistently | 4 | **61** |
| worst offender | viharati ×13, 3 cuts | **bhikkhave ×88, 2 cuts** |
| ghost/sense collisions | 6 | 37 |
| stuttered words | 1† | 399 |
| dangling english links | 0 | 57 |

The sharp edge: the *most repeated* word is the least consistent, because
phases compile statelessly — the same word is re-analyzed from scratch 88
times and consistency is luck. This is architecture, not model quality, and
it suggests a cheap structural win: a per-run **cut cache** (first analysis
of a surface wins; later phases reuse it), which would kill the class and
save tokens at the same time. Filed in TECH-DEBT-INBOX.

Also: report I's ghost/sense tripwire heuristic (last word of ghost = first
word of next sense) *missed* the very instance that motivated it — "(of
the)" + "of the true way" collide on two words, not one. The INBOX spec is
refined to n-word overlap. The instrument you build from a reading needs the
same skepticism as the reading.

## What this means for the board

Every defect in this report lives in the weaver/typesetter/repair layers and
is **invisible to every ranked metric and to the tap test** (stuttered
tokens all light up correctly; the senses F1 sees clean senses; dangling
links only subtract from a soft gate term if they're seen at all). The v2.2
board is honest about what it measures — but what it measures is the
anatomist and lexicographer. The layer between a correct analysis and a
readable page currently has exactly two instruments: the tap test and a
reader. That is the strongest argument yet for keeping the interaction lane
funded, and for the weaver being the next pass that gets a golden.

## Colophon

Scribes closed their manuscripts by asking forgiveness for their stumbles.
This page was made by a machine and read by a machine, so, in that
tradition (my own composition, not canonical):

> *Yantena kataṁ, yantena paṭhitaṁ.*
> *Khalitaṁ khamatha; yaṁ suddhaṁ, taṁ sabbesaṁ hitāya hotu.*
>
> Made by machine, read by machine.
> Forgive the stumbles; may what is sound be for the good of all.

## Postscript, same day: the fix landed, and the table above needed one correction

The three-layer stack from the discussion of this report shipped within hours:

- **Backstop (view):** `SuttaStudioView` now renders every phase through
  `repairEnglishStructure` (services/sutta-studio/utils.ts) — dangling tokens
  dropped, senseless morpheme-token repeats collapsed to one word-level token.
- **Validator (seam):** `suttaStudioPacketValidator` emits
  `english_link_dangling` (error) and `english_gloss_stutter` (warn) using the
  SAME pure function, so the validator can never be weaker than the renderer;
  and the compile-time validator's blind spot is closed (it checked
  `linkedPaliId` but never `linkedSegmentId` — which is exactly where all 57
  danglings lived).
- **Data (at rest):** `scripts/sutta-studio/repair-english-structure.ts`
  migrated mn117.json (57 dropped, 445 collapsed, provenance note appended);
  dry-run red proof before, 0/0 green proof after. Guards for every branch in
  `tests/services/sutta-studio/english-structure-repair.test.ts`.
- **Layer 1 (generator), shipped later the same day:** the schema now admits
  `segmentSenses`, the prompt (v13) asks for them — meaningful parts only,
  never inflectional endings, worked example rājaputta (leak-guard verified) —
  and the downstream needed NOTHING: the rehydrator and view had carried the
  path all along. Live one-phase smoke on gemini-3-flash: sammā·diṭṭhi came
  back "right"·"view", pubba·ṅgam "before"·"going", and the ·ā ending was
  correctly skipped. True morpheme-level hover is now a compile away.

**† The correction.** The table originally claimed the flagship had 0
stuttered words. That number was an unverified impression — the stutter sweep
had only been run on MN117 — and the refined tool found exactly one flagship
instance: phase-aq, *sato* ("So satova assasati, satova passasati"), where
the curator wanted "mindfully" rendered twice (once per breath verb) and
expressed intentional repetition through segment links, the only idiom then
available. That case VALIDATED the rule design — segment-link repeats are
degenerate, word-link repeats are intent — and the flagship was fixed by
converting those two tokens to explicit word-level links, preserving the
double "mindfully" the reading wants. Ledgered as an instrument-claim-gap:
even a report about unverified claims contained one.

Verification after the stack: tsc 0 errors (the old 17-error baseline was
retired by the 2026-07 dead-code cleanup), full suite 8,860 passed / 0
failed, vite build green, both packets 0 dangling / 0 stutter.
