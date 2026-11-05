import { createHash } from 'node:crypto';
import { validateWitnesses } from '../../services/sutta-studio/witnesses';
import malayalamDraft from './malayalam.json';
import { buildMalayalamWitness } from './malayalam';
import lapisLazuli from './lapis-lazuli.json';
import type { TranslationWitness } from '../../types/suttaStudioWitness';
import type { DeepLoomPacket, EnglishToken, PaliWord, Sense } from '../../types/suttaStudio';

export type VerseSource = { verse: number; text: string; page: number };
export type WordDraft = {
  text: string;
  english: string;
  note: string;
  alternative?: string;
  alternativeRipple?: { ghostId: string; label: string };
  parts?: string[];
  functionWord?: boolean;
  morph?: import('../../types/suttaStudio').MorphHint;
  relation?: { target: number; type: import('../../types/suttaStudio').RelationType; label: string };
};
export type VerseDraft = {
  verse: number;
  title: string;
  brief: string;
  words: WordDraft[];
  /** Inclusive one-based ends of contiguous reading groups; target 3, maximum 5 written words. */
  lineEnds: number[];
  /** One-based word indices; explicit reorder only, never omit a source word. */
  order?: Array<number | { ghost: string; kind: import('../../types/suttaStudio').GhostKind; layoutWith?: number }>;
};

