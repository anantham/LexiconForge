import { describe, it, expect } from 'vitest';
import type {
  CompoundType,
  DeepLoomPacket,
  EpistemicBasis,
  GhostKind,
  MorphHint,
  ParallelRef,
  Provenance,
  Relation,
  Sense,
  Span,
} from './suttaStudio';

// Round-trip test for the additive bilingual fields landed per
// docs/sutta-studio/FEATURES.md §2.1-§2.7.
// The intent is not to exercise the renderer or validator — those are
// downstream — but to lock down the *type shape* so that future edits
// notice when an additive field is accidentally dropped or renamed.

describe('Sutta Studio additive schema fields (FEATURES.md §2)', () => {
  it('MorphHint accepts verb morphology (§2.1)', () => {
    const verb: MorphHint = {
      // existing nominal fields still work
      case: 'gen',
      number: 'pl',
      // new in §2.1
      gender: 'm',
      person: '1',
      tenseAspect: 'aorist',
      mood: 'indicative',
      voice: 'active',
      form: 'finite',
    };
    expect(verb.tenseAspect).toBe('aorist');
    expect(verb.form).toBe('finite');
  });

  it('MorphHint accepts ablative case + dual number (§2.1)', () => {
    const ablative: MorphHint = { case: 'abl', number: 'du' };
    expect(ablative.case).toBe('abl');
    expect(ablative.number).toBe('du');
  });

  it('Round-trips every CompoundType through JSON (§2.2)', () => {
    const all: CompoundType[] = [
      'tappurisa',
      'kammadhāraya',
      'dvandva',
      'bahubbīhi',
      'avyayībhāva',
      'dvigu',
    ];
    const roundTripped = JSON.parse(JSON.stringify(all)) as CompoundType[];
    expect(roundTripped).toEqual(all);
  });

  it('Expanded GhostKind preserves legacy values + new ones (§2.3)', () => {
    const kinds: GhostKind[] = [
      // legacy — must still type-check
      'required',
      'interpretive',
      // new
      'article',
      'copula',
      'auxiliary',
      'pronoun_from_verb',
      'preposition_from_case',
      'punctuation',
      'quote_marker',
    ];
    expect(kinds).toHaveLength(9);
    // JSON round-trip (defensive — these are string literals so this should be trivial)
    expect(JSON.parse(JSON.stringify(kinds))).toEqual(kinds);
  });

  it('Span captures quoted-speech / cited-phrase / parenthetical (§2.4)', () => {
    const spans: Span[] = [
      { id: 's1', kind: 'quoted_speech', startWordId: 'p1', endWordId: 'p5' },
      { id: 's2', kind: 'cited_phrase',  startWordId: 'p6', endWordId: 'p7', note: 'PED' },
      { id: 's3', kind: 'parenthetical', startWordId: 'p8', endWordId: 'p9' },
    ];
    const back = JSON.parse(JSON.stringify(spans)) as Span[];
    expect(back).toEqual(spans);
  });

  it('Sense accepts confidence + epistemicBasis + sourceCitationIds (§2.5)', () => {
    const basis: EpistemicBasis = 'commentarial';
    const sense: Sense = {
      english: 'mindfulness',
      nuance: 'sati — standard rendering',
      confidence: 'medium',
      epistemicBasis: basis,
      sourceCitationIds: ['ped-sati', 'buddhaghosa-pp-240'],
    };
    const back = JSON.parse(JSON.stringify(sense)) as Sense;
    expect(back.confidence).toBe('medium');
    expect(back.epistemicBasis).toBe('commentarial');
    expect(back.sourceCitationIds).toEqual(['ped-sati', 'buddhaghosa-pp-240']);
  });

  it('Relation accepts confidence + epistemicBasis (§2.5)', () => {
    const rel: Relation = {
      targetWordId: 'p2',
      type: 'action',
      label: 'Heard BY',
      confidence: 'low',
      epistemicBasis: 'contextual',
    };
    const back = JSON.parse(JSON.stringify(rel)) as Relation;
    expect(back.confidence).toBe('low');
    expect(back.epistemicBasis).toBe('contextual');
  });

  it('Provenance captures the full chain of custody (§2.6)', () => {
    const provenance: Provenance = {
      attribution: {
        speaker: 'Bhagavā',
        audience: 'bhikkhus at Kammāsadhamma',
        legendaryDate: 'c. 5th century BCE',
        legendaryPlace: 'Kammāsadhamma, Kuru country',
        confidence: 'traditional',
      },
      oralLineage: {
        school: 'Theravāda',
        transmissionLanguage: 'Pāli',
        estimatedPeriod: 'c. 5th–1st century BCE',
        method: 'bhāṇaka recitation',
      },
      firstWritten: {
        estimatedDate: 'c. 29–17 BCE',
        place: 'Aluvihāra, Sri Lanka',
        medium: 'palm leaf',
      },
      manuscripts: [
        { id: 'witness.mn10-pli-vri', repository: 'VRI', script: 'Devanāgarī', digitizer: 'VRI' },
      ],
      edition: {
        name: 'Mahāsaṅgīti Tipiṭaka Buddhavasse 2500',
        year: '1956',
        council: 'Sixth Buddhist Council',
        digitalSource: 'Vipassana Research Institute',
      },
      translation: {
        translator: 'Bhikkhu Sujato',
        year: '2018',
        license: 'CC0',
        institution: 'SuttaCentral',
      },
      external: [
        { type: 'suttacentral', url: 'https://suttacentral.net/mn10/pli/ms' },
      ],
      segmentVariants: {
        'mn10:4.1': [
          { witness: 'PTS', reading: 'kāyānupassī viharati', note: 'standard reading' },
        ],
      },
    };
    const back = JSON.parse(JSON.stringify(provenance)) as Provenance;
    expect(back.attribution?.speaker).toBe('Bhagavā');
    expect(back.edition?.name).toContain('Mahāsaṅgīti');
    expect(back.segmentVariants?.['mn10:4.1']).toHaveLength(1);
  });

  it('ParallelRef captures cross-references (§2.7)', () => {
    const parallels: ParallelRef[] = [
      { workId: 'an5.114' },
      { workId: 'sn54.1', segmentId: 'sn54.1:1.2', note: 'verbatim breath formula' },
    ];
    const back = JSON.parse(JSON.stringify(parallels)) as ParallelRef[];
    expect(back).toEqual(parallels);
  });

  it('DeepLoomPacket accepts version + provenance + phase-level spans/parallels + word-level compound', () => {
    const packet: DeepLoomPacket = {
      packetId: 'mn10-v2-sample',
      version: 'v2',
      source: { provider: 'suttacentral', workId: 'mn10' },
      canonicalSegments: [
        {
          ref: { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:1.1' },
          order: 0,
          pali: 'Evaṁ me sutaṁ',
          baseEnglish: 'Thus have I heard',
        },
      ],
      phases: [
        {
          id: 'phase-a',
          canonicalSegmentIds: ['mn10:1.1'],
          paliWords: [
            {
              id: 'p1',
              segments: [{ id: 'p1s1', text: 'kāyānupassī', type: 'stem' }],
              senses: [{ english: 'observer of body', nuance: 'tappurisa compound' }],
              compoundType: 'tappurisa',
              compoundSegments: ['p1s1'],
            },
          ],
          englishStructure: [
            { id: 'e1', label: 'I', isGhost: true, ghostKind: 'pronoun_from_verb' },
          ],
          spans: [
            { id: 'sp1', kind: 'quoted_speech', startWordId: 'p1', endWordId: 'p1' },
          ],
          parallels: [{ workId: 'mn119', note: 'parallel kāyagatāsati' }],
        },
      ],
      citations: [],
      provenance: {
        edition: { name: 'Mahāsaṅgīti Tipiṭaka Buddhavasse 2500' },
        translation: { translator: 'Bhikkhu Sujato' },
      },
      renderDefaults: { ghostOpacity: 0.3, englishVisible: true, studyToggleDefault: true },
    };

    const back = JSON.parse(JSON.stringify(packet)) as DeepLoomPacket;
    expect(back.version).toBe('v2');
    expect(back.provenance?.translation?.translator).toBe('Bhikkhu Sujato');
    expect(back.phases[0].paliWords[0].compoundType).toBe('tappurisa');
    expect(back.phases[0].englishStructure[0].ghostKind).toBe('pronoun_from_verb');
    expect(back.phases[0].spans?.[0].kind).toBe('quoted_speech');
    expect(back.phases[0].parallels?.[0].workId).toBe('mn119');
  });
});
