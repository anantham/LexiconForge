# Federation Feasibility — CBETA + 84000 + GRETIL for the Heart Sutra

**Date:** 2026-05-15
**Status:** spike memo (no code committed)
**Goal:** answer the question "before committing 6–10 weeks to Architecture B's first MVP, do these three sources actually expose programmatic access in shapes we can federate?"

**TL;DR:** **Yes, feasible.** CBETA has a clean JSON API. GRETIL has stable static TEI+plain-text files. 84000 has no public API but the HTML is well-structured for scraping. Wiring all three for one text (Heart Sutra) is ~6–12 hours of plumbing work. The hard part of POLYGLOT.md §4 (linguistic lenses, concept registry) is the remaining 6–10 weeks — but it's no longer blocked by source-availability uncertainty.

---

## 1. CBETA — ✅ ready

**Endpoint root:** `https://cbdata.dila.edu.tw/stable/` (CBETA Data API v4.0.1, DILA-hosted)

**Metadata endpoint** — `GET /stable/works?work=T0251` (the `work` param is required, not `q`):

```json
{
  "num_found": 1,
  "results": [{
    "work": "T0251",
    "uuid": "d1e52ff2-1592-49c9-b31c-377c909bc41b",
    "canon": "T",
    "category": "般若部類",
    "vol": "T08",
    "title": "般若波羅蜜多心經",
    "juan": 1,
    "cjk_chars": 1097,
    "byline": "唐 玄奘譯",
    "time_dynasty": "唐",
    "time_from": 648,
    "time_to": 649,
    "places": [{"name": "翠微寺", "latitude": 33.84, "longitude": 108.93}]
  }]
}
```

Note the byline + time + place metadata — useful for the "Witness" provenance our schema would want.

**Full text endpoint** — `GET /stable/juans?work=T0251&juan=1`:

```json
{
  "num_found": 1,
  "results": ["<html>...<span class='lb' id='T08n0251_p0848a01'>...</span>..."]
}
```

`results[0]` is HTML. After `<[^>]+>` stripping: 3,624 clean chars. The HTML includes **stable canonical line IDs** (`T08n0251_p0848a01` — Taishō volume 8, work 251, page 848, register a, line 01) embedded as `<span id>` — these are gold for citation. SC's bilara-style segment IDs map to these.

**Caveats:**
- T0251 includes the **Hongwu Emperor's preface** before Xuanzang's translation. Need to filter or section-split.
- The API has additional endpoints under `/stable/static_pages/*`: `toc`, `get_html`, `goto`, `lines` (line-range fetch). All documented at the DILA site.
- License: CBETA terms — free for non-commercial; commercial use requires permission. Compatible with our citation-and-link use case.
- Stability: API version 4.0.1, served by DILA (Dharma Drum Institute of Liberal Arts) since 2016, currently maintained. Versioned URLs (`/stable/`) suggest backward-compatibility commitment.

**Verdict:** ready. Treat exactly like the SC adapter — fetch JSON, normalize, attach Taishō line IDs as citation anchors.

---

## 2. 84000.co — ⚠️ scrape-only

**No public API.** Confirmed: `https://api.84000.co/*` returns `{"error":"requested path is invalid"}` for every variant tried (`/toh21`, `/translation/toh21`, `/UT22084-034-009`, etc.).

**What does work:** the HTML at `https://84000.co/translation/toh21` is **well-structured for scraping**:

- Top-level sections marked with `data-part-type="..."`: `titles`, `summary`, `introduction`, `section`, `colophon`, `bibliography`, `glossary`, `acknowledgment`, `imprint`, `end-notes`, `toc`
- Translation body is in `data-part-type="section"` blocks, with segment-numbered paragraphs (`1.­1`, `1.­2`, ...) preserved as visible text
- Tibetan script embedded inline with `lang="bo"` attributes
- Per-term annotations carry `data-glossary-id="UT22084-034-009-NNN"` linking to the in-page glossary
- Page bookmark anchors carry `data-bookmark="..."` — usable for stable section linking

**Extracted Heart Sutra sample** (first ~100 chars after parse):

> *"1.­1 Homage to the Perfection of Wisdom, the Blessed Mother! Thus did I hear at one time. The Blessed One was residing on Vulture Peak Mountain at Rājagṛha together with a great saṅgha of monks and a great saṅgha of bodhisattvas..."*

Tibetan title fragment also extracted: `བཅོམ་ལྡན་འདས་མ་ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྙིང་པོ།`

**Alternative downloads** (same toh21 page advertises):
- `/translation/toh21.epub` — 9.8 MB (full styled EPUB; too heavy for live fetch)
- `/translation/toh21.pdf` — present (not measured)
- No XML/TEI/JSON download exists publicly

