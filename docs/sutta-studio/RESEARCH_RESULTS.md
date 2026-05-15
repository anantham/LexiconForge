# Research Results — Buddhist Source Text Digital Infrastructure

> Output from running `docs/sutta-studio/RESEARCH_PROMPT.md` on 2026-05-14.
> All 11 unique URLs spot-checked HTTP 200 within 24h of this date.
> See AMORTIZATION.md §"External resources backlog" for status of each.

## Headline find — Eudoxos / edhamma Visuddhimagga (TEI XML)

**URL:** https://eudoxos.github.io/vism/ (redirects to https://edhamma.github.io/vism/)
**Repo:** https://github.com/edhamma/vism
**Confidence:** Very High — verified file tree

The headline find. Ñāṇamoli's English Path of Purification translation has been converted to TEI XML + Sphinx HTML with stable URL anchors. The repo at `edhamma/vism/vism/` contains:

| File | Size | Purpose |
|---|---|---|
| `book.6.tei` | 3.79 MB | Full Visuddhimagga body, TEI-tagged |
| `gloss.tei` / `gloss.xml` | 116 KB | **Glossary: Pāli term → Vism location** |
| `index.tei` / `index.xml` | 554 KB | Index: Pāli term → page/section |
| `toc.xml` | 28 KB | Table of contents |
| `bib-1.tei` / `bib-1.xml` | ~12 KB | Bibliography |

**`gloss.tei` is the unblocking artifact for GROUNDING Phase 4.**

Estimated effort to wire:
1. Fetch `gloss.tei` via raw GitHub URL (~1 min)
2. TEI XML parser — extract Pāli term + Vism location (~30 min)
3. Convert to `data/sutta-studio/grounding/commentarial-glosses.json` schema (~30 min)
4. Build `CommentarialGlossProvider` mirroring `ContestedTermProvider` (~30 min)
5. Wire into `groundingPass` + `buildDefaultProviders` (~15 min)
6. Test on demoPacket (~5 min)

**Total: ~2 hours.** Was estimated at 6-10 hours in original GROUNDING.md.

### Licensing caveat (Eudoxos)

Edhamma's project page states: "I contacted BPS who has the © (no reply so far)." We're using BPS-copyrighted Ñāṇamoli translation. For our use case (chip displays brief gloss + link to Edhamma's hosted page, no full-text redistribution), this should fall under citation / fair use — but worth noting before commercial deployment.

## Other verified resources

| Resource | URL | Status |
|---|---|---|
| BPS Official EPUB | https://bps.lk/olib/bp/bp207h_The-Path-of-Purification-(Visuddhimagga).epub | 200 — fallback if Eudoxos doesn't work |
| Open Buddhist University EPUB | https://buddhistuniversity.net/smallepubs/buddhaghosa_1956_vsm.epub | 200 — slightly optimized; same source |
| HKU Papañcasūdanī Part 1 (2022) | https://www.buddhism.hku.hk/publication-post/papancasudani-commentary/ | 200 — MN commentary suttas 1-3, PDF |
| SuttaCentral bilara-data | https://github.com/suttacentral/bilara-data | 200 — already wired |
| DharmaNexus | https://dharmanexus.org | 200 — multilingual parallels (Pāli/Sanskrit/Tibetan/Chinese) |
| MITRA-Parallel corpus | https://github.com/dharmamitra/mitra-parallel | 200 — 1.74M aligned sentence pairs |
| Pali Translation Project | https://palitranslation.org/ | 200 — Sumaṅgalavilāsinī DN commentary "nearly finished" end-2025 |
| CPD (Critical Pali Dictionary) | https://cpd.uni-koeln.de/ | 200 — incomplete (only up to letter 'kā') |
| TLB (Bibliotheca Polyglotta) | https://www2.hf.uio.no/polyglotta/ | 200 — UI only, no API |
| BDRC | https://www.bdrc.io/ | 200 — Pāli palm-leaf manuscripts under OCR development |

## Resource verdicts for our roadmap

### Green-light (wire immediately)

- **Eudoxos / edhamma `gloss.tei`** — ~2 hr to Phase 4 implementation. THE win.

### Yellow-light (wire when scope expands)

- **Pali Translation Project** — Sumaṅgalavilāsinī "nearly finished" end-2025. Watch for release. Will integrate with SuttaCentral's bilara directly.
- **HKU Papañcasūdanī** — PDF only, 3 sutta scope. Bridge for MN commentaries until Pali Translation Project ships.

### Red-light (parked until polyglot vision)

- **DharmaNexus / MITRA** — 1.74M cross-language parallels + Gemma 2 MITRA-MT LLM. Powerful but ~25-40 hr integration, primarily valuable for polyglot reader (POLYGLOT.md §4). Park until Heart Sutra MVP is committed roadmap.

### Reference only (no integration needed)

- **CPD** — partial coverage, dense format. Useful manual reference.
- **TLB** — no API, web-only.
- **BDRC** — image-only; revisit when their OCR matures.

## Key insight from the research

> "Bridging this gap in a digital architecture requires transitioning away from memory-based citation and human-reliant Pali reading toward structured, machine-readable datasets that can be queried programmatically."

This validates the GROUNDING.md design principle. The Eudoxos find is the concrete unlock.

## Update history

- 2026-05-14 — Initial research run, all URLs verified, Eudoxos identified as breakthrough.
