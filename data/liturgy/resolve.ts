/**
 * Community-chant resolver — Option B.
 *
 * Turns a `CommunityChant` (one sangha's authored version of a chant) into a
 * render-ready `LiturgyDoc`, pooling English witnesses across every community
 * that chants the same `contentId` and ordering each segment so the visiting
 * community's `defaultWitnessBy` leads (the renderer defaults to
 * `witnesses[0]`, so no renderer change is needed).
 *
 * What pools: ONLY English `witnesses`, matched per segment `phraseId`.
 * What stays per-community, verbatim: word glosses, notes, accents, section
 * topology + order, and all framing (title, sources, curator…). This is the
 * no-re-curation contract — see docs/sutta-studio/COMMUNITY_CHANT_MODEL.md.
 *
 * Pure: never mutates its inputs.
 */

import type {
  ChantContent,
  CommunityChant,
  LiturgyDoc,
  LiturgySection,
  TripleScriptWitnessSegment,
  Witness,
} from '../../types/liturgy';

/** Append `incoming` witnesses to `into`, skipping any whose `by` already appears. */
function mergeByName(into: Witness[], incoming: Witness[]): Witness[] {
  const out = [...into];
  for (const w of incoming) {
    if (!out.some((x) => x.by === w.by)) out.push(w);
  }
  return out;
}

/**
 * Drop word-level alignment from a witness. `alignTo` / `morphemeAlignTo`
 * index into the `words[]` of the segment the witness was AUTHORED on; when a
 * witness is pooled onto another community's segment (whose word segmentation
 * may differ — e.g. MAPLE splits `Bup·pō` where Bodhi groups `bup-pō`), those
 * indices mis-anchor the hover arrows. Pool the English text, not the
 * alignment — the witness keeps its arrows on its own community's page.
 */
function stripAlignment(w: Witness): Witness {
  if (w.alignTo === undefined && w.morphemeAlignTo === undefined) return w;
  const { alignTo: _alignTo, morphemeAlignTo: _morphemeAlignTo, ...rest } = w;
  return rest;
}

/**
 * Cross-community witness pool keyed by `phraseId`. `pool.get(id)` is the
 * deduped (by `by`) list of every witness contributed for that phrase, in
 * community-iteration then authored order.
 */
function buildWitnessPool(communities: CommunityChant[]): Map<string, Witness[]> {
  const pool = new Map<string, Witness[]>();
  for (const cc of communities) {
    for (const section of cc.sections) {
      if (section.shape !== 'triple-script-witness') continue;
      for (const seg of section.segments) {
        if (!seg.phraseId) continue;
        pool.set(seg.phraseId, mergeByName(pool.get(seg.phraseId) ?? [], seg.witnesses));
      }
    }
  }
  return pool;
}

/** Move the witness whose `by === defaultBy` to the front. No-op if absent or already first. */
function leadWith(witnesses: Witness[], defaultBy?: string): Witness[] {
  if (!defaultBy) return witnesses;
  const idx = witnesses.findIndex((w) => w.by === defaultBy);
  if (idx <= 0) return witnesses;
  return [witnesses[idx], ...witnesses.slice(0, idx), ...witnesses.slice(idx + 1)];
}

/** True iff `a` and `b` are the same references in the same order. */
function sameOrder(a: Witness[], b: Witness[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i]);
}

/**
 * Resolve one community's chant into a render-ready `LiturgyDoc`.
 *
 * @param cc       The community version to render.
 * @param content  The grouping of every community version of this chant
 *                 (must include `cc`). Supplies the witness pool.
 */
export function resolveCommunityChant(cc: CommunityChant, content: ChantContent): LiturgyDoc {
  const pool = buildWitnessPool(content.communities);

  const sections: LiturgySection[] = cc.sections.map((section) => {
    if (section.shape !== 'triple-script-witness') return section;
    const segments: TripleScriptWitnessSegment[] = section.segments.map((seg) => {
      // This community's own witnesses keep their authored word-alignment and
      // lead the list. Witnesses contributed by OTHER communities for the same
      // phrase are folded in as plain text (alignment stripped — see
      // stripAlignment), then the chosen default is floated to the front.
      const ownBys = new Set(seg.witnesses.map((w) => w.by));
      const pooled = seg.phraseId ? pool.get(seg.phraseId) ?? [] : [];
      const foreign = pooled.filter((w) => !ownBys.has(w.by)).map(stripAlignment);
      const ordered = leadWith([...seg.witnesses, ...foreign], cc.defaultWitnessBy);
      if (sameOrder(ordered, seg.witnesses)) return seg;
      return { ...seg, witnesses: ordered };
    });
    return { ...section, segments };
  });

  // Drop the community-only fields → a clean LiturgyDoc render view.
  const { contentId: _contentId, defaultWitnessBy: _defaultWitnessBy, ...doc } = cc;
  return { ...doc, sections };
}

/**
 * Group a flat list of CommunityChants by `contentId` and resolve each into a
 * render view. The registry uses this to build its doc list.
 */
export function resolveAll(communities: CommunityChant[]): LiturgyDoc[] {
  const byContent = new Map<string, CommunityChant[]>();
  for (const cc of communities) {
    const list = byContent.get(cc.contentId) ?? [];
    list.push(cc);
    byContent.set(cc.contentId, list);
  }
  return communities.map((cc) =>
    resolveCommunityChant(cc, { id: cc.contentId, communities: byContent.get(cc.contentId)! }),
  );
}
