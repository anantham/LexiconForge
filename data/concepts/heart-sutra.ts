/**
 * Heart Sutra concept registry — 30 concepts.
 *
 * Grounding source: Gemini Deep Research run 2026-05-18, captured at
 * docs/concepts/heart-sutra-research-gemini.md. That document is the
 * load-bearing reference; this file wires its content into typed records
 * the renderer can consume.
 *
 * Each `ConceptNode` is a cross-language anchor — the abstract idea, with
 * attestations in every script/tradition the chant uses. Hover semantics:
 * hovering any attestation lights up the others.
 *
 * Grounding aims for ≥3 authoritative citations per concept:
 *   - 84000 glossary permalink (where Gemini found one)
 *   - DDB headword + excerpt (Digital Dictionary of Buddhism)
 *   - Princeton Dictionary of Buddhism (page number where available)
 *   - Wikipedia as orienting reference (not authority)
 *
 * Where 84000 has no entry or Princeton page is unverified, the gap is
 * surfaced via `null` arguments to the citation helpers, which render as
 * "needs lookup" in the UI.
 *
 * Pluralism principles (per docs/Vision.md):
 *  - No language is the canonical anchor. Concept identity travels across all.
 *  - Multiple witnesses can disagree on which surface forms attest which concept.
 *  - Some cross-language relations are NOT conceptual — phonetic loans
 *    (`般若` ↔ `prajñā`) sound the same without sharing meaning. Marked
 *    via `relation: 'transliteration'` so the renderer can show them
 *    distinctively.
 *  - Concepts can be contested. Use `contested: true` to surface scholar
 *    disagreement at the concept level.
 */

import type { ConceptNode, ConceptRegistry } from '../../types/conceptGraph';
import {
  wikipediaCitation,
  eightyFourThousandCitation,
  ddbCitation,
  princetonDictionaryCitation,
} from '../liturgy/_groundingHelpers';

// ─────────────────────────────────────────────────────────────────────────
// Opening cluster: prajñā · pāramitā · caryā · gambhīra · Avalokiteśvara · bodhisattva
// ─────────────────────────────────────────────────────────────────────────

const conceptWisdomPrajna: ConceptNode = {
  id: 'concept.wisdom-prajna',
  preferredLabel: 'wisdom (prajñā)',
  preferredLanguage: 'en',
  definition:
    'Discriminating knowledge — the active, non-dual cognition that directly apprehends emptiness. Distinct from *jñāna* (resultant pristine awareness or conventional knowledge); *prajñā* is the path-faculty that *sees* how things actually are. The Heart Sutra is named for this concept: *Prajñāpāramitā Hṛdaya* = "Heart of the Perfection of Wisdom."',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'prajñā', pronunciation: 'prahj-NYAH', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'प्रज्ञा', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'paññā', pronunciation: 'PAH-nyah', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '般若',
      pronunciation: 'bōrě (Mandarin) / Middle Chinese *pan-njak',
      relation: 'transliteration',
      note: 'Phonetic loan from Sanskrit. Existing Chinese 智 (zhì) carried Confucian/Daoist baggage of worldly intellect; translators preserved the sacred metaphysical weight by transliterating.',
    },
    { language: 'ja', script: 'Jpan', text: '般若', pronunciation: 'hannya', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཤེས་རབ',
      pronunciation: 'shes rab (Wylie); she-rap (Lhasa)',
      relation: 'calque',
      note: 'Native compound: ཤེས = knowing, རབ = supreme. Tibetan lexicographers calqued rather than transliterating.',
    },
    { language: 'ko', script: 'Hang', text: '반야', pronunciation: 'banya', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'bát-nhã', relation: 'transliteration' },
    // English witnesses
    { language: 'en', script: 'Latn', text: 'wisdom', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Wisdom', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Prajñāpāramitā', witness: 'Red Pine (2004)', relation: 'interpretive', note: 'Red Pine retains Sanskrit rather than translating.' },
    { language: 'en', script: 'Latn', text: 'Understanding', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive', note: 'Plum Village renders prajñā as "Understanding".' },
  ],
  citations: [
    eightyFourThousandCitation('41924', 'prajñā'),
    ddbCitation('般若', 'Discriminating knowledge, intuitive wisdom, or the highest form of cognition in Mahāyāna Buddhism. Transcends dualistic subject-object conceptualization to directly apprehend the emptiness of all phenomena; sixth and culminating perfection.'),
    princetonDictionaryCitation('prajñā', 655),
    wikipediaCitation('Prajñā_(Buddhism)'),
  ],
  relatedConcepts: ['concept.perfection-paramita', 'concept.knowledge-jnana'],
  notes: 'In Mahāyāna doctrine, *prajñā* is strictly distinct from *jñāna*. *Jñāna* often refers to the Buddha\'s omniscient awareness (translated as Tibetan ye shes); *prajñā* is the active, non-dual discriminative awareness on the path. Perfected as *prajñāpāramitā*.',
};

