/**
 * Shared Heart Sutra content — the single source of the canonical body
 * segments (Sanskrit IAST/Devanāgarī, Chinese Xuanzang, Sino-Japanese,
 * Tibetan + word-by-word morphemes) plus the translator witnesses common to
 * every community (Conze, Red Pine, Thich Nhat Hanh).
 *
 * The data lives in exactly one place — the MAPLE authoring in
 * `heart-sutra.ts`, the most complete recension. This module derives the
 * shared body from it and strips the *community-specific* witnesses, so a
 * third (or fourth) community chanting the Heart Sutra references these
 * segments and overlays only its own English rendering — no second or third
 * copy of the scripts/words. See docs/sutta-studio/COMMUNITY_CHANT_MODEL.md.
 *
 * Communities differ in their body sectioning only by section *id* (MAPLE
 * `heart-core`, Bodhi `bodhi-heart-core`, …) — the segments themselves, keyed
 * by `phraseId`, are identical, which is what lets witnesses pool.
 */

import type {
  TripleScriptWitnessSection,
  TripleScriptWitnessSegment,
  Witness,
} from '../../types/liturgy';
import { heartSutra } from './heart-sutra';

/**
 * Witness `by`-names that belong to one community, not the shared body. The
 * shared segments keep only the translator witnesses every community shows.
 */
const COMMUNITY_ONLY_WITNESSES = new Set<string>([
  'MAPLE chant sheet (after Sheng-yen)',
  'Bodhi Sangha',
]);

function sharedBody(sectionId: string): TripleScriptWitnessSegment[] {
  const section = heartSutra.sections.find(
    (s): s is TripleScriptWitnessSection =>
      s.id === sectionId && s.shape === 'triple-script-witness',
  );
  if (!section) {
    throw new Error(`heart-sutra-content: section '${sectionId}' not found in MAPLE Heart Sutra`);
  }
  return section.segments.map((seg) => ({
    ...seg,
    witnesses: seg.witnesses.filter((w) => !COMMUNITY_ONLY_WITNESSES.has(w.by)),
  }));
}

/**
 * The Heart Sutra body, grouped as the three chanted movements. Each segment
 * carries `phraseId`, all scripts, the word breakdown, and the shared
 * translator witnesses. A community composes its sections from these and
 * overlays its own witness via `overlayWitness`.
 */
export const HEART_SUTRA_BODY = {
  core: sharedBody('heart-core'),
  middle: sharedBody('heart-middle'),
  result: sharedBody('heart-result'),
};

/**
 * Return a copy of `segments` with `by`'s rendering prepended to each segment
 * whose `phraseId` has an entry in `textByPhrase`. The prepended witness leads
 * (so it becomes the community's default), ahead of the shared translators.
 *
 * `alignTo` is intentionally optional: a community may show its translation as
 * a plain line (no word-arrows) until per-word alignment is authored.
 */
export function overlayWitness(
  segments: TripleScriptWitnessSegment[],
  by: string,
  textByPhrase: Record<string, string>,
  meta: { url?: string; license?: string; alignToByPhrase?: Record<string, number[]> } = {},
): TripleScriptWitnessSegment[] {
  return segments.map((seg) => {
    const text = seg.phraseId ? textByPhrase[seg.phraseId] : undefined;
    if (text === undefined) return seg;
    const witness: Witness = { by, text };
    const alignTo = seg.phraseId ? meta.alignToByPhrase?.[seg.phraseId] : undefined;
    if (alignTo) witness.alignTo = alignTo;
    if (meta.url) witness.url = meta.url;
    if (meta.license) witness.license = meta.license;
    return { ...seg, witnesses: [witness, ...seg.witnesses] };
  });
}