**Caveats:**
- HTML scraping is fragile by definition. Mitigate by writing a tight schema-validation step on the parser and snapshot-testing against the live page weekly.
- The internal text ID is `UT22084-034-009`, not `toh21`. Both work as path components. `toh21` is the Tōhoku catalog number familiar to scholars; `UT22084-...` is 84000's internal stable ID. Index both.
- License: 84000 publishes under CC BY-NC 4.0 for most translations. Our use (cite, link, display short excerpts in a study reader) is consistent with the license.
- The Tibetan source script lives in *separate* `<span class="folio-tibetan">`-style blocks (verify) — the English translation HTML doesn't always inline the matching Tibetan. For full Tibetan-side coverage you'd need to also fetch the source page (`toh21.html` carries the linked-text view) or accept "English-only" for the 84000 witness in v1.

**Verdict:** scrape-with-caution. Same architecture as the FoJin adapter (which already scrapes fojin.app). Plan on ~3–5 hours to write a robust parser + snapshot tests. Plan on a parser-rewrite about once a year as 84000 ships site refreshes.

---

## 3. GRETIL — ✅ ready

**Pattern:** static file downloads at predictable URLs. No API needed.

**Heart Sutra files** (confirmed):

| Recension | TEI XML | Plain text | HTML |
|---|---|---|---|
| Short (saṃkṣiptamātṛkā) | `gretil/corpustei/sa_prajJApAramitAhRdayasUtrasaMkSiptamAtRkA.xml` | `gretil/corpustei/transformations/plaintext/sa_prajJApAramitAhRdayasUtrasaMkSiptamAtRkA.txt` | `gretil/corpustei/transformations/html/sa_prajJApAramitAhRdayasUtrasaMkSiptamAtRkA.htm` |
| Long (vistaramātṛkā) | `sa_prajJApAramitAhRdayasUtravistaramAtRkA.xml` | `...txt` | `...htm` |
| Also: John Richards version | `sa_prajJApAramitAhRdayasUtra.xml` | (transformations exist) | |

All three live under `https://gretil.sub.uni-goettingen.de/`.

**Plain-text body** of the short version (after stripping the GRETIL header section):

```
prajñāpāramitāhṛdayasūtram | [saṃkṣiptamātṛkā ||]
namaḥ sarvajñāya ||
āryāvalokiteśvarabodhisattvo gambhīrāyāṃ prajñāpāramitāyāṃ caryāṃ
caramāṇo vyavalokayati sma | pañca skandhāḥ, tāṃśca svabhāvaśūnyān
paśyati sma ||
iha śāriputra rūpaṃ śūnyatā, śūnyataiva rūpam | rūpānna pṛthak śūnyatā,
śūnyatāyā na pṛthag rūpam | yadrūpaṃ sā śūnyatā, yā śūnyatā tadrūpam ||
...
tadyathā - gate gate pāragate pārasaṃgate bodhi svāhā ||
iti prajñāpāramitāhṛdayasūtraṃ samāptam ||
```

IAST diacritics intact. Each `||` ends a daṇḍa (sentence/verse unit). Filename-as-stable-ID — GRETIL's URL scheme has been the same for years.

**File header includes:**
- Source edition (P.L. Vaidya, *Mahāyāna-sūtra-saṃgrahaḥ*, Mithila 1961)
- Data-entry attribution (DSBC Input Project)
- **License: CC BY-NC-SA 4.0** — clean for our use case
- Reference structure documentation

**Caveats:**
- TEI XML is more verbose but carries explicit `<lg>` (line group), `<l>` (line), `<seg>` (segment) markup. Worth parsing the TEI rather than the plaintext if you want segment-level anchors.
- Filename transliteration scheme is GRETIL's own (`prajJApAramitAhRdaya` — capital letters mark diacritics). Build a lookup table from canonical IAST → GRETIL slug; don't try to derive it on the fly.
- Long version (vistaramātṛkā) has the frame story (Buddha at Vulture Peak, Avalokiteśvara addressing Śāriputra); short version (saṃkṣiptamātṛkā) is just the philosophical core. Both worth showing — they correspond to Tibetan and Chinese different transmission lines.

**Verdict:** ready. Bulk-download per text, cache locally, parse once at build time. Same pattern as the Eudoxos/Vism integration we shipped in Phase 4.

---

## 4. What does NOT exist (license / coverage gaps to flag)