const conceptPerfectionParamita: ConceptNode = {
  id: 'concept.perfection-paramita',
  preferredLabel: 'perfection / gone-to-other-shore (pāramitā)',
  preferredLanguage: 'en',
  definition:
    'A "perfection" cultivated to fullness by bodhisattvas. The term admits two etymologies held simultaneously by tradition: *parama* (supreme/highest) + *-itā* yielding "perfection"; and *pāram* (other shore) + *itā* (gone) yielding the Tibetan reading "gone to the other shore." The Heart Sutra pairs it with *prajñā* to denote the wisdom that has crossed beyond.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'pāramitā', pronunciation: 'pah-rah-mee-TAH', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'पारमिता', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'pāramī', relation: 'semantic', note: 'Pali form pāramī (no -tā); Theravāda lists ten pāramī.' },
    {
      language: 'zh',
      script: 'Hant',
      text: '波羅蜜多',
      pronunciation: 'bōluómìduō (Mandarin) / Middle Chinese *pa-la-mit-ta',
      relation: 'transliteration',
      note: 'Four-character phonetic loan. Chinese commentaries elucidate via the "other shore" metaphor despite the phonetic form. Xuanzang added the final 多 to capture -tā; Kumārajīva used three-char 波羅蜜.',
    },
    { language: 'ja', script: 'Jpan', text: '波羅蜜多', pronunciation: 'haramitsu(ta)', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཕ་རོལ་ཏུ་ཕྱིན་པ',
      pronunciation: 'pha rol tu phyin pa (Wylie); pa-rol-tu chin-pa (Lhasa)',
      relation: 'calque',
      note: 'Etymological calque: ཕ་རོལ (other shore) + ཏུ (to) + ཕྱིན་པ (gone). Reads pāramitā as pāram-itā.',
    },
    { language: 'ko', script: 'Hang', text: '바라밀다', pronunciation: 'baramilda', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'ba-la-mật-đa', relation: 'transliteration' },
    // English witnesses
    { language: 'en', script: 'Latn', text: 'transcendent', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'gone beyond', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Prajñāpāramitā', witness: 'Red Pine (2004)', relation: 'interpretive', note: 'Retains Sanskrit; not separately rendered.' },
    { language: 'en', script: 'Latn', text: 'Perfection', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('28556', 'pāramitā'),
    ddbCitation('波羅蜜多', '"Perfection" or "crossing over to the other shore." The six (or ten) practices a bodhisattva masters to attain complete awakening: generosity, discipline, patience, effort, meditation, wisdom.'),
    princetonDictionaryCitation('pāramitā', 624),
    wikipediaCitation('Pāramitā'),
  ],
  contested: true,
  relatedConcepts: ['concept.wisdom-prajna', 'concept.crossing-other-shore'],
  notes: 'The dual etymology (perfection vs gone-beyond) isn\'t a contested-meaning so much as a polysemy translators handle differently. Tibetan calques the soteriological metaphor; Chinese phoneticizes; English splits between "perfection" and "gone beyond."',
};

const conceptPracticeCarya: ConceptNode = {
  id: 'concept.practice-carya',
  preferredLabel: 'practice / conduct (caryā)',
  preferredLanguage: 'en',
  definition:
    'The active, lived implementation of the bodhisattva path — disciplined activity, conduct, meditative traversal. In the Heart Sutra opening, *prajñāpāramitācaryāṃ caramāṇo* doubles the √car root (nominalized as *caryā*, then as participle *caramāṇo*) to figure practice itself as movement.',
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
      note: 'Native Chinese verb for walking / practising. Doubles as present participle in Buddhist Chinese (行深 = practising deeply).',
    },
    { language: 'ja', script: 'Jpan', text: '行', pronunciation: 'gyō', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྤྱོད་པ',
      pronunciation: 'spyod pa (Wylie); chö-pa (Lhasa)',
      relation: 'semantic',
      note: 'Verbal noun: conduct, behaviour, practice.',
    },
    { language: 'ko', script: 'Hang', text: '행', pronunciation: 'haeng', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'hạnh', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'going', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive', note: 'MAPLE renders *caramāṇo* (the participle) as "going" to preserve the movement metaphor.' },
    { language: 'en', script: 'Latn', text: 'moving', witness: 'Conze (1958)', relation: 'interpretive', note: 'Conze: "was moving in the deep course" — preserves √car as movement.' },
    { language: 'en', script: 'Latn', text: 'practising', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'practising', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('36509', 'caryā'),
    ddbCitation('行', '"Action," "practice," or "conduct." In Mahāyāna context, the active lived implementation of the bodhisattva path — enactment of profound meditation and ethical discipline.'),
    princetonDictionaryCitation('caryā', null),
    wikipediaCitation('Caryā'),
  ],
  relatedConcepts: ['concept.movement-car'],
  notes: 'Tagging both *caryā* (nominalized) and *caramāṇo* (participle from same root) with this concept lets hover unify them across translators who chose different English verbs.',
};

const conceptDeepGambhira: ConceptNode = {
  id: 'concept.deep-gambhira',
  preferredLabel: 'deep / profound (gambhīra)',
  preferredLanguage: 'en',
  definition:
    'Profound, hard to fathom. A technical Mahāyāna marker for the ultimate realization that plumbs the radical lack of inherent existence (*svabhāva*) in all phenomena — distinguishing this insight from lesser "vast" understandings of dependent origination.',
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
      note: 'Native Chinese adjective. Heart Sutra also uses intensified 甚深 (shènshēn).',
    },
    { language: 'ja', script: 'Jpan', text: '深', pronunciation: 'jin', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཟབ་མོ',
      pronunciation: 'zab mo (Wylie); zap-mo (Lhasa)',
      relation: 'semantic',
      note: 'ཟབ = deep; མོ = feminine suffix agreeing with caryā.',
    },
    { language: 'ko', script: 'Hang', text: '심', pronunciation: 'sim', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'thâm', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deep', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deep', witness: 'Conze (1958)', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deep', witness: 'Red Pine (2004)', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'deeply', witness: 'Thich Nhat Hanh (2014)', relation: 'semantic' },
  ],
  citations: [
    eightyFourThousandCitation('40372', 'gambhīra'),
    ddbCitation('深', 'Characterizes doctrines, states of meditation, or realizations unfathomable to ordinary cognition. Refers specifically to the ineffable nature of emptiness and ultimate truth.'),
    princetonDictionaryCitation('gambhīra', null),
    wikipediaCitation('Gambhīra'),
  ],
  notes: 'Rare case where every tradition lands on the same word — depth-as-metaphor crosses without resistance. English witnesses are unanimous.',
};

const conceptAvalokitesvara: ConceptNode = {
  id: 'concept.avalokita-bodhisattva',
  preferredLabel: 'Avalokiteśvara (bodhisattva of compassion)',
  preferredLanguage: 'en',
  definition:
    'The bodhisattva embodying universal compassion. Famously contested philological history: the original Indian form *Avalokitasvara* ("Perceiver of Sounds") was later replaced with *Avalokiteśvara* ("Lord of Gazing") under Shaivite influence. Kumārajīva translated the older form as 觀音/觀世音; Xuanzang corrected to 觀自在 to match the later Sanskrit.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'Āryāvalokiteśvaro', pronunciation: 'AHR-yah-vah-loh-kee-TAYSH-vah-roh', relation: 'semantic', note: 'Heart Sutra surface form with honorific ārya- prefix.' },
    { language: 'sa', script: 'Latn', text: 'Avalokiteśvara', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'अवलोकितेश्वर', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '觀自在',
      pronunciation: 'Guānzìzài',
      relation: 'calque',
      note: 'Xuanzang\'s rendering (T251): "Lord of Unrestricted Gazing." Matches Avalokita + īśvara morphology.',
    },
    {
      language: 'zh',
      script: 'Hant',
      text: '觀世音',
      pronunciation: 'Guānshìyīn',
      relation: 'calque',
      note: 'Kumārajīva\'s rendering: "Perceiver of the World\'s Sounds." Matches the older Avalokita + svara morphology preserved in Gilgit manuscripts.',
    },
    { language: 'ja', script: 'Jpan', text: '観自在', pronunciation: 'Kanjizai', relation: 'calque' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྤྱན་རས་གཟིགས་དབང་ཕྱུག',
      pronunciation: 'spyan ras gzigs dbang phyug (Wylie); chen-re-zi wang-chuk (Lhasa)',
      relation: 'calque',
      note: 'སྤྱན (honorific eye) + རས་གཟིགས (compassionate gaze) + དབང་ཕྱུག (sovereign / *īśvara*). Follows the later morphology.',
    },
    { language: 'ko', script: 'Hang', text: '관자재', pronunciation: 'Gwanjajae', relation: 'calque' },
    { language: 'vi', script: 'Latn', text: 'Quán Tự Tại', relation: 'calque' },
    // English witnesses
    { language: 'en', script: 'Latn', text: 'Avalokiteśvara', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Avalokita', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Avalokiteśvara', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Avalokiteśvara', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('41544', 'Avalokiteśvara'),
    ddbCitation('觀世音 / 觀自在', 'The Bodhisattva embodying universal compassion. Translators differed on Sanskrit morphology: "He who hears the cries of the world" or "The Lord who gazes down."'),
    princetonDictionaryCitation('Avalokiteśvara', null),
    wikipediaCitation('Avalokiteśvara'),
  ],
  contested: true,
  notes: 'It is doctrinally significant that the Bodhisattva of Compassion is the one to realize ultimate emptiness — links Mahāyāna\'s two wings (profound wisdom + infinite compassion).',
};

const conceptBodhisattva: ConceptNode = {
  id: 'concept.bodhisattva',
  preferredLabel: 'bodhisattva (awakening-being)',
  preferredLanguage: 'en',
  definition:
    'A being who has generated *bodhicitta* — the altruistic intention to attain perfect buddhahood for the sake of all sentient beings — and delays personal *nirvāṇa* to serve others. The ideal practitioner of the Mahāyāna path.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'bodhisattva', pronunciation: 'boh-dee-SAHT-vah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'बोधिसत्त्व', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'bodhisatta', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '菩薩',
      pronunciation: 'púsà (Mandarin) / Middle Chinese *bo-dej-sat-twa',
      relation: 'transliteration',
      note: 'Abbreviation of 菩提薩埵 (pútísàduǒ) — phonetic loan of bodhi + sattva.',
    },
    { language: 'zh', script: 'Hant', text: '菩提薩埵', pronunciation: 'pútísàduǒ', relation: 'transliteration', note: 'Full four-character form rarely used in chant; 菩薩 is the standard.' },
    { language: 'ja', script: 'Jpan', text: '菩薩', pronunciation: 'bosatsu', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'བྱང་ཆུབ་སེམས་དཔའ',
      pronunciation: 'byang chub sems dpa\' (Wylie); jang-chub sem-pa (Lhasa)',
      relation: 'calque',
      note: 'བྱང་ཆུབ = awakening; སེམས་དཔའ = "mind-hero" (interpreting *sattva* via its "courage/hero" secondary sense rather than "being").',
    },
    { language: 'ko', script: 'Hang', text: '보살', pronunciation: 'bosal', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'bồ-tát', relation: 'transliteration' },
    { language: 'en', script: 'Latn', text: 'Bodhisatva,', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive', note: 'MAPLE\'s spelling drops one t.' },
    { language: 'en', script: 'Latn', text: 'Bodhisattva,', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Avalokiteśvara,', witness: 'Red Pine (2004)', relation: 'interpretive', note: 'Red Pine\'s opening rolls bodhisattva into the name.' },
    { language: 'en', script: 'Latn', text: 'Bodhisattva', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('35039', 'bodhisattva'),
    ddbCitation('菩提薩埵', 'A being who has generated the altruistic intention (bodhicitta) to attain perfect buddhahood for the sake of all sentient beings, delaying final personal nirvāṇa.'),
    princetonDictionaryCitation('bodhisattva', 134),
    wikipediaCitation('Bodhisattva'),
  ],
  contested: true,
  relatedConcepts: ['concept.awakening-bodhi', 'concept.being-sattva'],
  notes: 'Tibetan interprets *sattva* via its "courage/hero" (śūra) secondary sense, yielding "awakening-mind-hero" instead of "awakening-being." Heart Sutra uses Avalokiteśvara as the bodhisattva ideal — an epistemic role model, not a mythical deity.',
};

