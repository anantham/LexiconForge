# Deep-Research Prompt — Machine-Readable Buddhist Source Texts

> Standing prompt for resource discovery. Run on any frontier model with web
> search (Claude, ChatGPT, Gemini, Perplexity). Output goes into
> `docs/sutta-studio/AMORTIZATION.md` §"External resources backlog".
>
> The goal: every Buddhist term in Sutta Studio should have a clickable trail
> to verifiable sources. We have most of the lexical + translator layers
> wired. The commentarial layer (Visuddhimagga, Aṭṭhakathā) is the open gap.
> This prompt searches for digital infrastructure we may not yet know about.

---

## Copy-paste-ready prompt

```
# Research Task: Machine-Readable Buddhist Source Texts

I'm building an interactive Pāli/English reader for Buddhist suttas. Each
word in the reader has clickable citation chips linking to verified sources:
translator renderings, encyclopedic discussion, commentarial glosses, etc.
The architecture treats trust-me-bro citations as a bug — every claim needs
a verifiable URL.

I've wired these sources successfully:
- DPD (Digital Pali Dictionary) — Pāli lemma lookups via SuttaCentral's
  /define/{lemma} route. Stable URLs.
- SuttaCentral bilara-data — per-verse translator renderings (Sujato full
  MN/SN/AN/DN coverage; partial Bodhi/Anandajoti). Available via JSON API
  at https://suttacentral.net/api/bilarasuttas/{uid}/{translator}
- dhammatalks.org — Thanissaro Bhikkhu translations (per-sutta HTML).
- Wikipedia — encyclopedic references for ~20 contested Pāli terms.

The gap I'm stuck on: COMMENTARIAL GLOSSES. The Visuddhimagga (Buddhaghosa)
glosses many technical terms (e.g., ñāya = ariyaṭṭhaṅgika-magga, sati =
apilāpana, etc.) and is the canonical scholarly reference. The
Aṭṭhakathā sutta-commentaries (Papañcasūdanī, Sumaṅgalavilāsinī, etc.)
gloss individual sutta passages.

I've ruled out these candidates (don't re-suggest):
- VRI tipitaka.org — has the Pāli but no programmatic chapter index I can
  extract; would need Pāli reading
- Wikipedia article on Visuddhimagga — doesn't enumerate chapters
- accesstoinsight.org's Ñāṇamoli "Path of Purification" PDF — PDF only,
  not reliably extractable via WebFetch
- SuttaCentral bilara-data for commentaries — they have some commentary
  Pāli but not English translations with structure I can use
- DPD — lexical only, not commentarial

## What I'm searching for

Please find machine-readable Buddhist source texts with metadata structure
that would let me build a "Pāli term → commentarial citation" lookup table.

Specifically:

1. EPUB / HTML / JSON edition of the VISUDDHIMAGGA (ideally Ñāṇamoli English
   "Path of Purification") with:
   - Chapter / section TOC
   - Stable URL anchors per section
   - Searchable by Pāli term
   - Permissive licensing (CC BY-SA, public domain) or noted restrictions

2. Similar resources for the SUTTA COMMENTARIES:
   - Papañcasūdanī (MN commentary)
   - Sumaṅgalavilāsinī (DN commentary)
   - Sāratthappakāsinī (SN commentary)
   - Manorathapūraṇī (AN commentary)

3. Other Pāli/Buddhist digital infrastructure I may not know about:
   - Anālayo's monographs in digital / indexed form
   - PTS digitization projects (Pali Text Society)
   - University-hosted critical editions (Oxford, Cambridge, Mahidol, etc.)
   - Critical Pali Dictionary (CPD) — is there a queryable digital edition?
   - Buddhanexus (existing cross-reference tool — what does it cover?)
   - Buddhist Digital Resource Center (BDRC) — does it have searchable English?
   - GRETIL / SARIT / DSAL — what corpora?
   - Buddhist parallels: do any tools index "this Pāli word maps to this
     Sanskrit/Tibetan/Chinese term"?

4. Tools that bridge these resources:
   - Existing "Pāli term → commentarial gloss" indexes published by scholars
   - Anālayo's footnote indexes / Wisdom Publications excerpts
   - Sutta-glossary apps that surface citations

## What good output looks like

For each resource you find, give me:

- **Name** of the resource
- **URL** (must be currently live — please verify or note "claimed but
  unverified" if you can't)
- **Scope** (text coverage: Vism / commentaries / suttas / lexical / other)
- **Format** (EPUB / HTML pages / JSON API / PDF with text layer / etc.)
- **Programmatic access** (curl-able? search API? URL pattern for
  direct-linking to a specific passage?)
- **Licensing** (CC BY-SA / public domain / publisher-restricted)
- **Maintainer / publisher** (so I can cite responsibly)
- **Confidence** (how sure you are the resource is current and useful)

## Scope guardrails

- Don't fabricate URLs. If you don't know if a resource exists, say so.
- Don't recommend gated/paywalled resources without explicit note.
- Don't recommend the ones I've already ruled out (above).
- Prefer EPUB / structured-text / JSON over PDF unless the PDF has a
  reliable text layer with bookmarks.
- Pāli + English are priority; Sanskrit / Tibetan / Chinese parallels
  are welcome but lower priority.
- A useful resource doesn't have to be perfect — if there's a 70%-coverage
  Vism digitization with stable chapter URLs and CC licensing, that's
  worth knowing about. Surface partial wins.

## Why this matters

We're trying to amortize the curation effort across multiple suttas. The
architecture is built so a new sutta can be onboarded in ~5-6 hours instead
of ~40 hours — but only IF the commentarial layer has been seeded. Finding
the right digital source for Vism could collapse 6-10 hours of manual
Pāli reading work into a one-time scrape + index build.
```

---

## How to use the output

1. Run the prompt on a frontier model with web search enabled
2. For each result, manually spot-check the URL (does it 200? does the text actually exist?)
3. Add verified resources to `docs/sutta-studio/AMORTIZATION.md` §"External resources backlog"
4. Open a follow-up task to wire any resource that meaningfully closes the gap

## Anti-patterns to watch for in the output

- **Hallucinated URLs** — the model may invent plausible-looking URLs that don't exist. Spot-check before adding.
- **Outdated resources** — many Buddhist digital projects from the 2000s-2010s are now dead. Verify the URL is currently live.
- **Login walls** — some resources require academic credentials. Note these but don't rely on them as primary citations.
- **Mismatched scope** — a "Buddhist text database" might be Mahayana-only or Tibetan-only; doesn't help for Pāli commentaries.

## Update history

- 2026-05-14 — Initial prompt drafted. Triggered by Phase 4 (commentarial-gloss seed) deferral. Searching for Visuddhimagga + Aṭṭhakathā digitizations.
