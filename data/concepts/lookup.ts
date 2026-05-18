/**
 * Concept lookup — given a surface token (language, script, text, optional
 * witness), find every `ConceptNode` that has an attestation matching it.
 *
 * This is the runtime side of the concept-graph model. The registry is the
 * truth; the renderer queries it for hover highlighting. No conceptId
 * field is required on segment data — concept membership is computed.
 *
 * Lookup is cheap: a single `Map` lookup keyed by `<lang>:<script>:<text>`
 * (with a witness-specific override). Built once per process.
 *
 * Normalization rules:
 *  - Strip trailing punctuation (`,`, `.`, `;`, `:`, `!`, `?`, `—`) — Heart
 *    Sutra English fragments often end with commas; concept attestations
 *    don't carry punctuation.
 *  - Case-insensitive for Latn scripts (so "Wisdom" and "wisdom" match).
 *  - Preserve case for non-Latn scripts (Sanskrit Devanāgarī is case-less;
 *    CJK is case-less; only Latn has case to fold).
 */

import type { ConceptNode, ConceptRegistry, LangCode, ScriptCode } from '../../types/conceptGraph';
import { HEART_SUTRA_CONCEPTS } from './heart-sutra';

type Index = Map<string, string[]>;

function normalizeText(text: string, script: ScriptCode): string {
  const stripped = text.trim().replace(/[.,;:!?—–·]+$/u, '');
  return script === 'Latn' ? stripped.toLowerCase() : stripped;
}

function keyFor(lang: LangCode, script: ScriptCode, text: string, witness?: string): string {
  const t = normalizeText(text, script);
  return witness ? `${witness}::${lang}:${script}:${t}` : `${lang}:${script}:${t}`;
}

function buildIndex(registry: ConceptRegistry): Index {
  const idx: Index = new Map();
  for (const concept of Object.values(registry)) {
    for (const att of concept.attestations) {
      const k = keyFor(att.language, att.script, att.text, att.witness);
      const list = idx.get(k);
      if (list) list.push(concept.id);
      else idx.set(k, [concept.id]);
    }
  }
  return idx;
}

let cached: Index | null = null;
function getIndex(): Index {
  if (!cached) cached = buildIndex(HEART_SUTRA_CONCEPTS);
  return cached;
}

/**
 * Find the conceptIds attesting this token. Witness-specific match wins
 * over generic match; if a witness is named and has its own attestation,
 * generic attestations are ignored.
 */
export function conceptsForToken(
  language: LangCode,
  script: ScriptCode,
  text: string,
  witness?: string,
): string[] {
  if (!text) return [];
  const idx = getIndex();
  if (witness) {
    const witnessHit = idx.get(keyFor(language, script, text, witness));
    if (witnessHit && witnessHit.length > 0) return witnessHit;
  }
  return idx.get(keyFor(language, script, text)) ?? [];
}

/** Find a ConceptNode by ID. */
export function getConcept(id: string): ConceptNode | undefined {
  return HEART_SUTRA_CONCEPTS[id];
}

/** Whole registry — for debugging / inspection. */
export function allConcepts(): ConceptNode[] {
  return Object.values(HEART_SUTRA_CONCEPTS);
}
