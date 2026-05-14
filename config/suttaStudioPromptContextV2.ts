/**
 * Sutta Studio prompt context — v2 amendments
 *
 * Captures protocol learnings from MN10 hand-curation (batches 1-4, phases a-h + phase-1).
 * Intended as an OVERLAY appended after the existing v1 prompt context strings.
 *
 * The v1 context (suttaStudioPromptContext.ts) already covers:
 *   - Word class (content/function/vocative)
 *   - Segmentation rules
 *   - JARGON-WITH-EXPLANATION tooltip pattern
 *   - Polysemy expectations
 *   - Refrain IDs
 *   - Basic relation types
 *
 * v2 adds what we learned from doing the work:
 *   - Plain-first §3.4 (stronger than jargon-with-explanation — drops jargon when
 *     it doesn't earn its rent in this specific tooltip)
 *   - Arrow-earning rule (relations should mark Pāli case-quirks English doesn't
 *     share, NOT universal grammatical roles like subject/object)
 *   - Sense metadata: epistemicBasis + confidence + sourceCitationIds
 *   - Anchor selection (one isAnchor per phase, semantic centerpiece)
 *   - Translator-debate awareness (cite scholarly traditions when readings diverge)
 *   - Cross-phase awareness (when phase-state context is available, reference prior
 *     appearances of recurring lemmas)
 *
 * See docs/sutta-studio/CURATION_PROTOCOL.md §3.4 + §9.1 + §3.4.1.
 * See docs/sutta-studio/FEATURES.md §1.3 arrow-earning rule.
 */

export const SUTTA_STUDIO_V2_TOOLTIP_REGISTER = `
TOOLTIP REGISTER (v2 — supersedes "Avoid bare Latin grammar terms" in v1):

Apply the pay-rent rule. For EACH technical term you reach for in a tooltip, answer:
  (1) What concept does this label that the reader needs precision about?
  (2) Why is precision needed in THIS sentence?

If you can't answer both, the term doesn't pay rent — replace with plain English.
If you can, keep the term AND gloss it in the same sentence.

Reader profile (assumed default unless overridden):
  A thoughtful adult, no Pāli training, possibly familiar with popular Buddhism
  but not with Indic linguistics. Reading carefully but not academically.

Examples of register choices:

  AVOID (v1 jargon-style):           PREFER (v2 plain-first):
  "[Past participle] Marks            "The -ta ending makes the verb past — 'has been
   completed action: 'heard'"          heard'. Pāli uses the same form for the act
                                       (heard) and the content (what was heard)."

  "[Genitive Plural] Possession"      "The -naṁ ending means 'of the [plural]' —
                                       Pāli marks 'belonging to' on the noun itself,
                                       where English would say 'of the'."

  "[Vocative] Calling out:            "The -e ending is vocative singular — used
   'O Sir!'"                           when calling out to one person, respectfully."

  "√bhikkh: to beg"                   "'bhikkh' is the root, related to begging —
                                       but specifically religious mendicancy, not
                                       poverty."

DROP these tooltip ornaments unless they pay rent:
  - Bracketed grammar prefixes like [Adjective], [Genitive Plural], [Vocative]
  - Bare √ symbols without prose (write "the root 'X'" not "√X")
  - Emoji markers (📍 🔗 📢 👥 🎯 ⚡) as defaults — only include if the user
    explicitly enables emoji in settings (the renderer toggles them)
  - "Stem: X" / "Suffix: Y" labels without explanation

KEEP these when they pay rent:
  - The technical term itself (genitive, past participle, vocative, etc.) IF the
    tooltip explains what it does in the same sentence
  - Cross-references to other words/phases when teaching a paradigm
  - Cognate observations (English voice ← vac; mark/march ← magga) when
    pedagogically illuminating
`.trim();

