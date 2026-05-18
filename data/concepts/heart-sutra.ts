/**
 * Heart Sutra concept registry.
 *
 * Each `ConceptNode` is a cross-language anchor — the abstract idea, with
 * attestations in every script/tradition the chant uses. Hover semantics:
 * hovering any attestation lights up the others.
 *
 * Grounding: every concept aims for ≥2 authoritative citations beyond
 * Wikipedia (which is included as a starting point, not authority). Where
 * 84000 / DDB / Princeton lookups are still pending, citations are added
 * via `eightyFourThousandCitation(null, ...)` / `princetonDictionaryCitation(entry)`
 * so the gap is visible in the UI as "needs lookup" rather than hidden.
 *
 * Spec lineage: types/conceptGraph.ts; design in docs/sutta-studio/POLYGLOT.md §4
 * and docs/sutta-studio/TEXT_GRAPH.md §4.
 *
 * Curation notes for future passes:
 *  - Wikipedia is the floor, not the ceiling. Replace `wikipediaCitation`
 *    with primary-source citation when a Buswell-Lopez page number / 84000
 *    glossary slug / DDB excerpt becomes available.
 *  - Each attestation's `relation` field matters. `semantic` (default) vs
 *    `transliteration` vs `calque` carries real cross-language information
 *    the renderer can show distinctively.
 */

import type { ConceptNode, ConceptRegistry } from '../../types/conceptGraph';
import {
  wikipediaCitation,
  eightyFourThousandCitation,
  ddbCitation,
  princetonDictionaryCitation,
} from '../liturgy/_groundingHelpers';

// ─────────────────────────────────────────────────────────────────────────
// Opening-practice concepts (the prajñāpāramitācaryāṃ caramāṇo cluster)
// ─────────────────────────────────────────────────────────────────────────

const conceptWisdomPrajna: ConceptNode = {
  id: 'concept.wisdom-prajna',
  preferredLabel: 'wisdom (prajñā)',
  preferredLanguage: 'en',
  definition:
    'The kind of knowing that sees how things actually are — distinguished from ordinary cognition (*jñāna*). In Mahāyāna it is perfected as *prajñāpāramitā* and is the central faculty cultivated on the bodhisattva path. The Heart Sutra is named for this concept: *Prajñāpāramitā Hṛdaya* — "Heart of the Perfection of Wisdom."',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'prajñā', pronunciation: 'prahj-NYAH', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'प्रज्ञा', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'paññā', pronunciation: 'PAH-nyah', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '般若',
      pronunciation: 'bōrě (Mandarin)',
      relation: 'transliteration',
      note: 'Phonetic loan from Sanskrit prajñā; characters\' usual meanings ("kind of" + "if") are unrelated.',
    },
    {
      language: 'ja',
      script: 'Jpan',
      text: '般若',
      pronunciation: 'hannya',
      relation: 'transliteration',
      note: 'Same kanji as Chinese; Japanese on-yomi reading.',
    },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཤེས་རབ',
      pronunciation: 'shes rab (Wylie); she-rap (Lhasa)',
      relation: 'calque',
      note: 'Native compound: ཤེས = knowing, རབ = supreme. Tibetan translators rendered prajñā semantically, not phonetically.',
    },
    { language: 'ko', script: 'Hang', text: '반야', pronunciation: 'banya', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'bát-nhã', relation: 'transliteration' },
    // English witnesses
    { language: 'en', script: 'Latn', text: 'wisdom', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Wisdom', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Prajñāpāramitā', witness: 'Red Pine (2004)', relation: 'interpretive', note: 'Red Pine retains the Sanskrit term rather than translating.' },
    { language: 'en', script: 'Latn', text: 'Understanding', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive', note: 'Plum Village renders prajñā as "Understanding" rather than "Wisdom".' },
  ],
  citations: [
    wikipediaCitation('Prajñā_(Buddhism)'),
    eightyFourThousandCitation(null, 'prajñā', 'Looking up canonical 84000 glossary slug.'),
    princetonDictionaryCitation('prajñā', null),
    ddbCitation('般若', 'DDB excerpt pending login-walled lookup.'),
  ],
  relatedConcepts: ['concept.perfection-paramita', 'concept.wisdom-jnana'],
  notes: 'Distinct from *jñāna* (knowledge) — *prajñā* specifically sees emptiness and dependent arising. In Theravāda, *paññā* sees the three marks (anicca, dukkha, anattā).',
};

