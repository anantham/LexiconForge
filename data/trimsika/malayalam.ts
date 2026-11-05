import type { PhaseView, Provenance } from '../../types/suttaStudio';
import type { TranslationWitness, WitnessAlignment } from '../../types/suttaStudioWitness';

export type MalayalamVerse = {
  verse: number;
  groups: Array<{ wordIds: string[]; text: string; note: string; uncertain?: boolean }>;
};

/** Offline curation assembly. No translation service, automatic word matching or script conversion. */
export function buildMalayalamWitness(phases: PhaseView[], drafts: MalayalamVerse[], provenance: Provenance): TranslationWitness {
  if (drafts.length !== 30 || drafts.some((draft, i) => draft.verse !== i + 1)) {
    throw new Error('Malayalam working translation requires exactly verses 1–30 in order.');
  }
  const passages: Array<{ id: string; label: string; text: string }> = [];
  const alignments: WitnessAlignment[] = [];
  for (const draft of drafts) {
    const phase = phases.find(p => p.id === `verse-${draft.verse}`);
    if (!phase || JSON.stringify(draft.groups.flatMap(g => g.wordIds)) !== JSON.stringify(phase.paliWords.map(w => w.id))) {
      throw new Error(`Malayalam verse ${draft.verse}: phrase spans must cover each canonical written token once in source order.`);
    }
    const groupEnds = new Set<number>();
    let total = 0;
    for (const block of phase.layoutBlocks ?? []) { total += block.length; groupEnds.add(total); }
    const passageId = `ml-v${draft.verse}`;
    const texts = draft.groups.map(group => group.text.trim());
    passages.push({ id: passageId, label: `ശ്ലോകം ${draft.verse}`, text: texts.join(' ') });
    let offset = 0;
    let sourceEnd = 0;
    draft.groups.forEach((group, i) => {
      const text = texts[i];
      sourceEnd += group.wordIds.length;
      if (!text || !/[\u0D00-\u0D7F]/u.test(text) || !group.wordIds.length || !groupEnds.has(sourceEnd)) {
        throw new Error(`Malayalam verse ${draft.verse}, phrase ${i + 1}: requires Malayalam text and complete adjacent source groups.`);
      }
      const end = offset + Array.from(text).length + (i < texts.length - 1 ? 1 : 0);
      alignments.push({
        id: `ml-v${draft.verse}-g${i + 1}`,
        sourceSpans: [{ phaseId: phase.id, wordIds: [...group.wordIds] }],
        targetSpans: [{ passageId, start: offset, end }],
        status: group.uncertain ? 'uncertain' : 'aligned', relation: group.uncertain ? 'uncertain' : 'corresponds',
        displayAt: { phaseId: phase.id, wordId: group.wordIds[0] },
        evidence: `Original AI-assisted phrase alignment to this packet's normalized Lévi 1925 Sanskrit. Not an independently verified equivalence. ${group.note}`,
        review: { status: 'unreviewed' },
      });
      offset = end;
    });
  }
  return {
    id: 'codex-working-ml', label: 'Malayalam working draft · unreviewed', language: 'ml', languageName: 'മലയാളം (Malayalam)', script: 'Mlym', direction: 'ltr',
    attribution: {
      translator: 'Codex — original AI-assisted Malayalam working translation',
      edition: 'Malayalam working translation, AI-assisted and not yet independently reviewed',
      revision: '2026-10-19', license: 'Original local working draft; redistribution terms not established',
      normalization: 'Drafted from the normalized Sanskrit and curation notes in this packet. Malayalam prose, not a script transliteration or an established translator edition. Phrase mappings do not claim word-for-word or morpheme equivalence; Sanskrit/Malayalam scholarly review pending.',
      source: { language: 'sa', witness: provenance.edition?.name ?? 'Lévi 1925 Sanskrit edition, normalized as documented in this packet', url: provenance.edition?.url },
    },
    content: { kind: 'translation', passages, alignments },
  };
}