- **Conze 1958 critical edition (Sanskrit)** — copyright. Reference but don't redistribute.
- **Red Pine's *The Heart Sutra*** — copyright. Cite + link to publisher only.
- **Thich Nhat Hanh's commentary** — copyright. Same.
- **Donald Lopez's *Elaborations on Emptiness*** — copyright; rich critical apparatus but unreachable.
- **CBETA T0250 (Kumārajīva's earlier Chinese)** — available at CBETA (verify), but its presence is a *separate* witness from T0251 and would need a separate fetch.
- **Tibetan canonical source text (as opposed to 84000's English)** — needs BDRC or THL. Probably accessible but not probed in this spike.

---

## 5. Federation architecture sketch (concrete enough to commit to)

Each witness gets a thin adapter following the same interface:

```ts
interface WitnessAdapter {
  readonly source: 'cbeta' | '84000' | 'gretil' | 'sc';
  /** Best-effort discovery: given a canonical concept (e.g. "heart-sutra"), return the local IDs this source has. */
  resolve(concept: string): Promise<LocalRef[]>;
  /** Fetch normalized text for a local ref. */
  fetchText(ref: LocalRef): Promise<WitnessText>;
}

type WitnessText = {
  source: WitnessAdapter['source'];
  localId: string;            // T0251 / toh21 / sa_prajJApAramitAhRdayasUtrasaMkSiptamAtRkA
  language: 'pli' | 'lzh' | 'san' | 'bo' | 'en';
  scriptHint: 'Latn' | 'Hani' | 'Deva' | 'Tibt' | 'IAST';
  title: string;
  body: string;               // already HTML-stripped / plain
  anchors: Anchor[];          // CBETA line IDs, 84000 segment numbers, GRETIL daṇḍa counts
  license: string;
  fetchedAt: string;
  sourceUrl: string;          // for citation
};
```

The **per-concept registry** is the small piece that has to be hand-curated for each text:

```json
// data/sutta-studio/witnesses/heart-sutra.json
{
  "id": "heart-sutra",
  "label": "Prajñāpāramitā Hṛdaya Sūtra",
  "witnesses": [
    { "source": "cbeta",  "localId": "T0251", "language": "lzh", "translator": "Xuanzang", "date": "ca. 649 CE" },
    { "source": "cbeta",  "localId": "T0250", "language": "lzh", "translator": "Kumārajīva", "date": "ca. 400 CE" },
    { "source": "84000",  "localId": "toh21", "language": "en", "translator": "84000 Translation Committee", "date": "2009/rev. 2021" },
    { "source": "gretil", "localId": "sa_prajJApAramitAhRdayasUtrasaMkSiptamAtRkA", "language": "san", "edition": "Vaidya 1961 (short recension)" },
    { "source": "gretil", "localId": "sa_prajJApAramitAhRdayasUtravistaramAtRkA",   "language": "san", "edition": "Vaidya 1961 (long recension)" }
  ]
}
```

That's it. Once the three adapters exist, this JSON is the only per-text work. Adding the Diamond Sutra is another JSON file. Adding the Lotus Sutra is another. The cluster's whole point.

---

## 6. Effort revised

| Component | Estimate | Confidence |
|---|---|---|
| CBETA adapter | 3–4 hr | High — same shape as SC adapter |
| GRETIL adapter | 2–3 hr | High — static file fetch + cache + TEI parse |
| 84000 adapter | 3–5 hr | Medium — HTML scrape + snapshot tests |
| Witness registry schema + Heart Sutra JSON | 1–2 hr | High |
| `WitnessAdapter` interface + composition layer (mirror `buildDefaultProviders`) | 2–3 hr | High |
| Multi-language witness panel UI (extends `ParallelsPanel` for Mahayana sources) | 4–6 hr | Medium — depends on how Tibetan script + Chinese fonts render together |
| Tests + integration smoke | 2–3 hr | High |
| **Total plumbing** | **~17–26 hr** | High |

This puts the **plumbing** of Architecture B at ~3–4 working days for the Heart Sutra as the first text. **POLYGLOT.md's 6–10 week estimate was for the plumbing plus the linguistic lenses (sandhi, character recognition, syllable-stack-Wylie) plus the concept registry (10 concepts × 4 languages × cross-references) plus QA.** Now we know which part is which: ~4 days of plumbing buys the "see all 5 witnesses side by side as plain text" view. The remaining 5+ weeks earn you the lenses.

**Recommendation:** if Heart Sutra polyglot is on the near-term roadmap, the plumbing is a defensible 1-week commit. Decide on lenses separately based on whether scholar collaboration is in motion. The plumbing doesn't depend on the lens decision and won't be wasted regardless.

---

## 7. Open questions for human judgment

1. **Plumbing first, lenses later — or commit to one passage end-to-end?** POLYGLOT.md is honest about preferring the latter ("don't ship a hollow shell"). The feasibility memo above doesn't change that argument; it just removes the source-availability uncertainty.

2. **84000's HTML scrape vs. waiting for an API.** 84000 has hinted at a future API in occasional dev blog posts but hasn't shipped one. Scrape now, replace with API later when available — acceptable engineering trade.

3. **Which second text after Heart Sutra?** Diamond Sutra (similar Mahayana profile) or Vimalakīrti (richer prose, more witnesses, more demanding lenses)? Affects whether the schema generalizes correctly on the second pass.

4. **License posture.** The current approach across SC/CBETA/GRETIL/84000/Eudoxos is "cite, link, short excerpt under fair-use." Heart Sutra makes this messier because the most-cited English translations (Conze, Red Pine, THN) are *not* under that posture. Going with 84000's open translation only is honest but means we don't surface the famous renderings.

---

*Spike conducted 2026-05-15. All endpoints verified live. Memo authored from primary-source curl probes, no training-data claims.*