// ─────────────────────────────────────────────────────────────────────────
// Five-skandha cluster: skandha · rūpa · svabhāva · śūnyatā
// ─────────────────────────────────────────────────────────────────────────

const conceptSkandha: ConceptNode = {
  id: 'concept.skandha-aggregate',
  preferredLabel: 'aggregate (skandha)',
  preferredLanguage: 'en',
  definition:
    'A "heap" or "accumulation." The five psycho-physical constituents (*rūpa, vedanā, saṃjñā, saṃskāra, vijñāna*) that mistakenly aggregate to project the illusion of a static, enduring self. The sutra\'s central philosophical move: Avalokiteśvara realizes all five skandhas are empty of inherent existence.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'skandha', pronunciation: 'SKAHN-dhah', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'skandhāḥ', relation: 'semantic', note: 'Plural nominative — the form used in the Heart Sutra.' },
    { language: 'sa', script: 'Deva', text: 'स्कन्ध', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'khandha', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '蘊',
      pronunciation: 'yùn',
      relation: 'semantic',
      note: 'Xuanzang\'s definitive rendering: "heap/accumulation." Kumārajīva had used 陰 (yīn, "shade").',
    },
    { language: 'ja', script: 'Jpan', text: '蘊', pronunciation: 'un', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཕུང་པོ',
      pronunciation: 'phung po (Wylie); pung-po (Lhasa)',
      relation: 'semantic',
      note: 'ཕུང = heap, mass.',
    },
    { language: 'ko', script: 'Hang', text: '온', pronunciation: 'on', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'uẩn', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'skandhas', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'heaps', witness: 'Conze (1958)', relation: 'interpretive', note: 'Conze: "beheld but five heaps" — literal etymology.' },
    { language: 'en', script: 'Latn', text: 'skandhas', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Skandhas', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('40452', 'skandha'),
    ddbCitation('蘊', '"Heap" or "accumulation." Refers to the five psycho-physical constituents that aggregate to project the illusion of a static, enduring self.'),
    princetonDictionaryCitation('skandha', null),
    wikipediaCitation('Skandha'),
  ],
  relatedConcepts: ['concept.form-rupa', 'concept.feeling-vedana', 'concept.perception-samjna', 'concept.formations-samskara', 'concept.consciousness-vijnana'],
};

const conceptFormRupa: ConceptNode = {
  id: 'concept.form-rupa',
  preferredLabel: 'form / body (rūpa)',
  preferredLanguage: 'en',
  definition:
    'The first of the five skandhas — matter, form, physical phenomena, everything derived from the four elements. The visible/material aspect of experience including the body.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'rūpa', pronunciation: 'ROO-pah', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'rūpaṃ', relation: 'semantic', note: 'Nominative singular as in "rūpaṃ śūnyatā."' },
    { language: 'sa', script: 'Latn', text: 'Rūpān', relation: 'semantic', note: 'Ablative — "from form" as in "form is not different from emptiness."' },
    { language: 'sa', script: 'Deva', text: 'रूप', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'rūpa', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '色',
      pronunciation: 'sè',
      relation: 'semantic',
      note: 'Means "color," "looks," "appearances" — captures the phenomenal, visible nature of matter.',
    },
    { language: 'ja', script: 'Jpan', text: '色', pronunciation: 'shiki', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'གཟུགས',
      pronunciation: 'gzugs (Wylie); zuk (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '색', pronunciation: 'saek', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'sắc', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'appearance', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive', note: 'MAPLE uses "appearance" rather than "form."' },
    { language: 'en', script: 'Latn', text: 'Form', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'form', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Body', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive', note: 'Plum Village: "This Body itself is Emptiness" — somatic grounding rather than Platonic "form."' },
  ],
  citations: [
    eightyFourThousandCitation('1316', 'rūpa'),
    ddbCitation('色', 'Matter, form, or physical phenomenon. First of the five skandhas, representing the entirety of the material world including the physical body and visible objects.'),
    princetonDictionaryCitation('rūpa', null),
    wikipediaCitation('Rūpa'),
  ],
  contested: true,
  notes: 'Thich Nhat Hanh\'s "Body" choice is interpretive: avoids Platonic "Form" baggage and grounds emptiness somatically. Translators legitimately disagree.',
};

const conceptSvabhava: ConceptNode = {
  id: 'concept.svabhava-own-being',
  preferredLabel: 'own-being / inherent existence (svabhāva)',
  preferredLanguage: 'en',
  definition:
    '"Self-nature." The independent, permanent, unconditioned essence that ignorant beings falsely project onto phenomena — the primary ontological target of Madhyamaka negation. *Śūnyatā* in the Heart Sutra means specifically the absence of *svabhāva*.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'svabhāva', pronunciation: 'svah-BAH-vah', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'svabhāvaśūnyān', relation: 'semantic', note: 'Compound used in Heart Sutra: "empty-of-own-being."' },
    { language: 'sa', script: 'Deva', text: 'स्वभाव', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'sabhāva', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '自性', pronunciation: 'zìxìng', relation: 'semantic', note: 'Native Chinese compound: 自 = self, 性 = nature.' },
    { language: 'ja', script: 'Jpan', text: '自性', pronunciation: 'jishō', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'རང་བཞིན',
      pronunciation: 'rang bzhin (Wylie); rang-zhin (Lhasa)',
      relation: 'semantic',
      note: 'རང = self/own, བཞིན = nature/manner.',
    },
    { language: 'ko', script: 'Hang', text: '자성', pronunciation: 'jaseong', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'tự tính', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'self-existence', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'own-being', witness: 'Conze (1958)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('41165', 'svabhāva'),
    ddbCitation('自性', '"Self-nature" or "intrinsic existence." The independent, permanent, and unconditioned essence that ignorant beings falsely project onto phenomena.'),
    princetonDictionaryCitation('svabhāva', null),
    wikipediaCitation('Svabhava'),
  ],
};