export const SUTTA_STUDIO_V2_ARROW_EARNING_RULE = `
RELATIONS — ARROW-EARNING RULE (v2 — refines v1 relations guidance):

A relation earns its arrow when the Pāli case-marker does work English doesn't
have an analog for. If the same role exists transparently in English (via word
order or a direct preposition), DROP the relation — the arrow adds clutter
without pedagogical lift.

EARNED examples (use the arrow for these):
  - Genitive functioning as agent of a passive verb:
      "me sutaṁ" → relation { type: 'action', label: 'Heard BY' }
      English uses 'by' for the same role; Pāli uses the genitive case.
  - Accusative-of-time-when:
      "samayaṁ" → relation { type: 'location', label: 'Time WHEN' }
      English uses 'at/on' as a preposition; Pāli marks time on the noun.
  - Locative of social-membership:
      "kurūsu" → relation { type: 'location', label: 'Dwelling IN' }
  - Genitive-of-possession (especially when the relationship is structural):
      "kurūnaṁ nigamo" → relation { type: 'ownership', label: 'Town OF' }
  - Genitive functioning as dative recipient of speech-verb:
      "bhagavato paccassosuṁ" → relation { type: 'direction', label: 'Replied TO' }

NOT EARNED — drop the relation:
  - Subject of an active-voice verb:
      "bhagavā āmantesi" ('the Blessed One addressed') — DO NOT add a 'Said BY'
      arrow. Subject-of-active-verb is universal across English and Pāli;
      word order alone communicates it.
  - Direct object of a transitive verb:
      "bhikkhū āmantesi" ('addressed the monks') — DO NOT add a 'Said TO'
      or 'Addressed WHAT' arrow. Object role is universal; English uses
      word order.
  - Demonstrative agreement:
      "ayaṁ maggo" ('this path') — DO NOT add a 'This IS' arrow.
      Adjective/demonstrative agreement with head noun is universal.

Rule of thumb: if the relation label reads as a plain English preposition
(BY, AT, IN, OF, TO/FOR) AND the preposition reveals a Pāli morphological
choice English doesn't make, the arrow earns it. If the label reads as
"subject", "object", "predicate", or otherwise names a universal grammatical
role, drop it. The English row's linkedSegmentId already cross-highlights
universal roles via word-order alignment.

The 4-color palette (ownership/direction/location/action) stays uncluttered.
Arrows mean "look here, English doesn't do this."
`.trim();

export const SUTTA_STUDIO_V2_SENSE_METADATA = `
SENSE METADATA (v2 — new fields not in v1):

Every sense should carry these optional-but-encouraged fields:

  epistemicBasis: 'lexical' | 'grammatical' | 'curatorial' | 'etymological' | 'commentarial' | 'contextual' | 'comparative'

    - 'lexical': directly attested in DPD or another dictionary provider
      (use when the sense was pulled from the dictionary context provided to you)
    - 'grammatical': derived from Pāli morphology / syntactic rule
      (use for case/tense/number-derived claims)
    - 'curatorial': curator inference, often interpretive or commentarial
      (use when you're choosing a reading that goes beyond bare DPD attestation)
    - 'etymological': compositional reading from word-history / compound parse
      (use for "the literal meaning" readings)
    - 'commentarial': attributable to Aṭṭhakathā or another commentary
      (use only when explicit commentary citation is present)
    - 'contextual': disambiguated by surrounding sutta context
    - 'comparative': supported by parallel-passage agreement

  sourceCitationIds: array of citation IDs (format: "cite:dpd:dpd:NNNNN")
    - Wire each lexical sense to the specific DPD entry it draws from.
    - Use the citationId provided in the dictionary context.
    - For curatorial/etymological senses, this field may be empty.

  confidence: 'high' | 'medium' | 'low'
    - high: DPD-attested or rock-solid grammatical claim
    - medium: defensible but contested (translator-debate region)
    - low: interpretive expansion or compositional/etymological reading

  notes: optional string explaining WHY this reading
    - Especially important for 'curatorial' senses — cite the tradition
      (e.g., "Bhikkhu Bodhi favors 'solitary' for this reading")
    - For etymological senses, explain the compositional logic
    - Keep notes short (1-2 sentences); they show in the audit modal, not
      in the primary tooltip
`.trim();

export const SUTTA_STUDIO_V2_ANCHOR = `
ANCHOR SELECTION (v2 — new field; one per phase):

Set isAnchor: true on EXACTLY ONE word per phase — the semantic centerpiece.

The anchor is the word the phase is teaching ABOUT. Heuristics:

  - If the phase has a main verb (the action), anchor the verb:
      phase-c "kurūsu viharati" → anchor viharati (the dwelling)
      phase-e "tatra kho bhagavā bhikkhū āmantesi" → anchor āmantesi (addressed)
      phase-g "...te bhikkhū bhagavato paccassosuṁ" → anchor paccassosuṁ (replied)
      phase-h "Bhagavā etad avoca" → anchor avoca (said)

  - If the phase has a famously-contested word or a doctrinal claim-word,
    anchor THAT (even if it's an adjective):
      phase-1 "Ekāyano ayaṁ Bhikkhave maggo" → anchor Ekāyano
        (the famously-debated compound; the WHOLE phase is teaching its meaning)

  - If the phase is a place-name introduction, anchor the proper noun:
      phase-d "Kammāsadhammaṁ nāma kurūnaṁ nigamo" → anchor Kammāsadhammaṁ

  - If the phase is purely framing (no clear action or contested word), the
    most-modified noun:
      phase-a "Evaṁ me sutaṁ" → anchor sutaṁ (what was heard — the content)

Visual effect: the anchor gets a subtle amber underline + medium weight.
Implicit cue, not a badge.

Don't put isAnchor on more than one word per phase. If you can't pick, the
phase is probably too big — flag it.
`.trim();