const conceptPerfectionParamita: ConceptNode = {
  id: 'concept.perfection-paramita',
  preferredLabel: 'perfection / gone-to-the-other-shore (pāramitā)',
  preferredLanguage: 'en',
  definition:
    'A "perfection" cultivated to fullness by bodhisattvas. The term admits two etymologies that Buddhist commentary holds simultaneously: *parama* "highest, supreme" yielding "perfection"; and *pāram + itā* "gone to the other shore" yielding the Tibetan reading. The Heart Sutra uses *prajñāpāramitā* in this dual sense — the wisdom that has gone beyond, the perfection of wisdom.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'pāramitā', pronunciation: 'pah-rah-mee-TAH', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'पारमिता', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'pāramī', relation: 'semantic', note: 'Pali form is pāramī (no -tā); Theravāda lists ten pāramī.' },
    {
      language: 'zh',
      script: 'Hant',
      text: '波羅蜜多',
      pronunciation: 'bōluómìduō',
      relation: 'transliteration',
      note: 'Four-character phonetic transliteration of pā-ra-mi-tā. The 多 was added by Xuanzang to capture the final -tā; earlier translators used just 波羅蜜.',
    },
    {
      language: 'zh',
      script: 'Hant',
      text: '波羅蜜',
      pronunciation: 'bōluómì',
      relation: 'transliteration',
      note: 'Older (Kumārajīva) three-character form, missing the final -tā.',
    },
    { language: 'ja', script: 'Jpan', text: '波羅蜜多', pronunciation: 'haramita', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཕ་རོལ་ཏུ་ཕྱིན་པ',
      pronunciation: 'pha rol tu phyin pa (Wylie); pa-rol-tu chin-pa (Lhasa)',
      relation: 'calque',
      note: 'Reads pāramitā etymologically as "gone (phyin pa) to (tu) the other shore (pha rol)." Native compound, not phonetic.',
    },
    { language: 'ko', script: 'Hang', text: '바라밀', pronunciation: 'baramil', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'ba-la-mật-đa', relation: 'transliteration' },
    // English witnesses
    { language: 'en', script: 'Latn', text: 'transcendent', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive', note: 'MAPLE pairs *transcendent* with *wisdom* to render the compound prajñāpāramitā.' },
    { language: 'en', script: 'Latn', text: 'gone beyond', witness: 'Conze (1958)', relation: 'interpretive', note: 'Conze emphasizes the *pāram-itā* "gone-beyond" etymology.' },
    { language: 'en', script: 'Latn', text: 'Prajñāpāramitā', witness: 'Red Pine (2004)', relation: 'interpretive', note: 'Retains Sanskrit; not separately rendered.' },
    { language: 'en', script: 'Latn', text: 'Perfection', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    wikipediaCitation('Pāramitā'),
    eightyFourThousandCitation(null, 'pāramitā', 'Looking up canonical 84000 glossary slug.'),
    princetonDictionaryCitation('pāramitā', null),
    ddbCitation('波羅蜜多', 'DDB excerpt pending lookup.'),
  ],
  contested: true,
  relatedConcepts: ['concept.wisdom-prajna', 'concept.crossing-other-shore'],
  notes: 'The dual etymology (perfection vs gone-beyond) is held simultaneously by tradition; this is not a contested-meaning case so much as a polysemy that translators handle differently. Mark *contested: true* to surface the divergence in the UI.',
};

const conceptPracticeCarya: ConceptNode = {
  id: 'concept.practice-carya',
  preferredLabel: 'practice / conduct (caryā)',
  preferredLanguage: 'en',
  definition:
    'Disciplined activity or conduct. In the Heart Sutra opening, *prajñāpāramitācaryāṃ caramāṇo* — "practicing the practice of the perfection of wisdom" — uses the same √*car* "to move, walk" twice, once nominalized (*caryā*) and once as a participle (*caramāṇo*). Practice is figured as movement.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'caryā', pronunciation: 'CHAHR-yah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'चर्या', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'cariyā', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '行',
      pronunciation: 'xíng',
      relation: 'semantic',
      note: 'Native Chinese verb for walking / practising. Doubles as the present participle in Buddhist Chinese (e.g., 行深 = practising deeply).',
    },
    { language: 'ja', script: 'Jpan', text: '行', pronunciation: 'gyō', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྤྱོད་པ',
      pronunciation: 'spyod pa (Wylie); chö-pa (Lhasa)',
      relation: 'semantic',
      note: 'Tibetan verbal noun: conduct, behaviour, practice.',
    },
    { language: 'en', script: 'Latn', text: 'practising', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'practising', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'going', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive', note: 'MAPLE renders *caramāṇo* (the participle of √car) as "going" to preserve the movement metaphor.' },
    { language: 'en', script: 'Latn', text: 'moving', witness: 'Conze (1958)', relation: 'interpretive', note: 'Conze: "was moving in the deep course" — preserves √car as movement.' },
  ],
  citations: [
    wikipediaCitation('Caryā'),
    eightyFourThousandCitation(null, 'caryā'),
    princetonDictionaryCitation('caryā', null),
  ],
  relatedConcepts: ['concept.movement-car'],
  notes: 'The root √car "to move" generates both *caryā* (practice as nominal) and *caramāṇo* (the active participle "practising"). Tagging both surface forms with this concept lets hover unify them across translators who chose different English verbs.',
};