const conceptSunyata: ConceptNode = {
  id: 'concept.emptiness-sunyata',
  preferredLabel: 'emptiness (śūnyatā)',
  preferredLanguage: 'en',
  definition:
    'The ontological reality that all entities lack inherent existence (*svabhāva*). NOT nothingness or a physical vacuum — radical interconnectedness and flux. The Heart Sutra\'s central declaration: "form is emptiness, emptiness is form" — the lack of inherent existence is the very property that lets form manifest.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'śūnyatā', pronunciation: 'SHOON-yah-TAH', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'śūnya', relation: 'semantic', note: 'Adjectival/stem form.' },
    { language: 'sa', script: 'Latn', text: 'śūnyatāyā', relation: 'semantic', note: 'Ablative — "from emptiness."' },
    { language: 'sa', script: 'Latn', text: 'śūnyataiva', relation: 'semantic', note: 'śūnyatā + eva (intensifier) — "emptiness itself."' },
    { language: 'sa', script: 'Deva', text: 'शून्यता', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'suññatā', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '空',
      pronunciation: 'kōng',
      relation: 'semantic',
      note: 'Risk of conflation with Daoist 無 (wu, non-being); Xuanzang rigorously specified śūnyatā implies dependent origination, not nihilism.',
    },
    { language: 'ja', script: 'Jpan', text: '空', pronunciation: 'kū', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྟོང་པ་ཉིད',
      pronunciation: 'stong pa nyid (Wylie); tong-pa-nyi (Lhasa)',
      relation: 'calque',
      note: 'སྟོང་པ = empty + ཉིད = abstract nominalizer (= Sanskrit -tā). Precise calque ensuring it reads as abstract state, not physical space.',
    },
    { language: 'ko', script: 'Hang', text: '공', pronunciation: 'gong', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'không', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'emptiness', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Emptiness', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'emptiness', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'Emptiness', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('32206', 'śūnyatā'),
    ddbCitation('空', 'The ontological reality that all entities lack inherent existence (svabhāva). Not nothingness, but the radical interconnectedness and flux of reality.'),
    princetonDictionaryCitation('śūnyatā', null),
    wikipediaCitation('Śūnyatā'),
  ],
  contested: true,
  relatedConcepts: ['concept.svabhava-own-being', 'concept.form-rupa', 'concept.dependent-origination'],
  notes: 'Frequent misinterpretation as nihilism, especially in early Chinese Buddhism (conflated with Daoist wú 無). Tibetan calque ensures abstract-noun reading.',
};

// ─────────────────────────────────────────────────────────────────────────
// Seeing cluster: vyavalokayati/paśyati · duḥkha · Śāriputra
// ─────────────────────────────────────────────────────────────────────────

const conceptSeeingVyavalokita: ConceptNode = {
  id: 'concept.seeing-vyavalokita',
  preferredLabel: 'looking / seeing (vyavalokayati / paśyati)',
  preferredLanguage: 'en',
  definition:
    'The penetrating, illuminating vision by which Avalokiteśvara realizes emptiness. Sanskrit distinguishes two acts: continuous compassionate observation (*vyavalokayati sma*, same root as the bodhisattva\'s name *avalokita*) and the instantaneous definitive realization (*paśyati sma*). Xuanzang fused these into the compound 照見 (illuminate-and-see).',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'vyavalokayati', pronunciation: 'vyah-vah-loh-KAH-yah-tee', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'paśyati', pronunciation: 'PAHSH-yah-tee', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'व्यवलोकयति', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'पश्यति', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'passati', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '照見',
      pronunciation: 'zhàojiàn',
      relation: 'semantic',
      note: 'Xuanzang\'s fusion: 照 (illuminate, śamatha-like) + 見 (see, vipaśyanā-like).',
    },
    { language: 'ja', script: 'Jpan', text: '照見', pronunciation: 'shōken', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'རྣམ་པར་ལྟ',
      pronunciation: 'rnam par lta (Wylie)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '조견', pronunciation: 'jogyeon', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'chiếu kiến', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'saw', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'beheld', witness: 'Conze (1958)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'looked', witness: 'Red Pine (2004)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'discovered', witness: 'Thich Nhat Hanh (2014)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('10859', 'vyavalokita'),
    ddbCitation('照見', '"To illuminate and see." Used by Xuanzang to capture the penetrating, active vision of Avalokiteśvara realizing the emptiness of the aggregates.'),
    princetonDictionaryCitation('vyavalokita', null),
  ],
  notes: 'Encapsulates the meditative sequence of *śamatha* (illumination) culminating in *vipaśyanā* (insight). Emptiness is not deduced — it is directly seen.',
};

const conceptSufferingDuhkha: ConceptNode = {
  id: 'concept.suffering-duhkha',
  preferredLabel: 'suffering (duḥkha)',
  preferredLanguage: 'en',
  definition:
    'The fundamental unsatisfactoriness, anxiety, and pervasive conditioning that characterizes unawakened cyclic existence. The first of the Four Noble Truths.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'duḥkha', pronunciation: 'DOOH-khah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'दुःख', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'dukkha', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '苦', pronunciation: 'kǔ', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '苦厄', pronunciation: 'kǔ\'è', relation: 'semantic', note: 'Xuanzang\'s phrase 度一切苦厄 ("crossed over all suffering") is interpolated — no Sanskrit correlate. Likely added for visceral soteriological payoff in Chinese audience.' },
    { language: 'ja', script: 'Jpan', text: '苦', pronunciation: 'ku', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྡུག་བསྔལ',
      pronunciation: 'sdug bsngal (Wylie); duk-ngel (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '고', pronunciation: 'go', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'khổ', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'suffering.', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('726', 'duḥkha'),
    ddbCitation('苦', 'The fundamental unsatisfactoriness, anxiety, and suffering inherent in unawakened cyclic existence (saṃsāra).'),
    princetonDictionaryCitation('duḥkha', null),
  ],
  contested: true,
  notes: '度一切苦厄 ("crossed all suffering") in Xuanzang has no Sanskrit correlate — interpolation likely by Xuanzang or earlier Chinese redactor for soteriological force.',
};

const conceptSariputra: ConceptNode = {
  id: 'concept.sariputra-addressee',
  preferredLabel: 'Śāriputra (the wise disciple)',
  preferredLanguage: 'en',
  definition:
    'The chief disciple of the historical Buddha, renowned as the foremost in wisdom and traditional codifier of the Abhidharma. The Heart Sutra\'s ironic addressee: Avalokiteśvara instructs the Abhidharma master that all his categories are empty.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'Śāriputra', pronunciation: 'SHAH-ree-poo-trah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'शारिपुत्र', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'Sāriputta', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '舍利子',
      pronunciation: 'Shèlìzǐ',
      relation: 'transliteration',
      note: 'Hybrid: 舍利 phonetic for Śāri (mother\'s name) + 子 semantic for *putra* (son).',
    },
    { language: 'zh', script: 'Hant', text: '舍利弗', pronunciation: 'Shèlìfú', relation: 'transliteration', note: 'Full phonetic form — *putra* transliterated as 弗.' },
    { language: 'ja', script: 'Jpan', text: '舎利子', pronunciation: 'Sharishi', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཤཱ་རིའི་བུ',
      pronunciation: 'shA ri\'i bu (Wylie); sha-ri-bu (Lhasa)',
      relation: 'calque',
    },
    { language: 'ko', script: 'Hang', text: '사리자', pronunciation: 'Sarija', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'Xá Lợi Tử', relation: 'transliteration' },
    { language: 'en', script: 'Latn', text: 'Śāriputra,', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('43924', 'Śāriputra'),
    ddbCitation('舍利子', 'Chief disciple of the historical Buddha, renowned as the foremost in wisdom and the traditional codifier of the Abhidharma.'),
    princetonDictionaryCitation('Śāriputra', null),
  ],
  notes: 'Mahāyāna literary device: by having Avalokiteśvara instruct the Abhidharma codifier on the emptiness of his categories, the sutra subverts the foundational scholastic framework of Mainstream Buddhism.',
};

// ─────────────────────────────────────────────────────────────────────────
// Negation cluster: dharma · anutpāda/anirodha · cakṣus/śrotra/... · dhātu
// ─────────────────────────────────────────────────────────────────────────

const conceptDharma: ConceptNode = {
  id: 'concept.dharma-phenomena',
  preferredLabel: 'phenomena / dharmas (sarva-dharmāḥ)',
  preferredLanguage: 'en',
  definition:
    'In plural context (*sarvadharmāḥ*), not the Buddha\'s teachings but the elemental, momentary building blocks of experience that Abhidharma posited as having *svabhāva*. The Heart Sutra asserts all dharmas are marked by emptiness — dissolving Abhidharma\'s atomic realism.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'dharma', pronunciation: 'DHAR-mah', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'sarvadharmāḥ', relation: 'semantic', note: 'All dharmas — the negated set.' },
    { language: 'sa', script: 'Deva', text: 'धर्म', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'dhamma', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '法', pronunciation: 'fǎ', relation: 'semantic' },
    { language: 'ja', script: 'Jpan', text: '法', pronunciation: 'hō', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཆོས',
      pronunciation: 'chos (Wylie); chö (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '법', pronunciation: 'beop', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'pháp', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'dharmas', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('45280', 'dharma (sarva-dharmāḥ)'),
    ddbCitation('法', 'In plural context, refers not to the Buddha\'s teachings but to all phenomena, elements, or fundamental constituents of reality. Polysemous in Buddhist philosophy.'),
    princetonDictionaryCitation('dharma', null),
  ],
};

