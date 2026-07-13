# Theory of Impact: Warranted Translation as Coordination Infrastructure

**Status:** Living hypothesis document, first synthesized 2026-07-12. Companion to
[Vision.md](./Vision.md); where Vision.md's older "repackage content for the receiver's
context" language conflicts with this document, this document is current (see
"Personalize the scaffolding, not the source" below).

**Epistemic status:** The conceptual argument is held with high confidence; the claim
that results on fixed-source language translation transfer to mediation between living
communities is an open hypothesis (roughly even odds), and this document says so
wherever it matters. Nothing here claims to address AI control, containment, or
deceptive alignment.

**Provenance of this document:** drafted by Claude (Fable 5) as editor, synthesizing
the operator's thesis drafts, Claude's threat-model essays, and a cross-family
adversarial review by GPT-5.6 (Codex) that inspected this repo's ADRs and the live
product. Key corrections adopted from that review are marked. A document about
warranted translation should disclose its own chain of custody.

---

## 1. The project in one paragraph

LexiconForge treats translation as an inspectable, just-in-time interface over a
stable source, not as a replacement text. A reader starts with a calm rendering and
progressively reveals the bridge: morphology, alternative senses, alignments,
supplied words, citations to human authorities, and the places where scholars
disagree. The benchmark ([sutta-studio](https://read.adityaarpitha.com/bench/sutta-studio))
evaluates language models not as prose generators but as **interface compilers**: did
every part of the source survive, were additions exposed, were facts grounded, were
disagreements preserved, how much deterministic repair did the output need. The
immediate product is a richer way to read unfamiliar texts. The larger project is a
protocol for verifiable semantic interoperation between communities that do not share
language, concepts, or authorities.

## 2. Threat model

### The asset

Civilization's error-correction loop: the capacity of different communities to form
world-models shared *enough* to coordinate on, to detect when those models are wrong,
and to transmit corrections across group boundaries. Not "global consensus reality";
humanity has never had one. What is at risk is an **overlapping reference layer**:
common source material, public evidence, and mutually recognized procedures for
locating disagreement. (Correction adopted from cross-family review: consensus was
always the wrong target; the reference layer is the load-bearing thing.)

### The mechanism stack, in order of onset

1. **Generation removes the shared-source constraint.** Filter bubbles curated a
   common stream of events; generative silos can synthesize their own streams, their
   own examples, authorities, and explanatory styles, indefinitely.
2. **Dialect drift.** Personalization is linguistic, not just topical: models learn to
   speak each user's idiolect back to them, and idiolects that stop being exercised
   against strangers drift apart.
3. **Verification scarcity.** Producing persuasive content becomes nearly free while
   verifying object-level claims stays expensive. Under time pressure people
   rationally substitute proxies: speaker reputation, institutional affiliation,
   tribal membership. This works tolerably inside a community and fails at the
   boundary, where the communities do not recognize the same authorities. Valuable
   warnings get discounted before their content is examined.
4. **Bridge concentration and median-voice regression.** What translation remains
   flows through a handful of models, and a translator with a strong prior regresses
   the text toward it. This repo has measured the mechanism at the morpheme level:
   models rewrite Pāli toward Sanskrit ("atthi" becoming "asthi"), the source's
   particularity overwritten by the training distribution's center of mass, at 6-16%
   of words even under explicit instruction not to. The endgame is a world socially
   fragmented into silos whose interiors are all decorated by the same interior
   designer: fragmented and flattened at once.
5. **Mediation becomes load-bearing before it becomes auditable.** AI systems will be
   asked to mediate claims across trust boundaries. As institutions grow dependent on
   fluent mediation, switching costs, urgency, and automation bias make rigorous
   auditing progressively harder to start. The instruments have to exist before the
   dependence does. (This is the argument for building them now, on low-stakes
   material, rather than during the crisis that needs them.)

### Pathways to existential risk

Epistemic degradation is an existential **risk factor** in Ord's sense: a multiplier
on direct hazards, not itself a kill mechanism. Three pathways, in decreasing order of
confidence:

- **Coordination latency.** Pandemics, biosecurity incidents, and AI security
  incidents require coordinated action among communities with different vocabularies
  and authorities, on timelines the hazard sets. Communication cannot guarantee
  cooperation; incompatible interests and motivated obstruction are real and are not
  translation problems. But even *willing* actors cannot cooperate until they can
  determine what another community is claiming, on what evidence, and how much was
  changed in transit. In a fast-moving crisis, the time to establish that
  understanding can itself be fatal. COVID was the dry run: a visible, physical hazard
  failed to produce factual convergence; "is this training run dangerous" is far less
  visible.
- **The AI oversight chain is itself a chain of translations.** Model internals into
  evals, evals into capability claims, claims into lab decisions, decisions into
  public and regulatory understanding. Every link can be unfaithful, from
  chain-of-thought that misdescribes the computation (the model mistranslating
  itself) to benchmarks that reward the wrong thing, a failure class this repo has
  caught in its own instruments repeatedly. If the chain fails, systems are deployed
  on the strength of translations nobody could check.
- **Lock-in.** If AI mediation of belief-formation becomes total and
  self-reinforcing, humanity can lose the ability to notice and correct its own
  trajectory: loss of long-term potential without any extinction event. Held with the
  least confidence; stated because it is the pathway where the harm is existential by
  definition.

### Honest weak links

Epistemic crises have precedent (the printing press bought a century of religious
war) and civilization recovered; the "this time is different" claim rests on speed,
the adaptive/agentic nature of the mediation layer, and the timing coincidence with
the direct hazards. Fragmentation alone disarms rather than kills. And the dominant
failure mode of inter-community communication today is motivational, not semantic;
the intervention below is scoped accordingly.

## 3. The intervention: make bridge failure legible

The project is not premised on building an interpreter that deserves trust. It asks
how to build an interpreter whose failures are **cheap to inspect**. An inspectable
bridge keeps the source visible, anchors claims to evidence, exposes additions and
omissions, preserves disagreement, publishes coverage and repair burden, and lets the
represented community contest the rendering. It gives low-trust actors a shared
object through which the interpreter can be checked, without first trusting its
operator.

Provenance is not truth. Inspection does not make the source right. What it changes
is the reader's ability to distinguish: what the source said, what the translator
supplied, what an authority attested, what the model inferred, what remains disputed,
and what was silently lost.

**The metric** (correction adopted from cross-family review): not "audit cost," which
a misleading interface can minimize while deceiving, but **time to justified reliance
or justified rejection** at a specified error-detection threshold. The success
condition is never agreement; it is that people can determine, faster and more
accurately, what they are agreeing or disagreeing about, and whether the bridge
deserves reliance.

**The personalization boundary.** Just-in-time context may adapt which explanation
comes first, how technical it is, and which prerequisite concepts get introduced. It
must not determine which evidence is concealed, whether a real disagreement is
silently resolved, or what the source is permitted to mean. Personalize the
scaffolding, never the source. Context changes the path by which you reach the
source, not the source you are allowed to reach. (This supersedes Vision.md's older
"repackaging" framing, which described the assimilative mechanism this project now
exists to counter.)

## 4. Why start with Pāli, Malayalam, Chinese

Natural languages are the **model organism** for bridge failure. They exhibit the
mechanisms that matter (prior-capture, silent omission, fabricated provenance,
alignment error) while offering what living subcultures never will: ground truth.
There is a fact of the matter about a Pāli root; there is no fact of the matter about
the correct rationalist gloss of "bias," because that disagreement is partly about
what the word should mean. Instruments get calibrated where answer keys exist, then
carried (as instruments, never as scores) into contested territory.

Two further reasons. Neutral ground buys credibility: a subculture-translation
benchmark published cold reads as a partisan act; the same instruments validated on a
dead language read as metrology. And the tradition itself is the proof of concept:
the Pāli canon survived twenty-five centuries inside a transmission silo whose
reciter lineages and redundant refrains work like error-correcting codes, and its
best-known export is also the cautionary tale, *sati* becoming "mindfulness" becoming
McMindfulness, a documented case of paraphrase-translation denaturing a concept as it
crossed a boundary.

**The transfer gap, stated plainly:** fixed-source translation has stable strings,
dictionaries, named translators, and auditable disagreement. Mediation between living
communities adds strategic ambiguity, contested canons, shifting meanings, conflicts
of interest, and no neutral adjudicator. Performance on the first is not yet evidence
about the second. That transfer is this project's central untested hypothesis.

## 5. What is already implemented (evidence, not aspiration)

Each row is a bridge-failure class from the threat model, with the shipped
countermeasure and where it is recorded.

| Bridge failure | Countermeasure shipped | Record |
|---|---|---|
| Silent omission (a bridge that drops the hard 40% and reads fluently) | Drop penalty: omitted golden words charge misses; coverage published; one model dropped 41% of words while posting competitive per-kept-word fidelity before this landed | SUTTA-012 |
| Prior-capture / corruption of the source | Surface-integrity metric (exact canonical-token membership); deterministic repair layer with every repair disclosed as a validation issue; measured 6-16% pre-repair across models | SUTTA-025 enforcement, compare-page chips |
| Fabrication with confidence | Root/POS/morph facts graded against a human dictionary (DPD), fabricated-vs-silent split; measured root accuracy 7%-50% across models | SUTTA-013 facts layer |
| Assimilation into the grader's own voice | Facts-vs-prose split: facts to deterministic authority, prose to a judge that asks "correct and teaching?" not "phrased like us"; killed the main circularity residue (the golden's prose is Claude-worded) | SUTTA-013 |
| Wrong alignment (teaching a false word-mapping) | Alignment golden + Align F1 over word-link pairs; provenance layered per link (mechanical vs curated vs skeptic-upheld) | SUTTA-013 part 2 |
| Judge pathology | Measured: the semantic judge's rank agreement with drop-adjusted quality is *negative* (ρ≈-0.27) because it grades only surviving words; judge scores are therefore advisory, never ranked | SUTTA-013 weight study |
| Metric gaming | Anti-Goodhart record: density metrics replaced after wrong behavior scored better (SUTTA-009); a flattering metric relaxation was implemented, adversarially reviewed, and reverted (SUTTA-011) | SUTTA-009, SUTTA-011 |
| Infrastructure confounds presented as model ability | Degraded-phase disclosure chips (a model whose calls failed on 57% of phases is labeled as such next to its coverage number) | compare page |
| Safety layer laundering a weak model | Grounded track scores RAW output and publishes the repair count production would need | SUTTA-014 (designed) |
| Hidden circularity | Public provenance panel: who authored what, on whose authority, known circularity list, closed-book badge | leaderboard grounding block |
| Benchmark lying to its own authors | Incident record: mixed-judge publish window, skeleton-draw confound, loose-metric false passes; each converted into a gate or instrument | ADRs + worklog |

The deepest shared principle: **make silent transformation visible**. Every
mechanically detectable silent failure becomes loud; judgment failures route to
narrow human review.

## 6. The falsifiable hypothesis

> At a fixed level of underlying translation quality, an inspectable interface
> (source-visible, provenance-bearing, omission-aware) reduces the time and expertise
> required to detect material errors, understand unresolved disagreement, and reach
> appropriately calibrated reliance, compared with a fluent personalized summary or an
> ordinary translation.

Test with three conditions (fluent personalized summary; plain source-to-target
translation; inspectable interlinear), measuring: time to detect an injected material
omission or mistranslation; fabrication-detection rate; time to reach the supporting
or conflicting source; confidence-accuracy calibration; preservation of disagreement
across the bridge; time for a mixed-community team to reach a correct joint decision;
and whether inspectability produces genuine calibration or merely provenance theater.

If the effect fails to transfer beyond fixed-source translation, the negative result
still constrains an important hypothesis: it would mark where semantic tooling stops
and incentive or institutional design must take over. The fallback position is a
high-integrity translation product and a validated evaluation methodology.

## 7. Adversary list

Failure modes an adversarial or merely optimized bridge exhibits, which the
instruments must eventually cover: source poisoning; selective omission tuned to what
the reader will not check; dominant-language normalization; fabricated consensus;
judge capture; correlated errors across model families; persuasive personalization
(the echo chamber rebuilt inside the bridge); provenance theater (working URLs that
verify transport, not evidentiary relevance); and forced legibility (translation as
surveillance of communities that did not consent).

Current instruments catch incompetence-shaped failure. Incentive-shaped failure needs
the next generation: adversarial evals where the translator is rewarded for shading
meaning, and reader-model probes measuring whether an artifact moves a weaker model's
beliefs in directions the source does not warrant. The pedagogical probe (a student
model answering questions from the compiled artifact alone) is the embryo of that
instrument.

## 8. Limits and non-claims

- **Not alignment-in-the-narrow-sense.** Nothing here bears on deceptive alignment,
  power-seeking, containment, or dangerous-capability evaluation, except through the
  oversight-chain argument in §2.
- **Translation cannot manufacture goodwill.** Motivational and political failures
  are untouched. The claim is only that inadequate, unauditable communication should
  not be the reason cooperation arrives too late when cooperation is possible.
- **Dual use.** A system that translates a worldview faithfully also makes that
  worldview easier to target, manipulate, or assimilate. Consent and contestation are
  therefore requirements, not decorations.
- **Consent is currently a principle, not a shipped system.** There is no formal
  contestation, correction, deletion, or "do not translate me" protocol yet, and the
  privacy debt register is honest about gaps. Some opacity is protective; the ethic is
  "make faithful translation possible, and consensual," never "translate everything."
- **Evidence base is one domain, one language pair fully instrumented, one curator.**
  Every generalization in this document is a hypothesis carrying that caveat.

## 9. Evaluation ladder (roadmap)

1. **Pāli/English fixed-source interlinear** (current): instruments validated, board
   live, rubric v2.2 (facts + alignment + grounded track) in progress.
2. **Malayalam and Chinese**: different language structures force language-specific
   interfaces; tests that the "interface compiler" construct generalizes beyond one
   typology.
3. **English↔Chinese AI-governance vocabulary**: the highest-leverage single bridge on
   the coordination path (安全 spans "safety" and "security"; the alignment sense of
   "AI safety" demonstrably mangles between the two policy discourses). Simultaneously
   a natural-language and a subculture problem; the natural second act.
4. **English-internal subcultures** (technical alignment ↔ AI ethics/STS ↔ policy and
   security communities), with consented primary corpora and community reviewers, and
   new tests for pragmatics, strategic framing, and bidirectional comprehension.
5. **Live mediated dialogue with correction rights**, then **crisis-simulation
   studies** measuring warning transmission, disagreement localization, and joint
   decision quality rather than paraphrase similarity.

## 10. The compact thesis

AI makes expression abundant and leaves verification scarce. When claims cross
communities that do not share authorities, people substitute tribal trust for
expensive object-level audit, and AI bridges between those communities will become
load-bearing before anyone is incentivized to audit them. LexiconForge builds and
validates the audit instruments now, on language pairs where ground truth exists,
measuring exactly how current models corrupt what they carry: so that warranted
translation, translation you can check, is a solved instrumentation problem before
the bridges everyone depends on stop being checkable.