/** Offline assembly only. No provider, dictionary lookup, syllabifier or compiler. */
export function buildTrimsika(source: VerseSource[], drafts: VerseDraft[], provenance: NonNullable<DeepLoomPacket['provenance']>): DeepLoomPacket {
  const expected = Array.from({ length: 30 }, (_, i) => i + 1);
  if (JSON.stringify(source.map(v => v.verse)) !== JSON.stringify(expected)
    || JSON.stringify(drafts.map(v => v.verse)) !== JSON.stringify(expected)) {
    throw new Error('Triṃśikā requires exactly verses 1–30 in source and annotations, in order.');
  }
  const scanUrl = 'https://gallica.bnf.fr/ark:/12148/bpt6k326626j';
  const packet: DeepLoomPacket = {
    packetId: 'trimsika-levi-1925-draft',
    version: 'v1',
    source: { provider: 'local-edition', workId: 'trimsika', language: 'sa', title: 'Triṃśikā-vijñaptimātratā — Vasubandhu’s Thirty Verses' },
    canonicalSegments: [], phases: [], citations: [], provenance,
    translations: {
      defaultWitnessId: 'codex-study-en',
      witnesses: [{
        id: 'codex-study-en', label: 'Codex study draft · unreviewed', language: 'en', languageName: 'English', script: 'Latn',
        attribution: {
          translator: provenance.translation?.translator ?? 'Codex — original unreviewed study draft',
          edition: 'Original interlinear study draft', revision: '2026-10-19',
          license: 'Local study draft; redistribution terms not established',
          normalization: 'Existing authored glosses; lexical alternatives and supplied grammar remain editable reading choices.',
          source: { language: 'sa', witness: provenance.edition?.name ?? 'Lévi 1925 Sanskrit edition', url: scanUrl },
        },
        content: { kind: 'legacy-interlinear' },
      }],
    },
    renderDefaults: { ghostOpacity: 0.3, englishVisible: true, studyToggleDefault: true },
    progress: { totalPhases: 30, readyPhases: 30, totalSegments: 30, readySegments: 30, state: 'complete' },
    compiler: {
      provider: 'local', model: 'none — offline assembly of Codex-authored draft', promptVersion: 'trimsika-curation-draft-v1',
      createdAtISO: '2026-10-19T00:00:00.000Z',
      sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex'),
    },
  };
  for (const [i, src] of source.entries()) {
    const draft = drafts[i];
    const ref = { provider: 'local-edition' as const, workId: 'trimsika', segmentId: `trimsika:${src.verse}` };
    const text = draft.words.map(w => w.text).join(' ');
    if (text !== src.text) throw new Error(`Verse ${src.verse}: annotations do not reconstruct the exact normalized source.\n${text}\n${src.text}`);
    const order = draft.order ?? draft.words.map((_, j) => j + 1);
    if (order.some(n => typeof n !== 'number' && !n.ghost.trim())) throw new Error(`Verse ${src.verse}: blank ghost.`);
    if (JSON.stringify(order.filter((n): n is number => typeof n === 'number').sort((a, b) => a - b)) !== JSON.stringify(draft.words.map((_, j) => j + 1))) {
      throw new Error(`Verse ${src.verse}: English order must include each word exactly once.`);
    }
    let start = 0;
    const layoutBlocks = draft.lineEnds.map(end => {
      if (!Number.isInteger(end) || end <= start || end > draft.words.length || end - start > 5) {
        throw new Error(`Verse ${src.verse}: line ends must define ordered groups of 1–5 whole written words.`);
      }
      const block = draft.words.slice(start, end).map((_, j) => `v${src.verse}w${start + j + 1}`);
      start = end;
      return block;
    });
    if (start !== draft.words.length) throw new Error(`Verse ${src.verse}: line groups must cover every written word.`);
    for (const item of order) {
      if (typeof item !== 'number' && item.layoutWith !== undefined
        && (!Number.isInteger(item.layoutWith) || item.layoutWith < 1 || item.layoutWith > draft.words.length)) {
        throw new Error(`Verse ${src.verse}: ghost layout anchor must name an existing written word.`);
      }
    }
    const sourceCitation = `cite:levi1925:${src.verse}`;
    const draftCitation = `cite:codex-draft:${src.verse}`;
    packet.citations.push(
      { id: sourceCitation, short: `Lévi 1925, p. ${src.page}, v. ${src.verse}`, provenance: 'manual', url: scanUrl, excerpt: src.text, license: 'Public-domain Sanskrit edition (1925); normalized IAST transcription', detail: 'Supports the Sanskrit wording only, not the English interpretation.', fetchedAt: '2026-10-19' },
      { id: draftCitation, short: `Codex draft annotation · v. ${src.verse} · unreviewed`, provenance: 'manual', detail: `Curator inference, not an attestation by an independent dictionary or translator. ${draft.brief}` },
    );
    const words: PaliWord[] = draft.words.map((w, j) => {
      const id = `v${src.verse}w${j + 1}`;
      const parts = w.parts ?? [w.text];
      if (parts.some(p => !p) || parts.join('') !== w.text) throw new Error(`Verse ${src.verse}, ${w.text}: invalid surface slices.`);
      if (parts.length > 1 && (w.morph || w.relation)) throw new Error(`Verse ${src.verse}, ${w.text}: whole-token grammar requires a single display segment.`);
      if (!w.english.trim() || !w.note.trim()) throw new Error(`Verse ${src.verse}, ${w.text}: missing gloss or reasoning.`);
      if (w.alternative !== undefined && !w.alternative.trim()) throw new Error(`Verse ${src.verse}, ${w.text}: blank alternative.`);
      if (w.alternativeRipple && (!w.alternative?.trim() || !w.alternativeRipple.label.trim())) throw new Error(`Verse ${src.verse}, ${w.text}: ripple requires a nonblank alternative and replacement.`);
      if (w.relation && (!Number.isInteger(w.relation.target) || w.relation.target < 1 || w.relation.target > draft.words.length)) throw new Error(`Verse ${src.verse}: dangling relation.`);
      if (w.relation?.target === j + 1) throw new Error(`Verse ${src.verse}, ${w.text}: self-relation.`);
      const grammarNote = w.relation ? ` Grammar link: ${w.relation.label} → ${draft.words[w.relation.target - 1].text}.` : '';
      const sense = (english: string, alternative = false): Sense => ({
        english, nuance: alternative ? 'Alternative original draft rendering' : 'Original draft rendering',
        notes: `Curator inference (Codex, unreviewed). ${w.note}`,
        epistemicBasis: 'curatorial', confidence: 'medium', citationIds: [draftCitation],
        ...(alternative && w.alternativeRipple ? { ripples: { [w.alternativeRipple.ghostId]: w.alternativeRipple.label } } : {}),
      });
      return {
        id, wordClass: w.functionWord ? 'function' : 'content', sourceRefs: [ref],
        segments: parts.map((part, k) => ({
          id: `${id}s${k + 1}`, text: part, type: 'stem',
          tooltips: [`${w.english}. ${w.note}${grammarNote}`, `Curator inference, unreviewed. Verse ${src.verse}: ${draft.brief}${parts.length > 1 ? ' Display slices preserve the written word; they are not a reconstructed unsandhied spelling.' : ''}`],
          ...(k === 0 && w.morph ? { morph: { ...w.morph, note: `Curator inference. ${w.morph.note ?? w.note}` } } : {}),
          ...(k === 0 && w.relation ? { relation: { targetWordId: `v${src.verse}w${w.relation.target}`, type: w.relation.type, label: w.relation.label, confidence: 'medium', epistemicBasis: 'curatorial' } as const } : {}),
        })),
        senses: [sense(w.english), ...(w.alternative ? [sense(w.alternative, true)] : [])],
      };
    });
    let ghostIndex = 0;
    const englishStructure: EnglishToken[] = order.map((n, j) => typeof n === 'number'
      ? { id: `v${src.verse}e${j + 1}`, linkedPaliId: words[n - 1].id, label: words[n - 1].senses[0].english }
      : { id: `v${src.verse}g${++ghostIndex}`, label: n.ghost, isGhost: true, ghostKind: n.kind,
        ...(n.layoutWith !== undefined ? { layoutWordId: words[n.layoutWith - 1].id } : {}) });
    for (const word of words) for (const sense of word.senses) {
      for (const id of Object.keys(sense.ripples ?? {})) {
        if (!englishStructure.some(t => t.id === id && 'isGhost' in t && t.isGhost)) throw new Error(`Verse ${src.verse}: ripple target ${id} is not a ghost.`);
      }
    }
    packet.canonicalSegments.push({ ref, order: i, pali: src.text, baseEnglish: englishStructure.map(t => t.label).join(' ') });
    packet.phases.push({ id: `verse-${src.verse}`, title: `${src.verse}. ${draft.title}`, canonicalSegmentIds: [ref.segmentId], sourceSpan: [ref], paliWords: words, englishStructure, layoutBlocks });
  }
  packet.translations!.witnesses.push(buildMalayalamWitness(packet.phases, malayalamDraft, provenance));
  packet.translations!.witnesses.push(lapisLazuli as TranslationWitness);
  const witnessIssues = validateWitnesses(packet);
  if (witnessIssues.length) throw new Error(witnessIssues.join("\n"));
  return packet;
}
