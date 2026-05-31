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

type OverlayMeta = { url?: string; license?: string; alignToByPhrase?: Record<string, number[]> };

/**
 * Prepend `by`'s rendering to each segment whose `phraseId` has an entry in
 * `textByPhrase`. The prepended witness leads (becomes the community default)
 * ahead of the shared translators. Segments with no entry are returned
 * unchanged. `alignTo` is optional — a community may show a plain line (no
 * word-arrows) until per-word alignment is authored.
 */
function overlaySection(
  segments: TripleScriptWitnessSegment[],
  by: string,
  textByPhrase: Record<string, string>,
  meta: OverlayMeta,
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

/** Every `phraseId` in the shared body — used to validate a community's text map. */
export const HEART_SUTRA_PHRASE_IDS: ReadonlySet<string> = new Set(
  [...HEART_SUTRA_BODY.core, ...HEART_SUTRA_BODY.middle, ...HEART_SUTRA_BODY.result]
    .map((s) => s.phraseId)
    .filter((p): p is string => Boolean(p)),
);

/**
 * Overlay a community's English onto the three shared body movements at once,
 * returning `{ core, middle, result }` segment arrays ready to drop into the
 * community's sections. Validates the WHOLE map against the body: any key that
 * names no shared phrase (a typo or stale key) throws — it would otherwise
 * silently leave that phrase with only the pooled witnesses.
 */
export function overlayHeartBody(
  by: string,
  textByPhrase: Record<string, string>,
  meta: OverlayMeta = {},
): { core: TripleScriptWitnessSegment[]; middle: TripleScriptWitnessSegment[]; result: TripleScriptWitnessSegment[] } {
  const unknown = Object.keys(textByPhrase).filter((k) => !HEART_SUTRA_PHRASE_IDS.has(k));
  if (unknown.length > 0) {
    throw new Error(
      `overlayHeartBody(${by}): ${unknown.length} phraseId(s) name no shared Heart Sutra ` +
        `phrase — typo or stale key? [${unknown.join(', ')}]`,
    );
  }
  return {
    core: overlaySection(HEART_SUTRA_BODY.core, by, textByPhrase, meta),
    middle: overlaySection(HEART_SUTRA_BODY.middle, by, textByPhrase, meta),
    result: overlaySection(HEART_SUTRA_BODY.result, by, textByPhrase, meta),
  };
}