const conceptUnarisenAnutpada: ConceptNode = {
  id: 'concept.unarisen-anutpada',
  preferredLabel: 'unarisen / unceased (anutpāda / anirodha)',
  preferredLanguage: 'en',
  definition:
    '"No birth and no cessation" — the first pair of negations defining emptiness. Adapted from Nāgārjuna\'s Madhyamaka opening (eight negations); the Heart Sutra uses six: not born, not destroyed, not defiled, not immaculate, not increasing, not decreasing.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'anutpāda', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'anirodha', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'अनुत्पाद', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'anuppāda', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '不生不滅',
      pronunciation: 'bù shēng bù miè',
      relation: 'calque',
      note: '不 = not, 生 = arise, 滅 = cease. Direct morpheme-by-morpheme calque.',
    },
    { language: 'ja', script: 'Jpan', text: '不生不滅', pronunciation: 'fushō fumetsu', relation: 'calque' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྐྱེ་བ་མེད་པ',
      pronunciation: 'skye ba med pa (Wylie)',
      relation: 'calque',
    },
    { language: 'ko', script: 'Hang', text: '불생불멸', pronunciation: 'bulsaeng bulmyeol', relation: 'calque' },
    { language: 'vi', script: 'Latn', text: 'bất sinh bất diệt', relation: 'calque' },
    { language: 'en', script: 'Latn', text: 'does not arise, is not destroyed', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('28988', 'anutpāda'),
    ddbCitation('不生不滅', '"No birth and no cessation." First pair of negations defining the ultimate nature of emptiness. Adapted from Nāgārjuna\'s Mūlamadhyamakakārikā.'),
    princetonDictionaryCitation('anutpāda', 945),
  ],
};

const conceptSenseFaculties: ConceptNode = {
  id: 'concept.six-faculties',
  preferredLabel: 'six sense faculties (cakṣus, śrotra, ghrāṇa, jihvā, kāya, manas)',
  preferredLanguage: 'en',
  definition:
    'The six internal cognitive bases (*ṣaḍāyatana*): eye, ear, nose, tongue, body, mind. After negating the object of perception (the five skandhas), Avalokiteśvara negates the sensory apparatus itself.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'cakṣus', relation: 'semantic', note: 'eye' },
    { language: 'sa', script: 'Latn', text: 'śrotra', relation: 'semantic', note: 'ear' },
    { language: 'sa', script: 'Latn', text: 'ghrāṇa', relation: 'semantic', note: 'nose' },
    { language: 'sa', script: 'Latn', text: 'jihvā', relation: 'semantic', note: 'tongue' },
    { language: 'sa', script: 'Latn', text: 'kāya', relation: 'semantic', note: 'body' },
    { language: 'sa', script: 'Latn', text: 'manas', relation: 'semantic', note: 'mind' },
    { language: 'pi', script: 'Latn', text: 'cakkhu, sota, ghāna, jivhā, kāya, mana', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '眼耳鼻舌身意',
      pronunciation: 'yǎn ěr bí shé shēn yì',
      relation: 'semantic',
      note: 'Rhythmic six-character list.',
    },
    { language: 'ja', script: 'Jpan', text: '眼耳鼻舌身意', pronunciation: 'gen ni bi zetsu shin i', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'མིག',
      pronunciation: 'mig (Wylie); mik (Lhasa)',
      relation: 'semantic',
      note: 'mig (eye), rna ba (ear), sna (nose), lce (tongue), lus (body), yid (mind).',
    },
    { language: 'ko', script: 'Hang', text: '안이비설신의', pronunciation: 'an i bi seol sin ui', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'nhãn nhĩ tỵ thiệt thân ý', relation: 'semantic' },
  ],
  citations: [
    eightyFourThousandCitation('41408', 'six āyatanas'),
    ddbCitation('眼耳鼻舌身意', 'The six internal cognitive bases (ṣaḍāyatana): eye, ear, nose, tongue, body, and mind.'),
  ],
  notes: 'Systematic dismantling of the āyatana schema. The sutra also negates the corresponding six external objects (form, sound, smell, taste, touch, mental objects) and six consciousnesses.',
};

const conceptRealmDhatu: ConceptNode = {
  id: 'concept.realm-dhatu',
  preferredLabel: 'realm / element (dhātu)',
  preferredLanguage: 'en',
  definition:
    'Refers to the eighteen *dhātus* — spheres or elements of cognitive experience: six faculties + six objects + six consciousnesses. The Heart Sutra uses *yāvat* ("up to") to elide and negate the whole list.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'dhātu', pronunciation: 'DHAH-too', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'धातु', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'dhātu', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '界', pronunciation: 'jiè', relation: 'semantic' },
    { language: 'ja', script: 'Jpan', text: '界', pronunciation: 'kai', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཁམས',
      pronunciation: 'khams (Wylie); kham (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '계', pronunciation: 'gye', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'giới', relation: 'semantic' },
  ],
  citations: [
    eightyFourThousandCitation('35346', 'dhātu'),
    ddbCitation('界', 'Refers to the eighteen spheres or elements of cognitive experience (six faculties, six objects, six consciousnesses).'),
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// 12-links + 4-truths + path cluster
// ─────────────────────────────────────────────────────────────────────────

const conceptIgnoranceAvidya: ConceptNode = {
  id: 'concept.ignorance-avidya',
  preferredLabel: 'ignorance (avidyā)',
  preferredLanguage: 'en',
  definition:
    '"Without light" / "lack of clear knowing." The first of the twelve links of dependent origination (*pratītyasamutpāda*) — the fetter that binds beings to saṃsāra. Heart Sutra: "no ignorance, nor extinction of ignorance" — even ignorance itself is empty.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'avidyā', pronunciation: 'ah-VID-yah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'अविद्या', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'avijjā', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '無明',
      pronunciation: 'wúmíng',
      relation: 'calque',
      note: '無 = no, 明 = light/brightness. Reflects the privative a- in Sanskrit.',
    },
    { language: 'ja', script: 'Jpan', text: '無明', pronunciation: 'mumyō', relation: 'calque' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'མ་རིག་པ',
      pronunciation: 'ma rig pa (Wylie); ma-rik-pa (Lhasa)',
      relation: 'calque',
    },
    { language: 'ko', script: 'Hang', text: '무명', pronunciation: 'mumyeong', relation: 'calque' },
    { language: 'vi', script: 'Latn', text: 'vô minh', relation: 'calque' },
  ],
  citations: [
    eightyFourThousandCitation('41100', 'avidyā'),
    ddbCitation('無明', '"Without light" or "lack of clear knowing." The fundamental misapprehension of reality that catalyzes the cycle of dependent arising.'),
  ],
};

const conceptAgingDeath: ConceptNode = {
  id: 'concept.aging-death-jaramarana',
  preferredLabel: 'aging and death (jarāmaraṇa)',
  preferredLanguage: 'en',
  definition:
    '"Old age and death." Final link in the twelvefold chain of dependent arising. Heart Sutra brackets the twelve links by negating both endpoints (avidyā and jarāmaraṇa).',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'jarāmaraṇa', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'जरामरण', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'jarāmaraṇa', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '老死', pronunciation: 'lǎosǐ', relation: 'semantic' },
    { language: 'ja', script: 'Jpan', text: '老死', pronunciation: 'rōshi', relation: 'semantic' },
    { language: 'bo', script: 'Tibt', text: 'རྒ་ཤི', pronunciation: 'rga shi (Wylie)', relation: 'semantic' },
    { language: 'ko', script: 'Hang', text: '노사', pronunciation: 'nosa', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'lão tử', relation: 'semantic' },
  ],
  citations: [
    eightyFourThousandCitation('40772', 'jarāmaraṇa'),
    ddbCitation('老死', '"Old age and death." Final link in the twelvefold chain of dependent arising; the inevitable result of birth (jāti).'),
  ],
};

