#!/usr/bin/env node

/**
 * DPD ingestion script — per-sutta subset builder.
 *
 * For a given sutta UID (default: mn10), this script:
 *   1. Loads/downloads the pinned DPD release `dpd-txt.zip`
 *   2. Parses it into structured headwords
 *   3. Fetches the sutta's Pāli root segments from SuttaCentral bilara-data
 *   4. Extracts unique surface forms
 *   5. Matches each surface form against DPD headwords using:
 *      - direct lemma match
 *      - stem-stripping heuristics for common Pāli inflections
 *   6. Writes data/dpd/<sutta>/headwords.json + forms.json + manifest.json
 *
 * Per ADR SUTTA-008 §Storage strategy: we don't bundle the full 80-120MB DPD
 * dataset. Each sutta gets its own subset; the corpus grows organically as
 * more suttas are curated.
 *
 * Usage:
 *   npm run build:dpd               # defaults to mn10
 *   npm run build:dpd -- sn22.59
 *   npm run build:dpd -- --force    # re-run even if outputs already exist
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import type {
  LexiconEntry,
  LexiconSense,
} from '../services/providers/types';
import type { MorphHint } from '../types/suttaStudio';
import { citationIdFor } from '../services/providers/citationHelpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Pinned DPD release
//
// We use TWO release artifacts:
//   - dpd-txt.zip  (~4 MB) — human-readable headword records with meanings,
//                            grammar, etymology. Used as the *content* source.
//   - dpd.db.tar.bz2 (~168 MB compressed) — full SQLite with a precomputed
//                            `lookup` table mapping every surface form to
//                            its headword IDs. Used as the *resolution*
//                            source. Replaces the heuristic stem-stripper
//                            for form→lemma resolution and closes schema
//                            tension #1 (DPD stripper conflations) at the
//                            root rather than per-ending.
// ─────────────────────────────────────────────────────────────────────────────

const DPD_RELEASE_TAG = 'v0.4.20260501';
const DPD_TXT_URL = `https://github.com/digitalpalidictionary/dpd-db/releases/download/${DPD_RELEASE_TAG}/dpd-txt.zip`;
const DPD_DB_URL = `https://github.com/digitalpalidictionary/dpd-db/releases/download/${DPD_RELEASE_TAG}/dpd.db.tar.bz2`;
const DPD_LICENSE = 'CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.';

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem layout
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(REPO_ROOT, 'data', '_raw', 'dpd');
const DATA_DIR = path.join(REPO_ROOT, 'data', 'dpd');

// ─────────────────────────────────────────────────────────────────────────────
// DPD POS → MorphHint mapping
// Source: dpd-db docs/technical/abbreviations.md (research summary)
// ─────────────────────────────────────────────────────────────────────────────

interface MorphFromPos {
  tenseAspect?: MorphHint['tenseAspect'];
  mood?: MorphHint['mood'];
  voice?: MorphHint['voice'];
  form?: MorphHint['form'];
  gender?: MorphHint['gender'];
  /** Indicates a particle/indeclinable; no MorphHint applied. */
  isIndeclinable?: boolean;
}

