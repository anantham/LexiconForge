# A reader's report: MN10 through the flagship page (2026-07-24)

Every instrument this project has pointed at the reading pages evaluates them
without reading them: the scorers diff JSON against a golden, the tap test
drives the DOM and counts what lights up, the sufficiency probe hands renders
to a deliberately weak student. This report is the missing lane: a strong
reader (Claude Fable 5, which reads Pāli) sitting with the flagship page as a
*reader*, the way the operator's own 15-minute read is meant to work. Method:
read `content/references/sutta/mn10.json` (the packet `/sutta/mn10` renders),
reconstruct each English line exactly the way `EnglishWord.tsx` does (linked
tokens display the linked word's sense; ghost tokens display their label), and
verify every claim below against the raw JSON and the view code before writing
it down.

## Where the interface serves the text

**The pacing enacts the syntax.** The famous opening sentence (ekāyano ayaṁ …
maggo …) is walked two words at a time, one dative purpose-clause per phase:
"for the surmounting of grief & lamentation" (phase-3), "for the disappearance
of pain & distress" (phase-4), "for the attainment of the true way" (phase-5).
Each clause gets its own dwelling. This is the dative case taught by rhythm
instead of by rule, and it is the strongest single design idea on the page.

**The refrain gets a room of its own.** Phase-aa is exactly three words:
*ātāpī sampajāno satimā* — "ardent, clearly knowing, possessing mindfulness."
The compiled cuts are textbook (ātāp·ī keeping the heat of √tap in "ardent;
with heat"; sam·pa·jān·o; sati·mā surfacing the -mant possessive). The
interface gives the sutta's most repeated phrase the same weight the
tradition gives it.

**Ghost words are honest syntax.** English words with no Pāli counterpart
render as unlinked ghosts ("is the", "for the", "of"). The interface thereby
*admits* what English needs that Pāli doesn't say, instead of smuggling it
into a gloss. Phase-x renders the catechetical beat "Katame cattāro?" as its
own tiny phase — "What (are the) four" — preserving the text's own rhetorical
pause.

**Tooltips carry real philology.** Ekāyano's first segment note says the
compound is "one of the most-debated" in the canon and gives the competing
senses (direct/one-way vs converging). A reader is told the truth about
uncertainty rather than handed a winner.

## Defects only a reader catches (each verified at the data + view code)

1. **"…attainment of the of the true way" (phase-5, live copy bug).** The
   ghost token supplies "(of the)" and the linked word's first sense is *"of
   the true way"* — ñāyassa's gloss already contains the particle the ghost
   adds. The rendered line duplicates it. Class, not instance: any ghost whose
   label ends with a word that also begins the next token's sense will do
   this. A mechanical tripwire is cheap (filed in TECH-DEBT-INBOX): flag
   ghost/sense particle collisions at compile or validate time.

2. **The page goes dark at the moment of inner knowing (root cause of the 16
   dead tap-test links).** In the turner simile (phase-av), the meditator's
   inner speech — *'dīghaṁ añchāmī'ti*, "I pull long" — is rendered as a
   ghost label `("I pull long")`, while the quoted Pāli words (av10b, av11)
   and the quotative particle *'ti* (av12) are linked to nothing. Hover them
   and nothing lights. The same pattern covers the breathing section's
   *'dīghaṁ assasāmī'ti* phases. Reading it, the miss is not cosmetic: the
   quoted phrase IS the act of pajānāti the passage teaches, and it is the
   one stretch of the line whose Pāli↔English thread is missing. Weaver-fix
   direction: quoted spans should link as a group (quote-ghost ↔ its quoted
   Pāli words, 'ti included as the close-quote).

3. **The same word is cut differently in different phases.** *bhikkhave* is
   `Bhikkh·ave` in phase-1 and `bhikkha·ve` in phase-av. Both are defensible
   alone; together they teach a reader two contradictory analyses of the
   commonest vocative in the canon. No current metric looks across phases —
   cross-phase cut consistency is a real, cheap candidate check.

4. **Quote marks glued into word surfaces.** *'dīghaṁ*, *'rassaṁ*, *'ti*
   carry their opening quote inside the word/segment text (surface `'dīgh`).
   Harmless to scoring, visible to a reader, and the likely reason alignment
   tooling around quotes keeps snagging.

5. **Quibbles (flagged, not verdicts).** `Kat·ame` is a dubious cut for the
   pronominal *katama* (katam·e or whole-word would teach better);
   `paṇi·dhā·ya` lumps the double prefix pa+ni into "paṇi";
   `attha·ṅ·gam·āya` promotes a sandhi niggahita to its own segment (it does
   make the seam visible, which has its own pedagogical charm); *sattānaṁ*
   listing "the seven" among its senses is attestation-faithful but
   context-noisy — the homophone belongs to a different word in this
   sentence. These are the places where dictionary-faithfulness and
   context-commitment pull apart; the page currently sides with the
   dictionary, which is the defensible default, but a reader feels the seam.

## A confession the fleet has earned

My first reconstruction of the English lines handled only `linkedSegmentId`
and ignored `linkedPaliId`, so phase-an rendered as a row of broken tokens and
I nearly filed "the packet has unlinked English" as a finding. It doesn't.
The probe arc's lesson — *the renderer you read through is part of what you
read* — recurred within twenty minutes of starting a document about careful
reading. Verified at the raw JSON before writing; the finding above about
quotation ghosting survived that check, the phantom one did not.

## One reflection

Reading this text through this interface has a quiet congruence to it. The
sutta teaches attention placed deliberately on one thing at a time; the page
literalizes that — nothing lights until you rest on a word, and only that
word's thread answers. Where the interface fails (the dead quoted speech),
it fails at exactly the text's center of gravity, the inner "I pull long" of
knowing what is happening while it happens. Fixing the weaver there is not
just link-coverage; it is the page catching up to its own subject.