const conceptFourTruths: ConceptNode = {
  id: 'concept.four-truths',
  preferredLabel: 'Four Noble Truths (duḥkha · samudaya · nirodha · mārga)',
  preferredLanguage: 'en',
  definition:
    'The bedrock formulation: suffering, its cause/accumulation, its cessation, and the path. Heart Sutra negates all four in one stroke — they remain valid at conventional truth (*saṃvṛtisatya*) but are empty at ultimate truth (*paramārthasatya*).',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'duḥkha, samudaya, nirodha, mārga', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'dukkha, samudaya, nirodha, magga', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '苦集滅道', pronunciation: 'kǔ jí miè dào', relation: 'semantic' },
    { language: 'ja', script: 'Jpan', text: '苦集滅道', pronunciation: 'ku jū metsu dō', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྡུག་བསྔལ, ཀུན་འབྱུང, འགོག་པ, ལམ',
      pronunciation: 'sdug bsngal, kun \'byung, \'gog pa, lam (Wylie)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '고집멸도', pronunciation: 'go jib myeol do', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'khổ tập diệt đạo', relation: 'semantic' },
  ],
  citations: [
    eightyFourThousandCitation('726', 'duḥkha (as part of 4 truths)'),
    ddbCitation('苦集滅道', 'Suffering, accumulation (cause), cessation, and path. The bedrock doctrine of Buddhism formulated at the Deer Park sermon.'),
  ],
  notes: 'Apotheosis of Mahāyāna apophatic discourse. The Four Noble Truths are therapeutic rafts at conventional truth, empty at ultimate truth.',
};

const conceptKnowledgeJnana: ConceptNode = {
  id: 'concept.knowledge-jnana',
  preferredLabel: 'knowledge (jñāna)',
  preferredLanguage: 'en',
  definition:
    'Intellectual comprehension, pristine awareness, cognitive apprehension. Distinct from *prajñā* (transcendent wisdom). Heart Sutra: "no knowledge" — even reified cognitive grasping of emptiness becomes a new idol.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'jñāna', pronunciation: 'NYAH-nah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'ज्ञान', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'ñāṇa', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '智', pronunciation: 'zhì', relation: 'semantic' },
    { language: 'ja', script: 'Jpan', text: '智', pronunciation: 'chi', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཡེ་ཤེས',
      pronunciation: 'ye shes (Wylie); ye-she (Lhasa)',
      relation: 'calque',
      note: 'ཡེ = primordial, ཤེས = knowing. Buddha\'s pristine awareness.',
    },
    { language: 'ko', script: 'Hang', text: '지', pronunciation: 'ji', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'trí', relation: 'semantic' },
  ],
  citations: [
    eightyFourThousandCitation('1414', 'jñāna'),
    ddbCitation('智', 'Intellectual comprehension, pristine awareness, or cognitive apprehension. Differentiated in this text from prajñā (transcendent wisdom).'),
  ],
  relatedConcepts: ['concept.wisdom-prajna'],
};

const conceptAttainmentPrapti: ConceptNode = {
  id: 'concept.attainment-prapti',
  preferredLabel: 'attainment / non-attainment (prāpti / aprāptitvā)',
  preferredLanguage: 'en',
  definition:
    'Acquiring fruits of the path (liberation, Buddhahood). *Aprāptitvāt* ("because there is no attainment") is the sutra\'s soteriological pivot — having dissolved all categories, the bodhisattva realizes that seeking awakening as a possessable thing is the final obstacle to actualizing it.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'prāpti', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'aprāptitvā', relation: 'semantic', note: 'Ablative — "because of non-attainment."' },
    { language: 'sa', script: 'Deva', text: 'प्राप्ति', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'patti', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '得', pronunciation: 'dé', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '無所得', pronunciation: 'wúsuǒdé', relation: 'semantic', note: '"Nothing-to-attain" — Heart Sutra phrase.' },
    { language: 'ja', script: 'Jpan', text: '得 / 無所得', pronunciation: 'toku / mushotoku', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཐོབ་པ',
      pronunciation: 'thob pa (Wylie); top-pa (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '득 / 무소득', pronunciation: 'deuk / musodeuk', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'đắc / vô sở đắc', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'attainment', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'realization', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'apprehension.', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive', note: 'MAPLE: "by practicing no apprehension" — translates aprāptitvā soteriologically.' },
  ],
  citations: [
    eightyFourThousandCitation('37200', 'prāpti'),
    ddbCitation('得 / 無所得', '"To attain" or "no attainment." Refers to acquiring the fruits of the Buddhist path (liberation or Buddhahood).'),
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Result cluster: cittāvaraṇa · atrasta · viparyāsa · nirvāṇa
// ─────────────────────────────────────────────────────────────────────────

const conceptObstructionAvarana: ConceptNode = {
  id: 'concept.obstruction-cittavarana',
  preferredLabel: 'mental obstruction (cittāvaraṇa)',
  preferredLanguage: 'en',
  definition:
    'Mental obscurations that cloud the mind\'s natural lucidity and cause fear. Two scholastic veils: emotional afflictions (*kleśāvaraṇa*) + cognitive impediments (*jñeyāvaraṇa*). Heart Sutra: realizing emptiness clears both.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'cittāvaraṇa', pronunciation: 'CHEET-tah-VAH-rah-nah', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'चित्तावरण', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '心罣礙',
      pronunciation: 'xīn guà\'ài',
      relation: 'semantic',
      note: '心 = mind; 罣礙 = snag/anxiety. Slightly different nuance — emotional snag rather than scholastic veil.',
    },
    { language: 'ja', script: 'Jpan', text: '心罣礙', pronunciation: 'shin kege', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སེམས་ལ་སྒྲིབ་པ',
      pronunciation: 'sems la sgrib pa (Wylie); sem-la drip-pa (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '심가애', pronunciation: 'sim ga\'ae', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'tâm quái ngại', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'obstruction', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('37627', 'citta'),
    eightyFourThousandCitation('225', 'āvaraṇa'),
    ddbCitation('心罣礙', 'Mental hindrance, obstruction, or obscuration that clouds the mind\'s natural lucidity and causes fear.'),
  ],
  contested: true,
  notes: 'Chinese 罣礙 has the additional connotation of emotional anxiety/snag, slightly different from Sanskrit scholastic *āvaraṇa* (cognitive/emotional veils).',
};

const conceptFearlessAtrasta: ConceptNode = {
  id: 'concept.fearless-atrasta',
  preferredLabel: 'unafraid (atrasta)',
  preferredLanguage: 'en',
  definition:
    'Without fear. With no ego to preserve (skandhas seen as empty), there is no intrinsic self to be harmed. Absence of mental obscuration logically culminates in fearlessness.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'atrasta', pronunciation: 'ah-TRAHS-tah', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'atrasto', relation: 'semantic', note: 'Nominative singular masculine — surface form in Heart Sutra.' },
    { language: 'sa', script: 'Deva', text: 'अत्रस्त', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '無有恐怖', pronunciation: 'wú yǒu kǒngbù', relation: 'semantic', note: '"Without having terror/fear."' },
    { language: 'ja', script: 'Jpan', text: '無有恐怖', pronunciation: 'mu u fu', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྐྲག་པ་མེད་པ',
      pronunciation: 'skrag pa med pa (Wylie); trak-pa me-pa (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '무유공포', pronunciation: 'mu yu gong po', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'vô hữu khủng bố', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'fear.', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('20920', 'atrasta'),
    ddbCitation('無有恐怖', '"Without having terror/fear." The profound psychological state resulting from realizing emptiness.'),
  ],
};