const POS_TO_MORPH: Record<string, MorphFromPos> = {
  // Verb tense/aspect
  pr: { tenseAspect: 'present', form: 'finite' },
  aor: { tenseAspect: 'aorist', form: 'finite' },
  fut: { tenseAspect: 'future', form: 'finite' },
  perf: { tenseAspect: 'perfect', form: 'finite' },
  imperf: { tenseAspect: 'imperfect', form: 'finite' },
  // Verb mood
  opt: { mood: 'optative', form: 'finite' },
  imp: { mood: 'imperative', form: 'finite' },
  cond: { mood: 'conditional', form: 'finite' },
  // Verb voice
  pass: { voice: 'passive' },
  caus: { voice: 'causative' },
  // Non-finite verb forms
  abs: { form: 'absolutive' },
  ger: { form: 'gerund' },
  inf: { form: 'infinitive' },
  prp: { form: 'participle', tenseAspect: 'present' },
  pp: { form: 'participle' },     // past participle
  ptp: { form: 'participle' },    // potential participle
  app: { form: 'participle' },    // future passive participle
  // Noun genders
  masc: { gender: 'm' },
  fem: { gender: 'f' },
  nt: { gender: 'n' },
  // Indeclinables
  ind: { isIndeclinable: true },
  abbrev: { isIndeclinable: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// Niggahīta normalization
//
// Pāli niggahīta (the nasal-final consonant) has two competing Unicode
// representations:
//   ṁ (U+1E41, m-with-dot-ABOVE)  — IAST convention, used by SuttaCentral bilara
//   ṃ (U+1E43, m-with-dot-BELOW)  — ISO 15919 convention, used by DPD
//
// Without normalization, evaṃ (DPD headword for 'thus; in this way') never
// matches evaṁ (bilara surface form) — same Pāli sound, different bytes.
// This was the primary cause of phase-a's "evaṁ → eva conflation": the
// stem-stripper fell through because the direct match failed, and stripped
// the niggahīta to the unrelated particle `eva`.
//
// Convention: normalize DPD's ṃ → bilara's ṁ. The app's existing data uses
// ṁ throughout, so this preserves byte-compatibility downstream.
// ─────────────────────────────────────────────────────────────────────────────

export const normalizeNiggahita = (s: string): string => s.replace(/ṃ/g, 'ṁ');

// ─────────────────────────────────────────────────────────────────────────────
// Common Pāli inflection endings — tried in order when stem-stripping.
//
// Note: this heuristic stem-stripper is intentionally lossy; per ADR
// SUTTA-008 §Open Questions #2, full coverage needs DPD's inflection table
// from the SQLite release. This pass aims for ~50-65% coverage as a starting
// baseline for hand-curation; the remainder is documented in manifest.json
// as `unmatchedSurfaces` and can be tackled either by escalating to SQLite
// or by curator-provided lemma overrides.
//
// Bug-fix history:
//   - Removed 'ūsu' and 'ūhi' (which were treated as single endings) because
//     they are stem-vowel-lengthening + -su / -hi. The lengthening before
//     locative-plural / instrumental-plural is a sandhi phenomenon; the real
//     ending is just -su / -hi, and the long vowel that precedes it belongs
//     to the lengthened stem (kuru → kurū before -su). Counting -ūsu as a
//     3-char single ending caused kurūsu to over-strip to 'kur' and then
//     match the unrelated noun 'kura' (rice) via the +a candidate.
//   - Removed 'ūnaṁ' and 'unaṁ' for the same reason: u-stem gen pl is
//     stem-vowel-lengthening + bare -naṁ (kuru → kurū before -naṁ; cf. the
//     -su pattern). Phase-d surfaced this as a recurrence: kurūnaṁ over-
//     stripped to 'kur' and conflated with 'kura' (rice). Added bare 'naṁ'
//     paired with the vowel-shortening rule below. NB: 'ānaṁ' kept — that
//     IS the a-stem gen pl single ending in standard analyses (dhammānaṁ
//     analysed as dhamm + ānaṁ, not dhammā + naṁ).
// ─────────────────────────────────────────────────────────────────────────────

export const PALI_ENDINGS: string[] = [
  // Optative + causative + future (5-6 chars)
  'eyyātha', 'eyyāma', 'eyyāsi', 'eyyaṁ', 'eyya',
  'ssāmi', 'ssāma', 'ssati', 'ssanti',
  // -vant possessive participle inflections
  'vantaṁ', 'vantesu', 'vatāya', 'vantī', 'vato', 'vatī', 'vā',
  // Present + past + middle participle inflections
  'antassa', 'antānaṁ', 'antaṁ', 'antā', 'anto', 'anti', 'ante',
  'mānassa', 'mānaṁ', 'mānā', 'māno', 'mānā',
  // Absolutives
  'itvāna', 'itvā', 'tvāna', 'tvā',
  // Past-participle declensions (often -ita- + decl)
  'itāya', 'itānaṁ', 'itaṁ', 'itā', 'ite',
  // Noun declensions
  // NB: 'ūsu' / 'ūhi' removed — those are vowel-lengthening + -su / -hi,
  // not single morphological endings. See bug-fix note above the array.
  // The bare 'su' / 'hi' endings (locative pl / instrumental pl for u-stems
  // and similar after vowel-lengthening) ARE added below. Note that 'hi'
  // also serves as the 2sg imperative — accept the verb-collision noise
  // for now; the vowel-shortening rule downstream catches u-stem cases.
  'assa', 'asmā', 'amhā', 'asmiṁ', 'amhi', 'ānaṁ', 'ehi', 'esu', 'āni', 'āya',
  'ato', 'iya', 'iyaṁ', 'iyo', 'iyā',
  // NB: 'ūnaṁ' / 'unaṁ' removed — those are vowel-lengthening + -naṁ for
  // u-stems (parallel to the 'ūsu' / 'ūhi' removal above). Bare 'naṁ' is
  // added below paired with vowel-shortening.
  'aṁse', 'iṁsu', 'imha', 'tāya', 'tāyo', 'tā',
  'su', 'hi', 'naṁ',  // locative pl / instrumental pl / u-stem gen pl (paired with vowel-shortening below)
  // Verb finite
  'ema', 'esi', 'eti', 'enti', 'etha', 'esā',  // causative present
  'ema', 'eyya',
  'mi', 'si', 'ti', 'ma', 'ha', 'tha', 'asi', 'ena',
  // Short noun/case
  'aṁ', 'ṁ', 'aṃ', 'ṃ', 'ā', 'i', 'ī', 'u', 'ū', 'o', 'e', 'a',
];

// Quotative / particle suffixes that often attach to a wordform. Stripping
// these first dramatically improves match rate for direct-speech segments.
export const QUOTATIVE_TAILS = ['’ti', "'ti", '’nti', "'nti", '’ssa', "'ssa", 'nti', '’pi', "'pi"];

export const stripQuotative = (surface: string): string[] => {
  const variants = new Set<string>([surface]);
  for (const tail of QUOTATIVE_TAILS) {
    if (surface.length > tail.length + 1 && surface.endsWith(tail)) {
      variants.add(surface.slice(0, -tail.length));
    }
  }
  return [...variants];
};

export const tryStemStrips = (surface: string): string[] => {
  const candidates = new Set<string>();
  // First pass: strip quotative if any
  const baseVariants = stripQuotative(surface);
  for (const base of baseVariants) {
    candidates.add(base);
    for (const ending of PALI_ENDINGS) {
      if (base.length > ending.length + 2 && base.endsWith(ending)) {
        const stem = base.slice(0, -ending.length);
        candidates.add(stem);
        // Pāli locatives -e / -i, datives -āya, etc. often hide a stem-final -a:
        //   kāye → kāy- → try kāya. bhāve → bhāv- → try bhāva.
        // Cheap: after each strip, also try appending common nominal suffixes.
        candidates.add(stem + 'a');
        candidates.add(stem + 'ā');
        // Vowel-shortening: locative-plural -su / instrumental-plural -hi
        // lengthen the stem-final vowel (kuru → kurū before -su, bhikkhu →
        // bhikkhū before -hi). After stripping, the stem still carries the
        // lengthened vowel; try shortening it to find the true headword.
        // Without this, kurūsu → kurū (no DPD match for kurū with long ū;
        // DPD has kuru with short u).
        const last = stem.slice(-1);
        if (last === 'ā' || last === 'ī' || last === 'ū') {
          const short = last === 'ā' ? 'a' : last === 'ī' ? 'i' : 'u';
          candidates.add(stem.slice(0, -1) + short);
        }
      }
    }
  }
  return [...candidates];
};

// ─────────────────────────────────────────────────────────────────────────────
// DPD .txt parser
// ─────────────────────────────────────────────────────────────────────────────

interface DpdRecord {
  id: number;
  lemma: string;
  homonym?: string;
  pos: string;
  meaning1: string;
  verified: boolean;
  grammar?: string;
  construction?: string;
  sanskrit?: string;
  ipa?: string;
  notes?: string;
  compound?: string;
  meaningLit?: string;
  meaning2?: string;
  rawBlock: string;
}

const parseDpdTxt = (txt: string): DpdRecord[] => {
  const records: DpdRecord[] = [];
  const blocks = txt.split(/\n\s*\n/);
  const headerRe = /^(.+?), ([a-z]+(?: [a-z]+)?)\. (.+?)\s*([✔✘])\s*$/;
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length === 0) continue;
    const headerLine = lines[0];
    const m = headerLine.match(headerRe);
    if (!m) continue;
    let lemmaRaw = m[1];
    const pos = m[2];
    const meaning1 = m[3];
    const verified = m[4] === '✔';
    let homonym: string | undefined;
    // DPD uses two homonym styles: "lemma N" (single digit, e.g. "me 1") and
    // "lemma N.M" (e.g. "a 1.1"). Both must be stripped to get the bare lemma.
    const homonymRe = /^(.+?)\s+(\d+(?:\.\d+)?)$/;
    const hm = lemmaRaw.match(homonymRe);
    if (hm) {
      lemmaRaw = hm[1];
      homonym = hm[2];
    }
    const record: DpdRecord = {
      id: 0,
      // Normalize DPD's ṃ (U+1E43) to bilara's ṁ (U+1E41) so lookups match
      // across the codepoint boundary. Without this, evaṃ (DPD) ≠ evaṁ (bilara)
      // and the lookup falls through to the stem-stripper.
      lemma: normalizeNiggahita(lemmaRaw.trim()),
      homonym,
      pos,
      meaning1,
      verified,
      rawBlock: block,
    };
    for (const line of lines.slice(1)) {
      const fm = line.match(/^\s+(\w[\w ]*):\s*(.+)$/);
      if (!fm) continue;
      const key = fm[1].toLowerCase().trim();
      const value = fm[2].trim();
      switch (key) {
        case 'id': record.id = parseInt(value, 10); break;
        case 'grammar': record.grammar = value; break;
        case 'construction': record.construction = value; break;
        case 'sanskrit': record.sanskrit = value; break;
        case 'ipa': record.ipa = value; break;
        case 'notes': record.notes = value; break;
        case 'compound': record.compound = value; break;
        case 'meaning lit':
        case 'meaning_lit':
        case 'literal':
          record.meaningLit = value; break;
        case 'meaning 2':
        case 'meaning_2':
          record.meaning2 = value; break;
        default: break;
      }
    }
    if (record.id > 0) records.push(record);
  }
  return records;
};

