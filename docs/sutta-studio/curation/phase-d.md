# Phase-d — curation log

**Date:** 2026-05-12
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied with gate-2 amendments. 4 morph additions + 10 senses upgraded with epistemic basis + citations + 1 anchor + 4 new packet.citations. Parallel DPD-bug fix shipped first (`be2b141`) so kurūnaṁ has real DPD attestation.
**Pāli:** Kammāsadhammaṁ nāma kurūnaṁ nigamo
**Readable:** a market town of the Kurus named Kammāsadhamma
**Canonical segments:** mn10:1.2 (apposition completing phase-c's locative frame)

---

## 0. Phase brief

```json
{
  "phaseId": "phase-d",
  "pali": "Kammāsadhammaṁ nāma kurūnaṁ nigamo",
  "literal": "Kammāsadhamma named of-Kurus market-town",
  "readable": "a market town of the Kurus named Kammāsadhamma",
  "function": "Names the specific place within the Kuru country. Closes the locative frame opened in phase-c. Introduces the X-nāma-Y appositional naming construction.",
  "tensions": [
    {
      "id": "X-nāma-Y appositional naming",
      "primary": true,
      "description": "Pāli wraps proper-name (Kammāsadhammaṁ) + naming particle (nāma) + head-noun-in-apposition (nigamo) with genitive modifier (kurūnaṁ). English requires either 'a Y named X' or 'in X, a Y of the Z' — the linear order is rearranged. The middle word nāma is an indeclinable particle, not a verb; English idiom prefers a verb form (named, called)."
    },
    {
      "id": "compound place-name with Jātaka etymology",
      "description": "Kammāsadhamma analyzed compositionally reads as 'where the Spotted-One was tamed' (Jātaka tradition: King Kammāsapāda was a man-eating ogre tamed in this region). DPD attests only 'name of a town in the Kuru country' — the bare proper noun. The etymological gloss is curatorial/commentarial, not lexical."
    },
    {
      "id": "Kuru in a new case (gen pl)",
      "description": "Phase-c used kurūsu (loc pl). Phase-d uses kurūnaṁ (gen pl). Same stem (kurū-), same vowel-lengthening pattern, NEW case ending (-naṁ). Pedagogically: reader sees the stem identity persist across cases — a Pāli grammar moment that surface-level English reading would miss entirely."
    },
    {
      "id": "compound noun with etymological transparency (nigama)",
      "description": "nigamo = ni- (down) + gam (root: go) + -o (nom sg masc). DPD literally glosses 'going down' — supports the existing tooltips' reading 'place people resort to'. Unlike Kammāsadhamma (proper noun, opaque to default reader), nigamo's etymology is structurally inspectable in the Pāli surface."
    }
  ],
  "register": "narrator continues; closes the locative frame; introduces the place specifically",
  "scope": ["mn10:1.2"]
}
```

**Plain-language summary:** Phase-d names the *specific town* where the Buddha was dwelling within the Kuru region. It teaches three things in one short clause: (a) how Pāli's `X nāma Y` works as appositional naming where English would use a relative clause or simple "named X"; (b) how the same Kuru-stem appears in a new grammatical case (genitive plural -naṁ vs phase-c's locative plural -su) — *same word, different ending, different meaning*; (c) how compound place-names can encode story (Kammāsapāda tamed here) that the bare name conceals.

---

## 1. Current packet snapshot

Pre-curation state of phase-d (before this commit):