const conceptInvertedView: ConceptNode = {
  id: 'concept.inverted-view-viparyasa',
  preferredLabel: 'inverted view + crossed-beyond (viparyāsa + atikrānta)',
  preferredLanguage: 'en',
  definition:
    '*Viparyāsa* denotes the four cognitive inversions: impermanent-as-permanent, suffering-as-joy, non-self-as-self, impure-as-pure. *Atikrānta* = "crossed beyond." Chinese 顛倒夢想 adds "dream-thoughts" — an interpretive flourish.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'viparyāsātikrānta', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'viparyāsa', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'विपर्यास अतिक्रान्त', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'vipallāsa atikkanta', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '遠離顛倒夢想',
      pronunciation: 'yuǎnlí diāndǎo mèngxiǎng',
      relation: 'interpretive',
      note: 'Adds 夢想 ("dream-thoughts") — not in Sanskrit. Influenced Chan/Zen poetics.',
    },
    { language: 'ja', script: 'Jpan', text: '遠離一切顛倒夢想', pronunciation: 'onri issai tendō musō', relation: 'interpretive' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཕྱིན་ཅི་ལོག',
      pronunciation: 'phyin ci log (Wylie); chin-ji-lok (Lhasa)',
      relation: 'semantic',
    },
    { language: 'ko', script: 'Hang', text: '원리전도몽상', pronunciation: 'wonri jeondo mongsang', relation: 'interpretive' },
    { language: 'vi', script: 'Latn', text: 'viễn ly điên đảo mộng tưởng', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'confusion', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'delusion,', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('940', 'viparyāsa'),
    ddbCitation('顛倒夢想', '"Inverted, dream-like illusions." Refers to the four cognitive distortions that cause suffering. Chinese interpolation of "dream-thoughts" influenced East Asian poetics.'),
  ],
  contested: true,
};

const conceptNirvana: ConceptNode = {
  id: 'concept.nirvana-extinguishing',
  preferredLabel: 'nirvāṇa / ultimate nirvāṇa (niṣṭhānirvāṇa)',
  preferredLanguage: 'en',
  definition:
    'The "blowing out" of greed, anger, delusion. Heart Sutra\'s *niṣṭhānirvāṇa* (ultimate nirvāṇa) is specifically *apratiṣṭhita-nirvāṇa* — non-abiding nirvāṇa transcending both saṃsāra and the static peace of the arhat\'s cessation. The bodhisattva remains engaged out of compassion.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'nirvāṇa', pronunciation: 'near-VAH-nah', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'niṣṭhānirvāṇaḥ', relation: 'semantic', note: '"Ultimate" / "completed" nirvāṇa — Heart Sutra surface form.' },
    { language: 'sa', script: 'Deva', text: 'निर्वाण', relation: 'semantic' },
    { language: 'pi', script: 'Latn', text: 'nibbāna', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '究竟涅槃',
      pronunciation: 'jiūjìng nièpán',
      relation: 'transliteration',
      note: '究竟 = ultimate (semantic); 涅槃 = phonetic loan of nirvāṇa.',
    },
    { language: 'ja', script: 'Jpan', text: '究竟涅槃', pronunciation: 'kukyō nehan', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'མྱ་ངན་ལས་འདས་པ',
      pronunciation: 'mya ngan las \'das pa (Wylie); nya-ngen-le de-pa (Lhasa)',
      relation: 'calque',
      note: '"Gone beyond sorrow." Calques the soteriological meaning rather than phonetic.',
    },
    { language: 'ko', script: 'Hang', text: '구경열반', pronunciation: 'gugyeong yeolban', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'cứu cánh niết bàn', relation: 'transliteration' },
    { language: 'en', script: 'Latn', text: 'nirvana.', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('35858', 'nirvāṇa'),
    ddbCitation('究竟涅槃', '"Ultimate blowing out." The complete extinguishing of afflictions and the karmic cycle, conceptualized in Mahāyāna as a non-abiding (apratiṣṭhita) state.'),
  ],
  relatedConcepts: ['concept.crossing-other-shore'],
  notes: '*Niṣṭhānirvāṇa* is Mahāyāna\'s reframe of the arhat\'s cessation: dynamic, engaged, transcending both saṃsāra and quietist peace.',
};

// ─────────────────────────────────────────────────────────────────────────
// Endgame cluster: tryadhva · samyaksambodhi · mantra/vidyā · dharani · the Work itself
// ─────────────────────────────────────────────────────────────────────────

const conceptThreeTimes: ConceptNode = {
  id: 'concept.three-times-tryadhva',
  preferredLabel: 'three times / unsurpassed perfect awakening (tryadhva / anuttarā samyaksaṃbodhi)',
  preferredLanguage: 'en',
  definition:
    '*Tryadhva* = past, present, future. *Anuttarā samyaksaṃbodhi* = "unsurpassed complete perfect awakening" — the ultimate state of buddhahood. Heart Sutra: Buddhas of all three times rely on *prajñāpāramitā* to attain this, democratizing awakening as a timeless cosmic truth.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'tryadhva', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'anuttarā samyaksaṃbodhi', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '三世', pronunciation: 'sānshì', relation: 'semantic', note: 'three times' },
    {
      language: 'zh',
      script: 'Hant',
      text: '阿耨多羅三藐三菩提',
      pronunciation: 'ānòuduōluó sānmiǎo sānpútí',
      relation: 'transliteration',
      note: 'One of the longest continuous phonetic loans in the Chinese canon. Translators preserved the sonic weight of Sanskrit because the concept was too sacred for semantic mapping.',
    },
    { language: 'ja', script: 'Jpan', text: '阿耨多羅三藐三菩提', pronunciation: 'anokutara sanmyaku sanbodai', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'བླ་ན་མེད་པ་ཡང་དག་པར་རྫོགས་པའི་བྱང་ཆུབ',
      pronunciation: 'bla na med pa yang dag par rdzogs pa\'i byang chub (Wylie)',
      relation: 'calque',
    },
    { language: 'ko', script: 'Hang', text: '아뇩다라삼먁삼보리', pronunciation: 'anyokdara sammyak sambori', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'a-nậu-đa-la tam-miệu tam-bồ-đề', relation: 'transliteration' },
    { language: 'en', script: 'Latn', text: 'enlightenment.', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('37099', 'tryadhva'),
    ddbCitation('三世 / 阿耨多羅三藐三菩提', '"Three periods" (past, present, future) and "Unsurpassed perfect complete awakening." Heart Sutra establishes prajñāpāramitā as the universal mechanism for all Buddhas to attain Buddhahood.'),
  ],
};

const conceptMantraVidya: ConceptNode = {
  id: 'concept.mantra-vidya',
  preferredLabel: 'mantra / spell (mantra · vidyā)',
  preferredLanguage: 'en',
  definition:
    'At the sutra\'s climax, *prajñāpāramitā* transitions from philosophical realization to active *mantra* (instrument of thought/protection) and *vidyā* (sacred efficacious knowledge). Chinese renders vidyā as 明 (brightness) — knowledge that dispels darkness.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'mantra', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'vidyā', relation: 'semantic' },
    { language: 'sa', script: 'Latn', text: 'mahāmantra', relation: 'semantic', note: '"great mantra"' },
    { language: 'sa', script: 'Latn', text: 'mahāvidyā', relation: 'semantic', note: '"great spell/knowledge"' },
    { language: 'zh', script: 'Hant', text: '咒', pronunciation: 'zhòu', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '明', pronunciation: 'míng', relation: 'semantic', note: 'For vidyā — "brightness" → spiritual knowledge.' },
    { language: 'zh', script: 'Hant', text: '大神咒', pronunciation: 'dà shén zhòu', relation: 'semantic', note: '"great divine spell" — mahāmantra.' },
    { language: 'zh', script: 'Hant', text: '大明咒', pronunciation: 'dà míng zhòu', relation: 'semantic', note: '"great bright spell" — mahāvidyā.' },
    { language: 'ja', script: 'Jpan', text: '呪 / 明', pronunciation: 'shu / myō', relation: 'semantic' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'སྔགས',
      pronunciation: 'sngags (Wylie); ngak (Lhasa)',
      relation: 'semantic',
    },
    { language: 'bo', script: 'Tibt', text: 'རིག་པ', pronunciation: 'rig pa (Wylie); rik-pa (Lhasa)', relation: 'semantic', note: 'For vidyā.' },
    { language: 'ko', script: 'Hang', text: '주 / 명', pronunciation: 'ju / myeong', relation: 'semantic' },
    { language: 'vi', script: 'Latn', text: 'chú / minh', relation: 'semantic' },
    { language: 'en', script: 'Latn', text: 'spell,', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
    { language: 'en', script: 'Latn', text: 'knowledge,', witness: 'MAPLE chant sheet (after Sheng-yen)', relation: 'interpretive' },
  ],
  citations: [
    eightyFourThousandCitation('36489', 'mantra'),
    ddbCitation('咒 / 大神咒 / 明 / 大明咒', '"Incantation" and "Knowledge." Praising the perfection of wisdom as a protective, magical sonic formula.'),
  ],
  contested: true,
  notes: 'Sutra\'s Tantric turn: uttering the truth of emptiness has direct soteriological efficacy.',
};