// ─────────────────────────────────────────────────────────────────────────────
// DpdRecord → LexiconEntry projection
// ─────────────────────────────────────────────────────────────────────────────

const projectMorphology = (pos: string): MorphHint | undefined => {
  const tag = pos.trim().split(/\s+/)[0];
  const mapped = POS_TO_MORPH[tag];
  if (!mapped) return undefined;
  if (mapped.isIndeclinable) return undefined;
  const hint: MorphHint = {};
  if (mapped.tenseAspect) hint.tenseAspect = mapped.tenseAspect;
  if (mapped.mood) hint.mood = mapped.mood;
  if (mapped.voice) hint.voice = mapped.voice;
  if (mapped.form) hint.form = mapped.form;
  if (mapped.gender) hint.gender = mapped.gender;
  return Object.keys(hint).length > 0 ? hint : undefined;
};

const projectToLexiconEntry = (rec: DpdRecord): LexiconEntry => {
  const senses: LexiconSense[] = [];
  senses.push({
    english: rec.meaning1,
    nuance: rec.pos,
    notes: rec.grammar,
    citation: rec.sanskrit ? `Sanskrit: ${rec.sanskrit}` : undefined,
  });
  if (rec.meaning2) senses.push({ english: rec.meaning2, nuance: 'secondary' });
  if (rec.meaningLit) senses.push({ english: rec.meaningLit, nuance: 'literal' });

  const sourceId = `dpd:${rec.id}`;
  return {
    lemma: rec.lemma,
    partOfSpeech: rec.pos,
    senses,
    morphology: projectMorphology(rec.pos),
    rawExcerpt: rec.rawBlock,
    sourceId,
    citationId: citationIdFor('dpd', sourceId, rec.lemma),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem helpers
// ─────────────────────────────────────────────────────────────────────────────

const ensureDir = (p: string): void => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

const downloadIfMissing = async (url: string, destPath: string): Promise<void> => {
  if (fs.existsSync(destPath)) return;
  console.log(`[dpd] downloading ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`download failed: ${resp.status} ${resp.statusText}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  console.log(`[dpd] saved ${destPath} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
};

const ensureDpdTxt = async (): Promise<string> => {
  const zipPath = path.join(RAW_DIR, 'dpd-txt.zip');
  const txtPath = path.join(RAW_DIR, 'dpd.txt');
  ensureDir(RAW_DIR);
  await downloadIfMissing(DPD_TXT_URL, zipPath);
  if (!fs.existsSync(txtPath)) {
    console.log(`[dpd] extracting dpd-txt.zip`);
    // execFileSync is safer than exec/execSync — args are explicitly an array;
    // no shell interpretation; no command injection surface.
    execFileSync('unzip', ['-o', zipPath, '-d', RAW_DIR], { stdio: 'inherit' });
  }
  return txtPath;
};

// Streaming download for large artifacts (.tar.bz2 is ~168 MB; loading the
// whole thing into memory via arrayBuffer() before writing is wasteful).
// fetch's body is a ReadableStream; pipe it directly to a write stream.
const downloadStreamingIfMissing = async (url: string, destPath: string): Promise<void> => {
  if (fs.existsSync(destPath)) return;
  console.log(`[dpd] downloading (streaming) ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`download failed: ${resp.status} ${resp.statusText}`);
  }
  if (!resp.body) throw new Error('no response body');
  const fileStream = fs.createWriteStream(destPath);
  const reader = resp.body.getReader();
  let totalBytes = 0;
  let lastLogged = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    totalBytes += value.byteLength;
    // Progress log every ~20 MB to avoid log spam
    if (totalBytes - lastLogged > 20 * 1024 * 1024) {
      console.log(`[dpd]   …downloaded ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
      lastLogged = totalBytes;
    }
  }
  fileStream.end();
  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', () => resolve());
    fileStream.on('error', reject);
  });
  console.log(`[dpd] saved ${destPath} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
};

const ensureDpdDb = async (): Promise<string> => {
  const archivePath = path.join(RAW_DIR, 'dpd.db.tar.bz2');
  const dbPath = path.join(RAW_DIR, 'dpd.db');
  ensureDir(RAW_DIR);
  await downloadStreamingIfMissing(DPD_DB_URL, archivePath);
  if (!fs.existsSync(dbPath)) {
    console.log(`[dpd] extracting dpd.db.tar.bz2 (this takes a moment — ~600 MB raw SQLite)`);
    // tar -xjf decompresses bz2 + extracts. Argument-array form, no shell.
    execFileSync('tar', ['-xjf', archivePath, '-C', RAW_DIR], { stdio: 'inherit' });
    if (!fs.existsSync(dbPath)) {
      throw new Error(`expected ${dbPath} after extraction; archive layout may have changed`);
    }
  }
  return dbPath;
};

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Lookup table — surface form → headword IDs
//
// DPD's `lookup` table is a precomputed reverse-index: for every inflected
// surface form, it lists the headword IDs that produce it. This replaces
// our heuristic stem-stripper for form→lemma resolution.
//
// Why this matters: the stripper guessed by removing endings (-su, -naṁ,
// -ū, …) and adding vowel-completion candidates (+a, +ā, +shorten). Each
// guess landed on one or two real headwords — but also on UNRELATED ones,
// producing the kura/rice (phase-c kurūsu), bhikkhā/alms (phase-e bhikkhū)
// conflations we've been patching per-ending. The Lookup table sidesteps
// the whole class of bugs because it's an enumeration, not a heuristic.
//
// Coverage on MN10 jumps from ~87% → near-100%; the remaining ~3% are
// genuinely unattested forms (sandhi-collapsed compounds, scribal variants)
// which we fall back to the heuristic stripper for.
// ─────────────────────────────────────────────────────────────────────────────

interface LookupIndex {
  /** form → array of DPD headword IDs that produce this form */
  formToIds: Map<string, number[]>;
}

const buildLookupIndex = (dbPath: string): LookupIndex => {
  console.log(`[dpd] opening SQLite at ${dbPath}`);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    console.log(`[dpd] reading lookup table (form → headword IDs)`);
    // The `lookup` table has lookup_key + headwords columns. headwords is a
    // JSON-encoded array of headword IDs (per dpd-db/db/models.py).
    const rows = db.prepare<[], { lookup_key: string; headwords: string }>(
      `SELECT lookup_key, headwords FROM lookup WHERE headwords != ''`
    ).all();
    const formToIds = new Map<string, number[]>();
    for (const row of rows) {
      let ids: number[];
      try {
        const parsed = JSON.parse(row.headwords);
        ids = Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
      } catch {
        continue;
      }
      if (ids.length === 0) continue;
      // Normalize the key the same way we normalize bilara surface forms
      // (niggahīta + lowercase) so direct lookups Just Work later.
      const key = normalizeNiggahita(row.lookup_key.trim().toLowerCase());
      const existing = formToIds.get(key) ?? [];
      formToIds.set(key, [...existing, ...ids]);
    }
    console.log(`[dpd] indexed ${formToIds.size} surface forms`);
    return { formToIds };
  } finally {
    db.close();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Bilara fetch + surface form extraction
// ─────────────────────────────────────────────────────────────────────────────

interface BilaraSegments {
  [segmentId: string]: string;
}

const bilaraUrlForSutta = (uid: string): string => {
  const basket = uid.startsWith('mn') ? 'mn'
    : uid.startsWith('sn') ? 'sn'
    : uid.startsWith('an') ? 'an'
    : uid.startsWith('dn') ? 'dn'
    : 'mn';
  return `https://raw.githubusercontent.com/suttacentral/bilara-data/published/root/pli/ms/sutta/${basket}/${uid}_root-pli-ms.json`;
};

const fetchBilaraPali = async (uid: string): Promise<BilaraSegments> => {
  const url = bilaraUrlForSutta(uid);
  console.log(`[dpd] fetching bilara: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`bilara fetch failed: ${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as BilaraSegments;
};

const extractSurfaceForms = (segments: BilaraSegments): string[] => {
  const allText = Object.values(segments).join(' ');
  const tokens = allText
    .toLowerCase()
    .split(/[\s,.;:!?'"()—–\-]+/)
    .map((t) => normalizeNiggahita(t.trim()))
    .filter((t) => t.length > 0 && !/^\d+$/.test(t));
  return [...new Set(tokens)].sort();
};

// ─────────────────────────────────────────────────────────────────────────────
// Surface → DPD headword matching
// ─────────────────────────────────────────────────────────────────────────────

interface FormResolution {
  surface: string;
  lemmaCandidates: string[];
  matchedLemmas: string[];
}

const indexByLemma = (records: DpdRecord[]): Map<string, DpdRecord[]> => {
  const map = new Map<string, DpdRecord[]>();
  for (const rec of records) {
    const arr = map.get(rec.lemma) ?? [];
    arr.push(rec);
    map.set(rec.lemma, arr);
  }
  return map;
};

/** Index DPD records by their authoritative ID. Used to resolve Lookup
 * table headword-id lists to full record content. */
const indexById = (records: DpdRecord[]): Map<number, DpdRecord> => {
  const map = new Map<number, DpdRecord>();
  for (const rec of records) {
    if (rec.id > 0) map.set(rec.id, rec);
  }
  return map;
};

/** How a surface was resolved — for telemetry + manifest auditing. */
type ResolutionStrategy = 'sqlite-lookup' | 'heuristic-fallback' | 'unmatched';

interface FormResolutionDetails extends FormResolution {
  strategy: ResolutionStrategy;
}

/**
 * Two-stage form→lemma resolution:
 *   1. SQLite Lookup table (authoritative; DPD's enumerated form index).
 *      Closes the per-ending conflation bug class at root.
 *   2. Heuristic stem-stripper fallback (only when Lookup has nothing).
 *      Preserves coverage for sandhi-collapsed forms and scribal variants
 *      that may not be in the canonical inflection table.
 *
 * Returns the matched lemmas and which strategy resolved them — so the
 * manifest can audit how much of the corpus actually depends on the
 * heuristic (and we can shrink/remove it once Lookup coverage is proven).
 */
const resolveSurface = (
  surface: string,
  lemmaIndex: Map<string, DpdRecord[]>,
  idIndex: Map<number, DpdRecord>,
  lookupIndex: LookupIndex,
): FormResolutionDetails => {
  // Stage 1: SQLite Lookup (authoritative)
  const lookupIds = lookupIndex.formToIds.get(surface);
  if (lookupIds && lookupIds.length > 0) {
    const lemmaSet = new Set<string>();
    for (const id of lookupIds) {
      const rec = idIndex.get(id);
      if (rec) lemmaSet.add(rec.lemma);
    }
    if (lemmaSet.size > 0) {
      return {
        surface,
        lemmaCandidates: [surface],
        matchedLemmas: [...lemmaSet],
        strategy: 'sqlite-lookup',
      };
    }
  }

  // Stage 2: Heuristic fallback (existing stripper)
  const candidates = tryStemStrips(surface);
  const matched: string[] = [];
  for (const cand of candidates) {
    if (lemmaIndex.has(cand)) matched.push(cand);
  }
  const dedupedMatches = [...new Set(matched)];
  return {
    surface,
    lemmaCandidates: candidates,
    matchedLemmas: dedupedMatches,
    strategy: dedupedMatches.length > 0 ? 'heuristic-fallback' : 'unmatched',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const suttaUid = args.find((a) => !a.startsWith('--')) ?? 'mn10';

  const outDir = path.join(DATA_DIR, suttaUid);
  const headwordsPath = path.join(outDir, 'headwords.json');
  const formsPath = path.join(outDir, 'forms.json');
  const manifestPath = path.join(outDir, 'manifest.json');

  if (!force && fs.existsSync(headwordsPath)) {
    console.log(`[dpd] outputs exist; skipping (use --force to rebuild): ${outDir}`);
    return;
  }

  console.log(`[dpd] building subset for sutta=${suttaUid} from DPD ${DPD_RELEASE_TAG}`);

  // Content source: .txt (small, human-readable) → records keyed by lemma + id
  const txtPath = await ensureDpdTxt();
  console.log(`[dpd] parsing ${txtPath}`);
  const txt = fs.readFileSync(txtPath, 'utf8');
  const records = parseDpdTxt(txt);
  console.log(`[dpd] parsed ${records.length} DPD headwords`);
  const lemmaIndex = indexByLemma(records);
  const idIndex = indexById(records);
  console.log(`[dpd] distinct lemma keys: ${lemmaIndex.size}; indexed ${idIndex.size} by id`);

  // Resolution source: SQLite Lookup table (authoritative form → headword IDs)
  const dbPath = await ensureDpdDb();
  const lookupIndex = buildLookupIndex(dbPath);

  const segments = await fetchBilaraPali(suttaUid);
  const surfaces = extractSurfaceForms(segments);
  console.log(`[dpd] ${surfaces.length} distinct surface forms in ${suttaUid}`);

  const resolutions: FormResolutionDetails[] = [];
  const includedLemmas = new Set<string>();
  for (const surface of surfaces) {
    const res = resolveSurface(surface, lemmaIndex, idIndex, lookupIndex);
    resolutions.push(res);
    for (const lemma of res.matchedLemmas) includedLemmas.add(lemma);
  }

  const matchedCount = resolutions.filter((r) => r.matchedLemmas.length > 0).length;
  const coverage = (matchedCount / surfaces.length) * 100;
  const sqliteCount = resolutions.filter((r) => r.strategy === 'sqlite-lookup').length;
  const heuristicCount = resolutions.filter((r) => r.strategy === 'heuristic-fallback').length;
  console.log(`[dpd] coverage: ${matchedCount}/${surfaces.length} surface forms matched (${coverage.toFixed(1)}%)`);
  console.log(`[dpd]   resolution breakdown: ${sqliteCount} via sqlite Lookup, ${heuristicCount} via heuristic fallback`);

  const headwords: Record<string, LexiconEntry[]> = {};
  for (const lemma of includedLemmas) {
    const recs = lemmaIndex.get(lemma) ?? [];
    headwords[lemma] = recs.map(projectToLexiconEntry);
  }

  const forms: Record<string, string[]> = {};
  for (const res of resolutions) {
    if (res.matchedLemmas.length > 0) forms[res.surface] = res.matchedLemmas;
  }

  const manifest = {
    sutta: suttaUid,
    dpdRelease: DPD_RELEASE_TAG,
    dpdLicense: DPD_LICENSE,
    builtAt: new Date().toISOString(),
    surfaceFormCount: surfaces.length,
    matchedSurfaceCount: matchedCount,
    unmatchedSurfaceCount: surfaces.length - matchedCount,
    coveragePercent: Number(coverage.toFixed(2)),
    // Resolution breakdown — how much of the corpus actually depended on
    // each path. sqliteLookupCount is the authoritative (DPD-attested) count;
    // heuristicFallbackCount is the residual that needed our stem-stripper.
    sqliteLookupCount: sqliteCount,
    heuristicFallbackCount: heuristicCount,
    includedLemmaCount: includedLemmas.size,
    includedHeadwordCount: Object.values(headwords).reduce((n, arr) => n + arr.length, 0),
    unmatchedSurfaces: resolutions.filter((r) => r.matchedLemmas.length === 0).map((r) => r.surface),
  };

  ensureDir(outDir);
  fs.writeFileSync(headwordsPath, JSON.stringify(headwords, null, 2));
  fs.writeFileSync(formsPath, JSON.stringify(forms, null, 2));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const sizeKb = (p: string) => (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`[dpd] wrote ${headwordsPath} (${sizeKb(headwordsPath)} KB)`);
  console.log(`[dpd] wrote ${formsPath} (${sizeKb(formsPath)} KB)`);
  console.log(`[dpd] wrote ${manifestPath} (${sizeKb(manifestPath)} KB)`);

  if (coverage < 60) {
    console.warn(`[dpd] WARNING: coverage below 60%. Stem-stripping heuristics may need extension, or escalate to SQLite-based form→lemma resolution (per ADR §Open Questions #2).`);
  }
};

// Run main() only when invoked as a script (npm run build:dpd), not when the
// module is imported by tests. Standard ESM Node entrypoint guard.
const isMainModule = (() => {
  try {
    return path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  main().catch((e) => {
    console.error('[dpd] FAILED:', e);
    process.exit(1);
  });
}