export const SUTTA_STUDIO_V2_TRANSLATOR_DEBATE = `
TRANSLATOR-DEBATE AWARENESS (v2 — new pattern):

For words with significant scholarly disagreement (ekāyano, ātāpī, sampajāno,
satimā, anupassī, paññā, etc.), generate MULTIPLE senses representing the
distinct translator readings. Each sense should carry:

  - epistemicBasis: 'curatorial'
  - confidence: matched to scholarly weight (high for canonical / medium for
    defensible / low for interpretive)
  - notes: citing the translator tradition

Example structure for Ekāyano (5 senses):
  [
    { english: "direct",      epistemicBasis: "curatorial", confidence: "high",
      notes: "Sujato's choice. 'Going-straight-to-one-goal'. Common in modern translations." },
    { english: "one-way",     epistemicBasis: "curatorial", confidence: "medium",
      notes: "Older translations. Emphasizes that this is THE method, no alternative. Doctrinally controversial." },
    { english: "solitary",    epistemicBasis: "curatorial", confidence: "medium",
      notes: "Bhikkhu Bodhi has favored 'the path one walks alone' — emphasizing meditative interiority." },
    { english: "convergent",  epistemicBasis: "curatorial", confidence: "low",
      notes: "Interpretive: 'all paths converge here'. Pedagogically interesting; less textually grounded." },
    { english: "only",        epistemicBasis: "curatorial", confidence: "low",
      notes: "The exclusivist reading. Most modern translators avoid in favor of 'direct'." }
  ]

This lets the reader cycle through scholarly opinions rather than receive an
authorial verdict. Pāli is genuinely ambiguous on these words.

When NOT to use this pattern: words with clear lexical attestation and no
significant scholarly disagreement (most function words, common nouns).
`.trim();

export const SUTTA_STUDIO_V2_CROSS_PHASE = `
CROSS-PHASE AWARENESS (v2 — when phase-state context is available):

If you're given prior-phase context (e.g., a "phase state envelope" listing
recurring lemmas already seen), make tooltips for recurring lemmas
cross-reference the prior appearance.

The patterns to recognize:

  1. Same lemma, NEW grammatical form
     - bhagavā (nom-sg in phase-b/e) → bhagavato (gen-sg in phase-g)
     - bhikkhu stem appears as: bhikkhū (acc/nom-pl), Bhikkhavo/Bhikkhave (voc-pl)
     - Tooltip should reference: "Same stem as in phase-X, now in [new case]"

  2. Same lemma, NEW context/role
     - Subject vs object vs vocative across consecutive phases
     - Tooltip should reference: "In phase-X this same noun was [prior role];
       here it's [new role]. Same Pāli word, two contexts."

  3. Parallel grammatical structures across phases
     - phase-c's historical-present viharati vs phase-e's true-aorist āmantesi
     - Three aorist verbs across phases e/g/h with different stem-classes
     - Tooltip should reference: "Compare to [phase-X word]: both are [pattern],
       but [difference]"

How to keep it tight:
  - ONE cross-reference facet per recurring lemma; don't pile them
  - Reference distance: ≤4 phases back (closer is better)
  - The cross-reference is ONE facet among the per-segment cycle; other facets
    cover meaning, grammar, etc.

If no prior-phase context is provided, skip this pattern — don't hallucinate
references.
`.trim();

/**
 * Compose all v2 amendments as a single block to append after the v1 context
 * in the Phase prompt builder.
 *
 * SUTTA_STUDIO_V2_SENSE_METADATA retired 2026-05-14. The four fields it
 * prescribed — epistemicBasis, confidence, sourceCitationIds, morph — were
 * audited against actual UI consumption and found to be either never
 * rendered or rendered only in a curator-only panel that's off by default.
 * The LLM was also producing them as confident-sounding hallucinations
 * (it can't actually classify whether a sense is "DPD-attested" vs
 * "curatorial" without doing the lookup; high/medium/low confidence
 * levels are not grounded). Verifiable evidence (clickable citationIds)
 * is better than asserted confidence levels.
 *
 * The named export `SUTTA_STUDIO_V2_SENSE_METADATA` is kept above for
 * historical reference and possible reinstatement if the consumer UI is
 * built; it just isn't part of the active prompt anymore.
 */
export const SUTTA_STUDIO_V2_AMENDMENTS = [
  '\n─────────────────────────────────────────────────────────────────────────────',
  'V2 PROTOCOL AMENDMENTS — refinements learned from MN10 hand-curation (batches 1-4):',
  '─────────────────────────────────────────────────────────────────────────────\n',
  SUTTA_STUDIO_V2_TOOLTIP_REGISTER,
  '\n─────────────────────────────────────────────────────────────────────────────',
  SUTTA_STUDIO_V2_ARROW_EARNING_RULE,
  '\n─────────────────────────────────────────────────────────────────────────────',
  SUTTA_STUDIO_V2_ANCHOR,
  '\n─────────────────────────────────────────────────────────────────────────────',
  SUTTA_STUDIO_V2_TRANSLATOR_DEBATE,
  '\n─────────────────────────────────────────────────────────────────────────────',
  SUTTA_STUDIO_V2_CROSS_PHASE,
].join('\n');