const conceptDeepGambhira: ConceptNode = {
  id: 'concept.deep-gambhira',
  preferredLabel: 'deep / profound (gambhīra)',
  preferredLanguage: 'en',
  definition:
    'Profound, hard to fathom. Qualifies the practice of *prajñāpāramitā* in the Heart Sutra opening — *gambhīrāṃ prajñāpāramitācaryāṃ* — to mark it as not surface-level. The same word qualifies dependent arising and other Buddhist doctrines elsewhere in the canon.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'gambhīra', pronunciation: 'gahm-BHEE-rah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'गम्भीर', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'gambhīra', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '深',
      pronunciation: 'shēn',
      relation: 'semantic',
      note: 'Native Chinese adjective: deep, profound. Direct semantic match.',
    },
    { language: 'ja', script: 'Jpan', text: '深', pronunciation: 'jin', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཟབ་མོ',
      pronunciation: 'zab mo (Wylie); zab-mo (Lhasa)',
      relation: 'semantic',
      note: 'ཟབ = deep, profound; མོ = feminine suffix agreeing with caryā.',
    },
    { language: 'en', script: 'Latn', text: 'deep', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deep', witness: 'Conze (1958)', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deep', witness: 'Red Pine (2004)', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deeply', witness: 'Thich Nhat Hanh (2014)', relation: 'semantic' },
  ],
  citations: [
    wikipediaCitation('Gambhīra'),
    princetonDictionaryCitation('gambhīra', null),
  ],
  notes: 'A rare case where every tradition lands on the same word — depth-as-metaphor crosses without resistance. The English witnesses are unanimous.',
};

// ─────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────

export const HEART_SUTRA_CONCEPTS: ConceptRegistry = {
  [conceptWisdomPrajna.id]: conceptWisdomPrajna,
  [conceptPerfectionParamita.id]: conceptPerfectionParamita,
  [conceptPracticeCarya.id]: conceptPracticeCarya,
  [conceptDeepGambhira.id]: conceptDeepGambhira,
};
