# LexiconForge

**An early prototype of inspectable semantic interoperation across languages, and eventually worldviews.**

LexiconForge explores a different answer to translation: not a single replacement text, but a just-in-time interface over a source. A reader can begin with a fluent rendering, then progressively reveal pronunciation, alternative meanings, many-to-many alignments, dictionary evidence, translation witnesses, omissions, and scholarly disagreement only when needed.

The source should remain stable while the scaffolding adapts to the reader. Personal context may decide which explanation appears first or how much detail is useful; it must not silently rewrite the source, evidence, attribution, or disagreement.

These readers are experiments toward that goal. They are at different levels of maturity, and none should be treated as proof that the full vision has been achieved.

## Choose an interface

### Public readers

| Interface | What it currently exposes | Status |
| --- | --- | --- |
| [Web Novel Reader](https://lexiconforge.vercel.app/) | Raw, AI, and attributed reference renderings; span-level questions, feedback, editing, and export | Live |
| [Pāli Reader / Sutta Studio](https://read.adityaarpitha.com/sutta/mn10) | Source surface, morphemes, word senses, phrase alignment, dictionary grounding, and translation witnesses | Live experiment; deepest inspectability testbed |
| [Liturgy Reader](https://read.adityaarpitha.com/liturgy) | Script, sound, word and morpheme detail, concept links, and community-specific translation witnesses | Live and evolving |
| [Classical Chinese Buddhist Reader](https://read.adityaarpitha.com/sutta/fojin/9?juan=1) | Independent source and English columns plus source metadata | Early foundation on `main`; the full Chinese-specific lens is not implemented |

The Pāli, Chinese, and liturgy interfaces share infrastructure, but they do not inherit one universal display. Their designs are documented in [Pāli–English](./docs/sutta-studio/PALI_ENGLISH_DESIGN.md), [Classical Chinese](./docs/sutta-studio/CHINESE_DESIGN.md), and the [community chant model](./docs/sutta-studio/COMMUNITY_CHANT_MODEL.md).

### Research prototypes not yet public

| Interface | Language-specific question | Current status |
| --- | --- | --- |
| Malayalam Studio | How should a heritage reader cross the script-decoding barrier using sound, akshara, agglutination, register, and sentence alignment? | Unmerged prototype on `feat/opus-malayalam-reader` |
| Italian Reader | For an English speaker who can already pronounce Italian, should the interface foreground clauses, cognates and false friends, fused forms, and verb endings instead of a sound layer? | Local-only Calvino prototype on `feat/local-grounding-pipeline`; copyrighted text is not publishable |
| Pinocchio pipeline | Can the same Italian evidence pipeline work on a public-domain text and fail visibly when sentence alignment drifts? | Pipeline artifact only; no reader route, and its alignment gate currently fails honestly |

These statuses are deliberate. “Exists in a branch,” “passes an evidence gate,” and “has a working public reader” are different claims.

## One protocol, different interfaces

A UI element belongs only when it answers a question this reader has about this language's hidden machinery. Nothing is inherited from another reader by default.

- Pāli makes inflection, compounds, and lexicographic witnesses unusually important.
- Malayalam may need sound and script support before semantic detail becomes useful.
- Italian–English can often use cognates as a bridge, while emphasizing false friends and fused grammar.
- Classical Chinese needs character, compound, phrase, and textual-witness layers that do not pretend whitespace gives the word boundaries.
- Multilingual liturgy must preserve community recitation, script, and translation differences rather than force every tradition through one canonical pivot.

Alignment is therefore not a 1:1 word map. It may connect sounds, written units, morphemes, words, phrases, concepts, and textual witnesses; it must also represent fusion, splitting, reordering, and grammatical material that appears on only one side.

## Progressive inspectability

The intended reading path is progressive and on demand:

1. **Read:** See the source with one coherent rendering.
2. **Inspect:** Ask for sound, segmentation, alternatives, or local context at the point of uncertainty.
3. **Trace:** Follow many-to-many links across meaning-bearing chunks rather than trusting a paragraph-level paraphrase.
4. **Verify:** Open the cited dictionary, source passage, or named translation witness through a working URL.
5. **Compare:** Surface omissions, low-confidence claims, and real disagreements without silently resolving them.

The interface should lower the cost of checking a translation, not overwhelm the reader with the entire audit trail at once.

## The contract under test

The long-term contract below is not a description of every screen already shipped.

- Keep the exact source surface recoverable.
- Reveal detail progressively rather than as an information dump.
- Treat translations as attributed witnesses, not ground truth by default.
- Anchor claims to inspectable evidence and working provenance links.
- Measure coverage so omissions cannot disappear silently.
- Distinguish source text, deterministic analysis, model inference, and human interpretation.
- Preserve uncertainty, alternatives, and expert disagreement.
- Personalize the scaffolding, never the evidence.
- Make unsupported or failed analysis visibly fail closed.
- Translate consensually; legibility is not always owed.

Current interfaces satisfy this contract unevenly. For example, the public MN10 reader is a substantial prototype, but it still has low-hanging inspectability work. Those gaps are inputs to the evaluation program, not details to hide behind the word “inspectable.”

## Evaluation: models as interface compilers

The readers discover what a faithful bridge must preserve. The benchmarks test whether models can preserve it.

[Open the public Sutta Studio benchmark](https://read.adityaarpitha.com/bench/sutta-studio)

Models are evaluated as **interface compilers**: systems that assemble reader-facing layers from a source and a set of authorities. The public Pāli benchmark is currently the deepest multi-model implementation. It tests questions such as:

- Did every part of the source survive?
- Is the displayed surface exact, or was it normalized toward the model's prior?
- Are morphological and semantic alignments plausible?
- Are dictionary and factual claims grounded, attributed, and reachable?
- Did the model fabricate evidence or conceal missing coverage?

The broader evaluation contract also includes whether omitted claims, contested interpretations, and genuine cruxes remain visible. Benchmarking every interface and every model to equal depth is a direction of travel, not a current claim.

## Why this might matter for catastrophic-risk coordination

Pandemics, biosecurity threats, and AI security incidents require people from different disciplines, institutions, languages, and political communities to identify enough common ground for joint action. Mutual intelligibility does not guarantee cooperation, but slow or false understanding can delay it at exactly the wrong time.

Generative AI makes customized persuasive media cheap while object-level verification remains expensive. Under pressure, people rationally fall back to speaker reputation, institutional trust, or tribal heuristics. AI interfaces are likely to mediate more claims across those trust boundaries; if they become load-bearing before their failures are measurable, switching costs and institutional dependence will make honest auditing harder.

LexiconForge's proposed contribution is narrower than “solve coordination”: reduce the time and effort required to justify reliance on, or rejection of, a mediated claim. Source-visible interfaces, coverage and integrity measures, attributed witnesses, and claim-level provenance make bridge failure more legible.

> Cheaper generation → greater verification pressure → more reliance on AI-mediated bridges → measurable bridge failures → lower time to justified reliance or rejection → less avoidable coordination delay.

This is an indirect theory of impact, not a claim to solve model control or alignment. Read the full [theory of impact](./docs/THEORY_OF_IMPACT.md) and [project vision](./docs/Vision.md).

### Honest limits

- Better translation cannot create goodwill, aligned incentives, or political cooperation; sometimes clarity sharpens conflict.
- The move from natural-language testbeds to translation between living subcultures and worldviews is still an untested transfer hypothesis.
- Perfect inspectability is not the goal. People and communities retain a right to opacity, privacy, consent, and contestation.
- The project may reduce one coordination and epistemic-risk factor; it is not itself a complete x-risk intervention.

<details>
<summary><strong>Web Novel Reader: current product features</strong></summary>

The original LexiconForge application is a local-first web-novel reading and translation workbench.

- Bring API keys for Gemini, Claude, OpenAI, DeepSeek, OpenRouter, image, and audio providers.
- Compare raw text, AI renderings, and attributed human or fan translation witnesses inline.
- Ask contextual questions about selected spans, give feedback, edit output, and retain version history.
- Generate illustrations or audio, track cost and usage, and export curated EPUB or session data.
- Persist reading state in IndexedDB and preload chapters for smoother navigation.
- Import from adapters including Kakuyomu, Syosetu, Dxmwx, Kanunu, NovelCool, BookToki, SuttaCentral, and FoJin.

API keys and reading data are stored locally by default, but translation and media requests are sent to the providers the reader selects; their data policies still apply.

![LexiconForge web novel reader demo](media/demo_2x_24fps.gif)

[Watch the full demo](https://youtu.be/KtzXbnZNLs8)

</details>

## Run locally

```bash
git clone <your-fork-url>
cd LexiconForge
npm install
npm run dev
```

Add only the provider keys you intend to use to `.env.local`. See the [environment variable reference](./docs/guides/EnvVars.md) and [provider guide](./docs/guides/Providers.md) for current names and behavior.

Reference translations can be merged into an exported session as attributed witnesses:

```bash
npm run merge-fan-translations path/to/session.json path/to/reference-translations/ [output.json]
```

## Documentation

- Start with the [documentation index](./docs/START_HERE.md), [vision](./docs/Vision.md), and [theory of impact](./docs/THEORY_OF_IMPACT.md).
- Read the [Architecture Decision Records](./docs/adr/) for significant design decisions.
- Configure [settings](./docs/guides/Settings.md), [environment variables](./docs/guides/EnvVars.md), and [providers](./docs/guides/Providers.md).
- Inspect [schemas](./docs/guides/Schemas.md), [workers](./docs/guides/Workers.md), and [debugging flags](./docs/guides/Debugging.md).
- See the [audio](./docs/features/Audio.md), [EPUB](./docs/features/EPUB.md), and [Chrome extension](./chrome_extension/README.md) documentation.

## Community and support

- Join the [Telegram group](https://t.me/webnovels) for help and discussion.
- Use the [Patreon concierge](https://www.patreon.com/posts/lexicon-forge-is-141128641?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link) for guided setup, bespoke prototypes, priority requests, and API credit.
- Support ongoing work through Patreon or Ethereum at `adityaarpitha.eth`.