| word | id | wordClass | senses (pre) | tooltips (pre) | relation (pre) | new-field gaps |
|---|---|---|---|---|---|---|
| `Kammāsadhammaṁ` | d1 | content | 3 (place name / etymology / literal compound) | 3+3+2 | — | no isAnchor; no morph on d1s3; senses lack basis+citations |
| `nāma` | d2 | function | 1 (named) | 3 | — | no morph (it's indeclinable — none needed); sense lacks basis+citations |
| `kurūnaṁ` | d3 | content | 3 (of the Kurus × 3 framings) | 2+2 | location-like ownership → d4 | no morph; no relation basis; senses lack basis+citations |
| `nigamo` | d4 | content | 3 (market town / township / trading center) | 2+2+2 | — | no morph on d4s3; senses lack basis+citations |

**English structure:** ghost `at` (ed1g, ghostKind=required) + ed4 + ed3 + ed2 + ed1 — i.e., English re-orders to `at [d4 nigamo] [d3 kurūnaṁ] [d2 named] [d1 Kammāsadhammaṁ]`. Pāli-to-English reordering is total (4 of 4 content positions move). Strong pedagogical content already in tooltips for d1 (Jātaka), d4 (compound breakdown).

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-d",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:20396",
      "lemma": "kammāsadhamma",
      "pos": "nt",
      "excerpt": "kammāsadhamma [nt]: name of a town in the Kuru country",
      "decisionRelevance": "PRIMARY for d1 sense 'Kammāsadhamma'. Bare attestation only — no etymological breakdown. Confirms the lexical existence of the proper noun and gives it neuter gender."
    },
    {
      "id": "cite:dpd:dpd:36427",
      "lemma": "nāma",
      "pos": "ind",
      "excerpt": "nāma [ind]: called; means; by the name of; namely; lit. name",
      "decisionRelevance": "PRIMARY for d2 sense 'named'. The specific DPD entry that captures the X-nāma-Y naming-particle usage (DPD has 7 nāma entries; this one is the relevant indeclinable)."
    },
    {
      "id": "cite:dpd:dpd:22524",
      "lemma": "kurū",
      "pos": "masc",
      "excerpt": "kurū [masc]: name of the people of Kuru; Kurus",
      "decisionRelevance": "PRIMARY for d3 sense 'of the Kurus' — REUSED from phase-c (kurūsu also resolved here). Same lemma, new case (gen pl -naṁ vs loc pl -su). Validates the cross-case stem-identity claim."
    },
    {
      "id": "cite:dpd:dpd:22502",
      "lemma": "kuru",
      "pos": "masc",
      "excerpt": "kuru [masc]: name of a country",
      "decisionRelevance": "SECONDARY for d3 'of the Kurus'. REUSED from phase-c. The country-reading vs people-reading distinction surfaces again in phase-d."
    },
    {
      "id": "cite:dpd:dpd:36863",
      "lemma": "nigama",
      "pos": "masc",
      "excerpt": "nigama [masc]: town; market town; lit. going down",
      "decisionRelevance": "PRIMARY for d4 senses 'market town' + 'township'. Crucially, DPD's 'lit. going down' validates the ni+gam etymological tooltips already in the packet — independent attestation of the compound parse."
    },
    {
      "id": "cite:dpd:dpd:74785",
      "lemma": "nigama",
      "pos": "nt",
      "excerpt": "nigama [nt]: town; market town; lit. going down",
      "decisionRelevance": "SECONDARY for d4 senses. Neuter alternate gender attestation; same glosses. Both gender homonyms in DPD."
    }
  ],
  "providerNote_kurūnaṁ": {
    "preFix": "Pre-fix, DPD stripper returned 'kura [nt]: rice' — the SAME conflation pattern as phase-a evaṁ and phase-c kurūsu. Hit #3 of 3 in batch 2.",
    "fix": "Applied as commit be2b141: removed 'ūnaṁ'/'unaṁ' from PALI_ENDINGS (parallel to c33b115's removal of 'ūsu'/'ūhi'); added bare 'naṁ' paired with the existing vowel-shortening rule. Kept 'ānaṁ' (a-stem gen pl is a real single ending). Coverage: 86.5% → 86.9% on MN10.",
    "postFix": "kurūnaṁ now resolves to ['kurū', 'kuru'] — identical to phase-c's kurūsu resolution. The fix closes schema tension #1 (DPD stripper conflation) for u-stem oblique plurals."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels — per phase-a gate (c), NOT placed in PhaseView.parallels." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:1.2 — line stable across all witnesses." }
  ],
  "gaps": [
    "Aṭṭhakathā commentary on the Jātaka backstory (Kammāsapāda) not yet wired (Tier-1 commit C deferred). Would strengthen the d1 sense #2 'curatorial' epistemic basis with a commentarial attestation.",
    "SC dictionary_full continues to produce opaque payloads for these specialized lemmas (Kammāsadhammaṁ, kurūnaṁ) — known parser limitation from phase-a §10.5."
  ]
}
```

**Citation count: 6 DPD entries (2 reused from phase-c, 4 new); 0 commentary; 0 variants.**

---

## 3. Applied diff (post gate-2 amendments)

Five amendments from Aditya's gate-2 verdict, applied:

### 3.1 d1 (Kammāsadhammaṁ)

- ✅ **isAnchor: true** — approved (the semantic centerpiece; the proper noun the locative clause builds toward).
- ⚠️ **d1s3 morph**: original draft had `{ case: "acc", number: "sg" }` ("accusative of naming"). Amended to `{ number: "sg", gender: "n" }` + ambiguity-aware tooltip. Reason: DPD attests `kammāsadhamma [nt]`; neuter sg has identical nominative and accusative forms. The X-nāma-Y construction does not unambiguously disambiguate, and overclaiming `acc` without a grammar source crosses the pay-rent threshold. Reference: Aditya's amendment §2 ("Do not force acc unless you have a grammar source for the X nāma Y construction here").
- ✅ **3 senses with separated epistemic basis**:
  - "Kammāsadhamma" → `lexical` + dpd:20396 + high confidence.
  - "Where the Spotted One was Tamed" → `curatorial` + medium confidence. Note softened per Aditya's amendment §3 to make the Jātaka derivation clearly traditional/commentarial, not asserted as lexical history.
  - "the spotted-dhamma place" → `etymological` + medium confidence. Note distinguishes the morphological breakdown from the Jātaka etymology above.

### 3.2 d2 (nāma)

- ✅ Sense "named" → `lexical` + dpd:36427 + high confidence. No morph (indeclinable).

### 3.3 d3 (kurūnaṁ)

- ✅ d3s1 morph `{ number: "pl" }` — stem is plural.
- ✅ d3s2 morph `{ case: "gen", "number": "pl" }` — the bare gen-pl ending now correctly attested.
- ✅ d3s2.relation extended with `confidence: "high"` + `epistemicBasis: "grammatical"`.
- ✅ 3 senses with `lexical` + reused phase-c citations (dpd:22524 + dpd:22502).

### 3.4 d4 (nigamo)

- ✅ d4s3 morph `{ case: "nom", "number": "sg", "gender": "m" }` — gender supported lexically (DPD nigama [masc]); case/number grammatical.
- ✅ "a market town" + "a township" → `lexical` + both DPD nigama entries.
- ⚠️ **"a trading center"**: original draft had `confidence: medium`. Amended to `confidence: low` per Aditya's amendment §6 (DPD doesn't directly attest "trading center"; it's a curatorial expansion). Note strengthened to make DPD-non-attestation explicit.

### 3.5 packet.citations

- ✅ 4 new entries (dpd:20396, dpd:36427, dpd:36863, dpd:74785). 14 → 18 total. 2 reused from phase-c (dpd:22524, dpd:22502).

---

## 4. Summary table

| Change | Where | Verdict |
|---|---|---|
| `isAnchor: true` | d1 | ✅ approved |
| `morph` on d1s3 | d1s3 | ✅ amended (gen/num only; no case overclaim) |
| `morph` on d3s1 + d3s2 | d3 | ✅ approved |
| `morph` on d4s3 | d4s3 | ✅ approved |
| Senses (10 total) with epistemicBasis + sourceCitationIds + confidence | d1-d4 | ✅ approved (sense #2 of d1 note softened; trading-center confidence downgraded) |
| Relation epistemicBasis on d3s2.relation | d3s2.relation | ✅ approved (`grammatical`) |
| 4 new packet.citations | packet.citations | ✅ approved |
| Reuses phase-c kurū/kuru citations | d3 senses | ✅ approved |

---

## 5. Schema tensions

### Tension #1 (DPD stripper) — **RESOLVED**

Hit #3 in 3/3 batch-2 phases (evaṁ → eva, kurūsu → kura, kurūnaṁ → kura). Crossed the threshold phase-c §5 set for "overwhelming case." Fixed in **commit be2b141** (this session): removed `ūnaṁ`/`unaṁ` from PALI_ENDINGS, added bare `naṁ`, kept `ānaṁ` (a-stem gen pl is a real single ending). Pattern: vowel-lengthening + bare ending, parallel to c33b115's -su/-hi fix.

Both u-stem oblique plural endings are now correctly handled (-su loc pl, -naṁ gen pl, -hi inst pl). Tested via 10 new regression cases in `scripts/build-dpd.test.ts`.

### Tension #7 (EpistemicBasis enum) — **first phase to exercise `'curatorial'`**

Phase-d is the first phase where the new `'curatorial'` value (added in 4323310) carries real load:
- d1 sense #2 "Where the Spotted One was Tamed" → `curatorial`
- d4 sense #3 "a trading center" → `curatorial`

Both are honest applications: the Jātaka derivation is curator/tradition-inferred, not DPD-attested; "trading center" is a curatorial expansion on the bare "market town" gloss. Pre-extension, these would have been mislabeled as `'etymological'` (which would have been laundering).

**Methodological observation (Aditya's framing):** phase-d forces the system to separate four distinct kinds of claim per word:
1. **Lexical attestation** — what DPD says outright
2. **Grammatical** — what Pāli morphology tells us about case/number/etc.
3. **Traditional/commentarial etymology** — the Jātaka or Aṭṭhakathā derivation
4. **Curatorial pedagogical expansion** — modern explanatory framings

The enum-extension was structurally necessary; phase-d validates it empirically.

### No new tensions surfaced

All 8 remaining schema tensions from phase-a/b/c logs unchanged. Hit counts:
- **Compound types (Kammāsadhamma)**: 1 hit (phase-d only) — defer until phase-e shows another compound.
- **Naming particle nāma as discourse marker**: 1 hit — defer.

---

## 6. Plain-register observations (NOT in diff — for future plain-first rewrite pass)

Per protocol §3.4 self-check, three tooltips would fail the pay-rent + reader-profile check:

- **d1s3 "Name ending"** — strips to itself when grammar-terms is off; the term "Name ending" doesn't teach the default reader what a name-ending IS or why it matters.
- **d2s1 `"X nāma Y" = "Y named X"`** — syntactic formula; cryptic to a reader who doesn't already understand the equation. Aditya's suggested plain-first rewrite (carried forward): *"nāma is the naming word: it turns the previous name into 'called Kammāsadhamma.'"*
- **d3s2 "[Genitive Plural] Possession"** — strips to "Possession" with grammar-terms off. Possessive of what? Underwhelming.

Tooltip rewrite scope deferred to a dedicated plain-first pass (HANDOVER §Pending #2).

---

## 7. Open questions

1. **d1s3 case marking ambiguity**: applied `{ number: "sg", gender: "n" }` per Aditya's amendment. If a commentarial source later disambiguates (Aṭṭhakathā likely names the case for the X-nāma-Y construction), upgrade to specify `case`.
2. **d4 trading-center sense (`confidence: low`)**: kept rather than dropped per Aditya's prefence "or downgrade." Re-evaluate after phase-e/f — if multiple nigama-class words appear and the trading framing keeps not earning its keep, drop.
3. **Cross-phase decision precedent**: phase-c's relation `c1s2 → c2 "Dwelling IN"` and phase-d's relation `d3s2 → d4 "Town OF"` both use `epistemicBasis: 'grammatical'` for case-derived relations. This is now a *pattern* — should the protocol §3.4 or §2.4 document "case-derived relations are grammatical by default"? Hold for ratification after batch 2 retrospective.

---

## 8. Outcome

- **Packet diff:** applied; commit in metadata.
- **Tests:** ✅ 321/322 pass under `scripts/build-dpd.test.ts` + `services/providers` + `tests/components` (1 flake in `SessionInfo.test.tsx` — confirmed passes in isolation, unrelated to phase-d).
- **JSON:** validates; phase-d structure confirmed (d1 isAnchor, d1s3 morph, all 10 senses with basis, d3s2.relation.epistemicBasis="grammatical", trading-center confidence="low", 18 total citations).
- **Renderer:** not yet visually inspected in this commit (next browser session if needed).
- **Coverage:** batch 2 of CURATION_PROTOCOL §6 (phase-b, phase-c, phase-d) now **complete**. Per protocol: re-evaluate the protocol itself before doing batch 3 (phase-e through phase-h).