const conceptDharaniSyllables: ConceptNode = {
  id: 'concept.dharani-gate',
  preferredLabel: 'gate pāragate pārasaṃgate bodhi svāhā (dharani)',
  preferredLanguage: 'sa',
  definition:
    'The closing dhāraṇī. Sanskrit grammarians can parse it semantically ("gone, gone beyond, completely gone beyond, awakening, hail") but East Asian and Tibetan traditions treat it as a sonic vehicle — Chinese characters (揭諦 etc.) chosen for Tang-era pronunciation, NOT meaning.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'gate gate pāragate pārasaṃgate bodhi svāhā', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'गते गते पारगते पारसंगते बोधि स्वाहा', relation: 'semantic' },
    {
      language: 'zh',
      script: 'Hant',
      text: '揭諦揭諦 波羅揭諦 波羅僧揭諦 菩提薩婆訶',
      pronunciation: 'jiēdì jiēdì bōluójiēdì bōluósēngjiēdì pútí sàpóhē (Mandarin) / Middle Chinese *kjat-tej',
      relation: 'transliteration',
      note: 'Pure phonetic loan. Characters\' dictionary meanings ("to uncover," "truth") are IRRELEVANT.',
    },
    {
      language: 'ja',
      script: 'Jpan',
      text: '羯諦羯諦 波羅羯諦 波羅僧羯諦 菩提薩婆訶',
      pronunciation: 'gyatei gyatei haragyatei harasōgyatei boji sowaka',
      relation: 'transliteration',
      note: 'MAPLE chant practice: longer chant uses this Sino-Japanese form, "Gya tē gya tē ha ra gya tē / Hara sō gya tē bo ji sowa ka."',
    },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ག་ཏེ་ག་ཏེ་པཱ་ར་ག་ཏེ་པཱ་ར་སཾ་ག་ཏེ་བོ་དྷི་སྭཱ་ཧཱ',
      pronunciation: 'ga te ga te pA ra ga te pA ra saM ga te bo dhi swA hA',
      relation: 'transliteration',
    },
    { language: 'ko', script: 'Hang', text: '아제아제 바라아제 바라승아제 모지 사바하', pronunciation: 'aje aje bara-aje baraseung-aje moji sabaha', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'yết đế yết đế ba la yết đế ba la tăng yết đế bồ đề tát bà ha', relation: 'transliteration' },
  ],
  citations: [
    eightyFourThousandCitation(null, 'gate pāragate (dhāraṇī)', 'Not in 84000 — purely phonetic dharani formulae rarely receive distinct semantic glossary slugs.'),
    ddbCitation('揭諦 揭諦 波羅揭諦 波羅僧揭諦 菩提 薩婆訶', 'The concluding mantra.'),
  ],
  contested: true,
  notes: 'Dhāraṇīs are sonic vehicles where meaning is secondary or intentionally obscured. Power lies in phonetic reverberation, believed to enact realization directly without conceptual mediation.',
};

const conceptHeartSutraWork: ConceptNode = {
  id: 'concept.heart-sutra-work',
  preferredLabel: 'Heart Sutra (Prajñāpāramitā Hṛdaya Sūtra)',
  preferredLanguage: 'en',
  definition:
    'The Work itself. Two main recensions: the "Short" text (Xuanzang T251, Kumārajīva T250) — diving immediately into Avalokiteśvara\'s realization. The "Long" text (Tibetan Kangyur, Conze\'s Sanskrit) — with the "Thus have I heard" frame, Buddha at Vulture Peak, and closing endorsement. Jan Nattier\'s controversial hypothesis: the "Sanskrit" Short text was compiled in China from Kumārajīva\'s translation and back-translated to Sanskrit.',
  attestations: [
    { language: 'sa', script: 'Latn', text: 'Prajñāpāramitā Hṛdaya Sūtra', relation: 'semantic' },
    { language: 'sa', script: 'Deva', text: 'प्रज्ञापारमिताहृदयसूत्र', relation: 'semantic' },
    { language: 'zh', script: 'Hant', text: '般若波羅蜜多心經', pronunciation: 'Bōrě bōluómìduō xīnjīng', relation: 'transliteration', note: 'Hybrid: phonetic 般若波羅蜜多 + semantic 心 ("heart") + semantic 經 ("scripture").' },
    { language: 'ja', script: 'Jpan', text: '般若波羅蜜多心経', pronunciation: 'Hannya haramitsu ta shingyō', relation: 'transliteration' },
    {
      language: 'bo',
      script: 'Tibt',
      text: 'ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྙིང་པོ',
      pronunciation: 'shes rab kyi pha rol tu phyin pa\'i snying po (Wylie)',
      relation: 'calque',
    },
    { language: 'ko', script: 'Hang', text: '반야바라밀다심경', pronunciation: 'Banya baramilda simgyeong', relation: 'transliteration' },
    { language: 'vi', script: 'Latn', text: 'Bát-nhã-ba-la-mật-đa tâm kinh', relation: 'transliteration' },
  ],
  citations: [
    eightyFourThousandCitation(null, 'Heart Sutra (work)', 'Not in 84000 glossary as a macro-level work; individual concepts within it are catalogued.'),
    ddbCitation('般若波羅蜜多心經', 'The "Heart of the Perfection of Wisdom Sutra."'),
  ],
  contested: true,
  notes: 'Nattier hypothesis (Nattier 1992): Sanskrit Short text is back-translation from Kumārajīva\'s Chinese, accounting for Chinese idiomatic quirks in the Sanskrit (na jñānaṃ na prāptiḥ ↔ 無智亦無得).',
};

// ─────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────

export const HEART_SUTRA_CONCEPTS: ConceptRegistry = {
  [conceptWisdomPrajna.id]: conceptWisdomPrajna,
  [conceptPerfectionParamita.id]: conceptPerfectionParamita,
  [conceptPracticeCarya.id]: conceptPracticeCarya,
  [conceptDeepGambhira.id]: conceptDeepGambhira,
  [conceptAvalokitesvara.id]: conceptAvalokitesvara,
  [conceptBodhisattva.id]: conceptBodhisattva,
  [conceptSkandha.id]: conceptSkandha,
  [conceptFormRupa.id]: conceptFormRupa,
  [conceptSvabhava.id]: conceptSvabhava,
  [conceptSunyata.id]: conceptSunyata,
  [conceptSeeingVyavalokita.id]: conceptSeeingVyavalokita,
  [conceptSufferingDuhkha.id]: conceptSufferingDuhkha,
  [conceptSariputra.id]: conceptSariputra,
  [conceptDharma.id]: conceptDharma,
  [conceptUnarisenAnutpada.id]: conceptUnarisenAnutpada,
  [conceptSenseFaculties.id]: conceptSenseFaculties,
  [conceptRealmDhatu.id]: conceptRealmDhatu,
  [conceptIgnoranceAvidya.id]: conceptIgnoranceAvidya,
  [conceptAgingDeath.id]: conceptAgingDeath,
  [conceptFourTruths.id]: conceptFourTruths,
  [conceptKnowledgeJnana.id]: conceptKnowledgeJnana,
  [conceptAttainmentPrapti.id]: conceptAttainmentPrapti,
  [conceptObstructionAvarana.id]: conceptObstructionAvarana,
  [conceptFearlessAtrasta.id]: conceptFearlessAtrasta,
  [conceptInvertedView.id]: conceptInvertedView,
  [conceptNirvana.id]: conceptNirvana,
  [conceptThreeTimes.id]: conceptThreeTimes,
  [conceptMantraVidya.id]: conceptMantraVidya,
  [conceptDharaniSyllables.id]: conceptDharaniSyllables,
  [conceptHeartSutraWork.id]: conceptHeartSutraWork,
};
