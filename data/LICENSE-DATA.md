# Data licenses for upstream-derived content

This file declares licenses for **data artifacts** committed to `data/` that
derive from upstream sources. Code in this repository is licensed separately
(see project root `LICENSE` once declared). Per ADR SUTTA-008 §License
(ratified 2026-05-11), code and data carry separate license declarations.

When you reuse, redistribute, or build on top of these data files, the
upstream license applies. Attribution requirements are listed below.

---

## `data/dpd/` — Digital Pāli Dictionary subsets

**License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

**Source:** [github.com/digitalpalidictionary/dpd-db](https://github.com/digitalpalidictionary/dpd-db)

**Authors:** Bryan Levman, Devan Jaganath, Bodhirasa Bhikkhu, Ānandajoti
Bhikkhu, Anāgārika Sabbamitta, Bhante Sujato, contributors named at
[dpd-db CONTRIBUTORS](https://github.com/digitalpalidictionary/dpd-db).

**Pinned release:** see `data/dpd/<sutta>/manifest.json` field `dpdRelease`.
The ingestion script `scripts/build-dpd.ts` pins a specific tagged release
per build; the pin advances explicitly (commit message documents the bump).

**Attribution notice (must appear in renderer attribution UI when DPD-derived
entries are displayed):**

> Dictionary entries derived from Digital Pāli Dictionary (DPD) by Bryan
> Levman et al., licensed under CC BY-NC-SA 4.0. See dpddictionary.com.

**What's committed:** per-sutta subset directories (e.g., `data/dpd/mn10/`)
containing only the headwords referenced by the corresponding sutta's
surface forms. The full DPD database is not committed; the ingestion script
re-derives these subsets from the upstream release on demand.

**Share-alike clause (load-bearing):** any further redistribution of these
derived JSON files, or works incorporating them, must carry CC BY-NC-SA 4.0
or a license-compatible successor.

---

## `data/commentaries/` — VRI / Tipiṭaka.org Aṭṭhakathā excerpts (lazy-fetched)

**License:** VRI Chaṭṭha Saṅgāyana editions are freely redistributable; see
[tipitaka.org](https://tipitaka.org).

**Source:** GitHub mirrors of VRI CSCD XML — multiple are available; the
build script pins one in `data/commentaries/<sutta>/manifest.json`.

**Attribution:**

> Commentary excerpts from the Mahāsaṅgīti Tipiṭaka Buddhavasse 2500 / Sixth
> Buddhist Council edition (1954–56), digitised by Vipassana Research
> Institute.

**What's committed:** per-segment commentary fragments accreting organically
as MN10 (and later other suttas) are curated. The full Aṭṭhakathā is not
committed.

*(Pipeline lands in commit C per ADR SUTTA-008 §Build order. This entry is a
placeholder until then.)*

---

## `data/editions/` — VRI edition descriptors

**License:** VRI redistribution terms (see above).

**What's committed:** small static JSON descriptors of editions (name,
council, year, digitiser) referenced by `DeepLoomPacket.provenance.edition`.

---

## Bilara root + translation segments

When bilara-data fetches are committed (commit D per ADR), license is
**CC BY-SA 4.0** (root text) or per-translator (typically CC BY-SA 4.0 or
CC0).

**Source:** [github.com/suttacentral/bilara-data](https://github.com/suttacentral/bilara-data)

**Attribution:**

> Pāli root text from Mahāsaṅgīti Tipiṭaka via SuttaCentral bilara-data,
> CC BY-SA 4.0. Translations carry their own attribution (see per-file
> metadata).

---

## Future entries

When new providers land (CBETA, 84000, GRETIL, BDRC, BuddhaNexus, …), each
gets its own section here with: source URL, license, authors, attribution
notice, what's committed, share-alike or other obligations.
