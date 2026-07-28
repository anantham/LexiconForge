/**
 * भगवद्गीता २.५०–२.७२ — the sthitaprajña passage (Bhagavad Gītā, adhyāya 2,
 * "साङ्ख्ययोगः"): Arjuna asks what marks the one whose wisdom stands firm;
 * Krishna's answer closes the chapter.
 *
 * MŪLA SOURCE (the Sanskrit text is transcribed, never remembered):
 *   https://sa.wikisource.org/wiki/भगवद्गीता/साङ्ख्ययोगः — PUBLIC DOMAIN.
 *   Retrieved 2026-07-28 via the MediaWiki API; the verbatim lines live in
 *   ./bg2-source.ts (GENERATED — extracted mechanically from the fetched
 *   wikitext), and tests/components/gita/gita-surface.test.ts asserts every
 *   segment below reconstructs those lines exactly.
 *
 * Design decisions embodied here (mirroring data/malayalam/urakam-*.ts):
 *  - ONE SEGMENT PER WRITTEN HALF-VERSE (ardha-śloka) — the line as the
 *    source prints it, ending in । or the ॥२- NN॥ marker. The half-verse is
 *    the anuṣṭubh's breath-and-syntax unit: a whole śloka plus its English
 *    witness overcrowds one interlinear row, a single pāda fragments the
 *    sentence mid-thought. Speaker lines (अर्जुन उवाच…) are their own small
 *    segments, as the source sets them.
 *  - SURFACE LAW (SUTTA-025): tokens are the written words of the source
 *    line, spaces and daṇḍas included. Sandhi-fused words (तस्माद्योगाय)
 *    are NOT split into fake sub-tokens — the fused surface stays one word
 *    and the padaccheda lives in the sound layer: each akshara binds to the
 *    morpheme(s) its sound overlaps, and the tooltip/note teaches the
 *    underlying cut. Enforced by the builder + the surface test.
 *  - SELF-VALIDATION: per-akshara sounds render only because romanizing the
 *    Devanāgarī reproduces the curated IAST (devanagari.ts) — zero words in
 *    this file currently need the explicit IAST fallback.
 *  - The padaccheda follows the mainstream (Śaṅkara-bhāṣya / Gita Press)
 *    analysis; genuinely contestable glosses carry the alternative in a
 *    comment rather than silently choosing.
 *  - English witness lines: OUR OWN plain prose draft (by: 'fable-draft'),
 *    labeled in the reader as an unreviewed AI draft shown for parallel
 *    reading, not authority. Glosses likewise — drafted by Fable (2026),
 *    Sanskrit review pending.
 */

import type { AlignSegment } from '../../types/liturgyAlign';
import { gitaSegment } from './builder';
export { BUILD_DIAGNOSTICS, IAST_FALLBACKS } from './builder';

const DANDA = { p: '।', g: 'daṇḍa — the half-verse ends' };
const mark = (n: number, deva: string) => ({ p: `॥२- ${deva}॥`, g: `verse 2.${n} ends` });

export const GITA_STHITAPRAJNA: AlignSegment[] = [
  // ── TITLE (editorial): स्थितप्रज्ञः — the passage's own word (2.54, 2.55),
  //    set as a title the way the Heart Sutra / Urakam readers open. Not part
  //    of the mūla; excluded from the surface test's source matching.
  gitaSegment({
    id: 'bg2-title',
    title: true,
    tokens: [
      {
        d: 'स्थितप्रज्ञः', i: 'sthitaprajñaḥ',
        m: [
          { i: 'sthita', g: 'standing firm, steady', u: 'ut-sthita' },
          { i: 'prajñaḥ', g: 'wisdom, discernment', u: 'ut-prajna' },
        ],
        note: 'The name the passage gives its own subject: sthita-prajña, "one whose wisdom stands".',
      },
    ],
    en: 'The one of steady{ut-sthita} wisdom{ut-prajna}',
  }),

  // ── 2.50 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-50a',
    tokens: [
      {
        d: 'बुद्धियुक्तो', i: 'buddhiyukto',
        m: [
          { i: 'buddhi', g: 'understanding — the discerning mind', u: 'u-buddhi' },
          { i: 'yukto', g: 'yoked to, joined with', u: 'u-yukta' },
        ],
        note: 'buddhiyuktaḥ before sandhi — final -aḥ becomes -o before the voiced j-.',
      },
      {
        d: 'जहातीह', i: 'jahātīha',
        m: [
          { i: 'jahāt', g: 'casts off, leaves behind', u: 'u-jahati' },
          { i: 'īha', g: 'here — in this very life', u: 'u-iha' },
        ],
        note: 'jahāti + iha — the two i-sounds fuse into one long ī shared by both words.',
      },
      { d: 'उभे', i: 'ubhe', g: 'both', u: 'u-ubhe' },
      {
        d: 'सुकृतदुष्कृते', i: 'sukṛtaduṣkṛte',
        m: [
          { i: 'sukṛta', g: 'what is well done', u: 'u-sukrta' },
          { i: 'duṣkṛte', g: 'what is ill done', u: 'u-duskrta' },
        ],
        note: 'A dual pair: the good-deed and the bad-deed, held together in one compound.',
      },
      DANDA,
    ],
    en: 'Yoked{u-yukta} [to understanding,]{u-buddhi} one [casts off]{u-jahati} here{u-iha} both{u-ubhe} [well-done]{u-sukrta} [and ill-done deeds.]{u-duskrta}',
  }),
  gitaSegment({
    id: 'bg2-50b',
    tokens: [
      {
        d: 'तस्माद्योगाय', i: 'tasmādyogāya',
        m: [
          { i: 'tasmād', g: 'therefore', u: 'u-tasmat' },
          { i: 'yogāya', g: 'for yoga — for this discipline', u: 'u-yogaya' },
        ],
        note: 'tasmāt + yogāya — the final t voices to d as the words fuse.',
      },
      { d: 'युज्यस्व', i: 'yujyasva', g: 'yoke yourself — the Gītā’s own verb for yoga', u: 'u-yujyasva' },
      { d: 'योगः', i: 'yogaḥ', g: 'yoga', u: 'u-yoga' },
      { d: 'कर्मसु', i: 'karmasu', g: 'in actions', u: 'u-karmasu' },
      { d: 'कौशलम्', i: 'kauśalam', g: 'skill', u: 'u-kausalam' },
      mark(50, '५०'),
    ],
    en: 'Therefore{u-tasmat} [yoke yourself]{u-yujyasva} [to yoga:]{u-yogaya} yoga{u-yoga} is skill{u-kausalam} [in action.]{u-karmasu}',
  }),

  // ── 2.51 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-51a',
    tokens: [
      {
        d: 'कर्मजं', i: 'karmajaṃ',
        m: [
          { i: 'karma', g: 'action', u: 'u-karma' },
          { i: 'jaṃ', g: 'born of', u: 'u-ja' },
        ],
      },
      {
        d: 'बुद्धियुक्ता', i: 'buddhiyuktā',
        m: [
          { i: 'buddhi', g: 'understanding — the discerning mind', u: 'u-buddhi' },
          { i: 'yuktā', g: 'yoked to, joined with', u: 'u-yukta' },
        ],
        note: 'buddhiyuktāḥ, plural — the visarga drops before the following h-.',
      },
      { d: 'हि', i: 'hi', g: 'for, indeed', u: 'u-hi' },
      { d: 'फलं', i: 'phalaṃ', g: 'the fruit', u: 'u-phala' },
      { d: 'त्यक्त्वा', i: 'tyaktvā', g: 'having relinquished', u: 'u-tyaktva' },
      { d: 'मनीषिणः', i: 'manīṣiṇaḥ', g: 'the wise', u: 'u-manisin' },
      DANDA,
    ],
    en: 'For{u-hi} [the wise,]{u-manisin} yoked{u-yukta} [to understanding,]{u-buddhi} relinquish{u-tyaktva} [the fruit]{u-phala} born{u-ja} [of action;]{u-karma}',
  }),
  gitaSegment({
    id: 'bg2-51b',
    tokens: [
      {
        d: 'जन्मबन्धविनिर्मुक्ताः', i: 'janmabandhavinirmuktāḥ',
        m: [
          { i: 'janma', g: 'birth', u: 'u-janma' },
          { i: 'bandha', g: 'the bond, the tie', u: 'u-bandha' },
          { i: 'vinirmuktāḥ', g: 'fully released from', u: 'u-vinirmukta' },
        ],
      },
      { d: 'पदं', i: 'padaṃ', g: 'the state, the abode', u: 'u-pada' },
      {
        d: 'गच्छन्त्यनामयम्', i: 'gacchantyanāmayam',
        m: [
          { i: 'gacchanty', g: 'they go to', u: 'u-gacchanti' },
          { i: 'anāmayam', g: 'beyond affliction — where nothing ails', u: 'u-anamaya' },
        ],
        note: 'gacchanti + anāmayam — the final i glides into y before the vowel.',
      },
      mark(51, '५१'),
    ],
    en: 'released{u-vinirmukta} [from the bond]{u-bandha} [of birth,]{u-janma} [they reach]{u-gacchanti} [the state]{u-pada} [beyond affliction.]{u-anamaya}',
  }),

  // ── 2.52 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-52a',
    tokens: [
      { d: 'यदा', i: 'yadā', g: 'when', u: 'u-yada' },
      { d: 'ते', i: 'te', g: 'your', u: 'u-te' },
      {
        d: 'मोहकलिलं', i: 'mohakalilaṃ',
        m: [
          { i: 'moha', g: 'delusion', u: 'u-moha' },
          { i: 'kalilaṃ', g: 'the thicket, the tangle', u: 'u-kalila' },
        ],
      },
      {
        d: 'बुद्धिर्व्यतितरिष्यति', i: 'buddhirvyatitariṣyati',
        m: [
          { i: 'buddhir', g: 'understanding', u: 'u-buddhi' },
          { i: 'vyatitariṣyati', g: 'will cross beyond', u: 'u-vyatitarisyati' },
        ],
        note: 'buddhiḥ + vyatitariṣyati — the visarga becomes r before the voiced v-.',
      },
      DANDA,
    ],
    en: 'When{u-yada} your{u-te} understanding{u-buddhi} [crosses beyond]{u-vyatitarisyati} [the thicket]{u-kalila} [of delusion,]{u-moha}',
  }),
  gitaSegment({
    id: 'bg2-52b',
    tokens: [
      { d: 'तदा', i: 'tadā', g: 'then', u: 'u-tada' },
      { d: 'गन्तासि', i: 'gantāsi', g: 'you will come to', u: 'u-gantasi' },
      // nirveda: not despair — the quiet loss of appetite for more hearing.
      { d: 'निर्वेदं', i: 'nirvedaṃ', g: 'disenchantment — a quiet turning away', u: 'u-nirveda' },
      { d: 'श्रोतव्यस्य', i: 'śrotavyasya', g: 'what is yet to be heard', u: 'u-srotavya' },
      { d: 'श्रुतस्य', i: 'śrutasya', g: 'what has been heard', u: 'u-sruta' },
      { d: 'च', i: 'ca', g: 'and', u: 'u-ca' },
      mark(52, '५२'),
    ],
    en: 'then{u-tada} [you will come to]{u-gantasi} disenchantment{u-nirveda} with [what has been heard]{u-sruta} and{u-ca} [what is yet to be heard.]{u-srotavya}',
  }),

  // ── 2.53 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-53a',
    tokens: [
      {
        d: 'श्रुतिविप्रतिपन्ना', i: 'śrutivipratipannā',
        m: [
          { i: 'śruti', g: 'scripture — all that is heard', u: 'u-sruti' },
          // Śaṅkara: bewildered/distracted by the many voices of śruti;
          // others read "no longer moved by śruti". We keep the first.
          { i: 'vipratipannā', g: 'tossed about, pulled many ways by', u: 'u-vipratipanna' },
        ],
      },
      { d: 'ते', i: 'te', g: 'your', u: 'u-te' },
      { d: 'यदा', i: 'yadā', g: 'when', u: 'u-yada' },
      { d: 'स्थास्यति', i: 'sthāsyati', g: 'will stand', u: 'u-sthasyati' },
      { d: 'निश्चला', i: 'niścalā', g: 'unmoving', u: 'u-niscala' },
      DANDA,
    ],
    en: 'When{u-yada} your{u-te} understanding, [tossed about]{u-vipratipanna} [by scripture,]{u-sruti} stands{u-sthasyati} unmoving,{u-niscala}',
  }),
  gitaSegment({
    id: 'bg2-53b',
    tokens: [
      {
        d: 'समाधावचला', i: 'samādhāvacalā',
        m: [
          { i: 'samādhāv', g: 'in samādhi — deep absorption', u: 'u-samadhi' },
          { i: 'acalā', g: 'steady, unshaken', u: 'u-acala' },
        ],
        note: 'samādhau + acalā — the final au opens to āv before the vowel.',
      },
      {
        d: 'बुद्धिस्तदा', i: 'buddhistadā',
        m: [
          { i: 'buddhis', g: 'understanding', u: 'u-buddhi' },
          { i: 'tadā', g: 'then', u: 'u-tada' },
        ],
        note: 'buddhiḥ + tadā — the visarga becomes s before t.',
      },
      {
        d: 'योगमवाप्स्यसि', i: 'yogamavāpsyasi',
        m: [
          { i: 'yogam', g: 'yoga', u: 'u-yoga' },
          { i: 'avāpsyasi', g: 'you will attain', u: 'u-avapsyasi' },
        ],
      },
      mark(53, '५३'),
    ],
    en: 'your understanding{u-buddhi} steady{u-acala} [in deep absorption]{u-samadhi} — then{u-tada} [you will attain]{u-avapsyasi} yoga.{u-yoga}',
  }),

  // ── अर्जुन उवाच ───────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-54s',
    tokens: [
      { d: 'अर्जुन', i: 'arjuna', g: 'Arjuna — the questioner', u: 'u-arjuna' },
      { d: 'उवाच', i: 'uvāca', g: 'said', u: 'u-uvaca' },
    ],
    en: 'Arjuna{u-arjuna} said:{u-uvaca}',
  }),

  // ── 2.54 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-54a',
    tokens: [
      {
        d: 'स्थितप्रज्ञस्य', i: 'sthitaprajñasya',
        m: [
          { i: 'sthita', g: 'standing firm, steady', u: 'u-sthita' },
          { i: 'prajñasya', g: 'wisdom — of one whose wisdom', u: 'u-prajna' },
        ],
      },
      { d: 'का', i: 'kā', g: 'what?', u: 'u-ka' },
      // bhāṣā: "description" (Śaṅkara: how is he spoken of?) — not "language".
      { d: 'भाषा', i: 'bhāṣā', g: 'the description — the marks by which he is known', u: 'u-bhasa' },
      {
        d: 'समाधिस्थस्य', i: 'samādhisthasya',
        m: [
          { i: 'samādhi', g: 'deep absorption', u: 'u-samadhi' },
          { i: 'sthasya', g: 'abiding in', u: 'u-stha' },
        ],
      },
      { d: 'केशव', i: 'keśava', g: 'O Keśava — Krishna', u: 'u-kesava' },
      DANDA,
    ],
    en: 'What{u-ka} [is the mark]{u-bhasa} [of one whose wisdom]{u-prajna} [stands firm,]{u-sthita} abiding{u-stha} [in absorption,]{u-samadhi} O Keshava?{u-kesava}',
  }),
  gitaSegment({
    id: 'bg2-54b',
    tokens: [
      {
        d: 'स्थितधीः', i: 'sthitadhīḥ',
        m: [
          { i: 'sthita', g: 'steady', u: 'u-sthita' },
          { i: 'dhīḥ', g: 'insight, thought', u: 'u-dhi' },
        ],
      },
      { d: 'किं', i: 'kiṃ', g: 'how? in what way?', u: 'u-kim1' },
      { d: 'प्रभाषेत', i: 'prabhāṣeta', g: 'would he speak', u: 'u-prabhaseta' },
      {
        d: 'किमासीत', i: 'kimāsīta',
        m: [
          { i: 'kim', g: 'how? in what way?', u: 'u-kim2' },
          { i: 'āsīta', g: 'would he sit', u: 'u-asita' },
        ],
      },
      { d: 'व्रजेत', i: 'vrajeta', g: 'would he walk', u: 'u-vrajeta' },
      { d: 'किम्', i: 'kim', g: 'how? in what way?', u: 'u-kim3' },
      mark(54, '५४'),
    ],
    en: 'How{u-kim1} would one of steady{u-sthita} insight{u-dhi} speak?{u-prabhaseta} How{u-kim2} [would he sit?]{u-asita} How{u-kim3} [would he walk?]{u-vrajeta}',
  }),

  // ── श्रीभगवानुवाच ─────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-55s',
    tokens: [
      {
        d: 'श्रीभगवानुवाच', i: 'śrībhagavānuvāca',
        m: [
          { i: 'śrī', g: 'the blessed, the radiant', u: 'u-sri' },
          { i: 'bhagavān', g: 'the Lord', u: 'u-bhagavan' },
          { i: 'uvāca', g: 'said', u: 'u-uvaca' },
        ],
      },
    ],
    en: '[The Blessed]{u-sri} Lord{u-bhagavan} said:{u-uvaca}',
  }),

  // ── 2.55 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-55a',
    tokens: [
      { d: 'प्रजहाति', i: 'prajahāti', g: 'lets go entirely', u: 'u-prajahati' },
      { d: 'यदा', i: 'yadā', g: 'when', u: 'u-yada' },
      {
        d: 'कामान्सर्वान्पार्थ', i: 'kāmānsarvānpārtha',
        m: [
          { i: 'kāmān', g: 'desires', u: 'u-kaman' },
          { i: 'sarvān', g: 'all', u: 'u-sarvan' },
          { i: 'pārtha', g: 'O Pārtha — son of Pṛthā (Kuntī): Arjuna', u: 'u-partha' },
        ],
      },
      {
        d: 'मनोगतान्', i: 'manogatān',
        m: [
          { i: 'mano', g: 'the mind', u: 'u-manas' },
          { i: 'gatān', g: 'dwelling in — gone into', u: 'u-gata' },
        ],
      },
      DANDA,
    ],
    en: 'When{u-yada} a man [lets go]{u-prajahati} [of all]{u-sarvan} [the desires]{u-kaman} [that dwell]{u-gata} [in the mind,]{u-manas} [O Pārtha,]{u-partha}',
  }),
  gitaSegment({
    id: 'bg2-55b',
    tokens: [
      {
        d: 'आत्मन्येवात्मना', i: 'ātmanyevātmanā',
        m: [
          { i: 'ātmany', g: 'in the self', u: 'u-atmani' },
          { i: 'ev', g: 'alone — nothing else needed', u: 'u-eva' },
          { i: 'ātmanā', g: 'by the self', u: 'u-atmana' },
        ],
        note: 'ātmani + eva + ātmanā — three words welded: i→y before e, and eva’s a merges into ātmanā’s ā.',
      },
      { d: 'तुष्टः', i: 'tuṣṭaḥ', g: 'content, satisfied', u: 'u-tusta' },
      {
        d: 'स्थितप्रज्ञस्तदोच्यते', i: 'sthitaprajñastadocyate',
        m: [
          { i: 'sthita', g: 'standing firm', u: 'u-sthita' },
          { i: 'prajñas', g: 'wisdom', u: 'u-prajna' },
          { i: 'tad', g: 'then', u: 'u-tada' },
          { i: 'ocyate', g: 'he is called', u: 'u-ucyate' },
        ],
        note: 'sthitaprajñaḥ + tadā + ucyate — the ā and u fuse into o, shared across the seam.',
      },
      mark(55, '५५'),
    ],
    en: 'content{u-tusta} [in the self]{u-atmani} [by the self]{u-atmana} alone,{u-eva} then{u-tada} [he is called]{u-ucyate} [a man whose wisdom]{u-prajna} [stands firm.]{u-sthita}',
  }),

  // ── 2.56 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-56a',
    tokens: [
      {
        d: 'दुःखेष्वनुद्विग्नमनाः', i: 'duḥkheṣvanudvignamanāḥ',
        m: [
          { i: 'duḥkheṣv', g: 'in sorrows', u: 'u-duhkhesu' },
          { i: 'anudvigna', g: 'untroubled, unshaken', u: 'u-anudvigna' },
          { i: 'manāḥ', g: 'mind', u: 'u-manas' },
        ],
        note: 'duḥkheṣu + anudvigna-manāḥ — the u glides into v before the vowel.',
      },
      { d: 'सुखेषु', i: 'sukheṣu', g: 'in pleasures', u: 'u-sukhesu' },
      {
        d: 'विगतस्पृहः', i: 'vigataspṛhaḥ',
        m: [
          { i: 'vigata', g: 'gone, departed', u: 'u-vigata' },
          { i: 'spṛhaḥ', g: 'craving, hankering', u: 'u-sprha' },
        ],
      },
      DANDA,
    ],
    en: 'His mind{u-manas} untroubled{u-anudvigna} [in sorrows,]{u-duhkhesu} craving{u-sprha} gone{u-vigata} [from pleasures,]{u-sukhesu}',
  }),
  gitaSegment({
    id: 'bg2-56b',
    tokens: [
      {
        d: 'वीतरागभयक्रोधः', i: 'vītarāgabhayakrodhaḥ',
        m: [
          { i: 'vīta', g: 'fallen away, departed', u: 'u-vita' },
          { i: 'rāga', g: 'passion', u: 'u-raga' },
          { i: 'bhaya', g: 'fear', u: 'u-bhaya' },
          { i: 'krodhaḥ', g: 'anger', u: 'u-krodha' },
        ],
      },
      {
        d: 'स्थितधीर्मुनिरुच्यते', i: 'sthitadhīrmunirucyate',
        m: [
          { i: 'sthita', g: 'steady', u: 'u-sthita' },
          { i: 'dhīr', g: 'insight, thought', u: 'u-dhi' },
          { i: 'munir', g: 'a sage — the silent one', u: 'u-muni' },
          { i: 'ucyate', g: 'is called', u: 'u-ucyate' },
        ],
        note: 'sthitadhīḥ + muniḥ + ucyate — both visargas become r before voiced sounds.',
      },
      mark(56, '५६'),
    ],
    en: 'passion,{u-raga} fear,{u-bhaya} [and anger]{u-krodha} [fallen away]{u-vita} — [he is called]{u-ucyate} [a sage]{u-muni} [of steady]{u-sthita} insight.{u-dhi}',
  }),

  // ── 2.57 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-57a',
    tokens: [
      { d: 'यः', i: 'yaḥ', g: 'who', u: 'u-yah' },
      {
        d: 'सर्वत्रानभिस्नेहस्तत्तत्प्राप्य', i: 'sarvatrānabhisnehastattatprāpya',
        m: [
          { i: 'sarvatrā', g: 'everywhere, in every direction', u: 'u-sarvatra' },
          { i: 'nabhisnehas', g: 'without clinging — no thread of attachment', u: 'u-anabhisneha' },
          { i: 'tat', g: 'this or that — each thing as it comes', u: 'u-tattat' },
          { i: 'tat', g: 'this or that — each thing as it comes', u: 'u-tattat' },
          { i: 'prāpya', g: 'meeting, coming upon', u: 'u-prapya' },
        ],
        note: 'sarvatra + anabhisnehaḥ + tat + tat + prāpya — five words in one written run; anabhisneha’s initial a- lives inside the shared ā.',
      },
      {
        d: 'शुभाशुभम्', i: 'śubhāśubham',
        m: [
          { i: 'śubhā', g: 'pleasant, fair', u: 'u-subha' },
          { i: 'śubham', g: 'unpleasant — aśubha, its initial a- merged into the ā', u: 'u-asubha' },
        ],
        note: 'śubha + aśubham — one ā carries the end of the first word and the start of the second.',
      },
      DANDA,
    ],
    en: '[He who,]{u-yah} [without clinging]{u-anabhisneha} anywhere,{u-sarvatra} meets{u-prapya} [each thing]{u-tattat} pleasant{u-subha} [or unpleasant]{u-asubha}',
  }),
  gitaSegment({
    id: 'bg2-57b',
    tokens: [
      {
        d: 'नाभिनन्दति', i: 'nābhinandati',
        m: [
          { i: 'n', g: 'not', u: 'u-na1' },
          { i: 'ābhinandati', g: 'welcomes, delights in', u: 'u-abhinandati' },
        ],
        note: 'na + abhinandati — the two a-sounds fuse into ā.',
      },
      { d: 'न', i: 'na', g: 'not', u: 'u-na2' },
      { d: 'द्वेष्टि', i: 'dveṣṭi', g: 'hates, recoils from', u: 'u-dvesti' },
      { d: 'तस्य', i: 'tasya', g: 'his', u: 'u-tasya' },
      { d: 'प्रज्ञा', i: 'prajñā', g: 'wisdom', u: 'u-prajna' },
      { d: 'प्रतिष्ठिता', i: 'pratiṣṭhitā', g: 'stands firm, is established', u: 'u-pratisthita' },
      mark(57, '५७'),
    ],
    en: 'neither{u-na1} welcoming{u-abhinandati} nor{u-na2} hating{u-dvesti} — his{u-tasya} wisdom{u-prajna} [stands firm.]{u-pratisthita}',
  }),

  // ── 2.58 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-58a',
    tokens: [
      { d: 'यदा', i: 'yadā', g: 'when', u: 'u-yada' },
      { d: 'संहरते', i: 'saṃharate', g: 'draws in, gathers back', u: 'u-samharate' },
      {
        d: 'चायं', i: 'cāyaṃ',
        m: [
          { i: 'c', g: 'and', u: 'u-ca' },
          { i: 'āyaṃ', g: 'this one — he', u: 'u-ayam' },
        ],
        note: 'ca + ayam — the two a-sounds fuse into ā.',
      },
      {
        d: 'कूर्मोऽङ्गानीव', i: "kūrmo'ṅgānīva",
        m: [
          { i: 'kūrmo', g: 'a tortoise', u: 'u-kurma' },
          { i: "'ṅgān", g: 'its limbs', u: 'u-angani' },
          { i: 'īva', g: 'as, like', u: 'u-iva' },
        ],
        note: 'kūrmaḥ + aṅgāni + iva — the ऽ (avagraha) marks aṅgāni’s elided a; the two i-sounds fuse into ī.',
      },
      { d: 'सर्वशः', i: 'sarvaśaḥ', g: 'on every side', u: 'u-sarvasah' },
      DANDA,
    ],
    en: 'And{u-ca} when{u-yada} he{u-ayam} [draws in]{u-samharate} — [as a]{u-iva} tortoise{u-kurma} [its limbs]{u-angani} — [on every side]{u-sarvasah}',
  }),
  gitaSegment({
    id: 'bg2-58b',
    tokens: [
      {
        d: 'इन्द्रियाणीन्द्रियार्थेभ्यस्तस्य', i: 'indriyāṇīndriyārthebhyastasya',
        m: [
          { i: 'indriyāṇ', g: 'the senses', u: 'u-indriyani' },
          { i: 'īndriyārthebhyas', g: 'from the sense-objects — what the senses reach for', u: 'u-arthebhyah' },
          { i: 'tasya', g: 'his', u: 'u-tasya' },
        ],
        note: 'indriyāṇi + indriya-arthebhyaḥ + tasya — the fused ī holds the end of one word and the start of the next.',
      },
      { d: 'प्रज्ञा', i: 'prajñā', g: 'wisdom', u: 'u-prajna' },
      { d: 'प्रतिष्ठिता', i: 'pratiṣṭhitā', g: 'stands firm, is established', u: 'u-pratisthita' },
      mark(58, '५८'),
    ],
    en: '[his senses]{u-indriyani} [from their objects]{u-arthebhyah} — his{u-tasya} wisdom{u-prajna} [stands firm.]{u-pratisthita}',
  }),

  // ── 2.59 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-59a',
    tokens: [
      { d: 'विषया', i: 'viṣayā', g: 'the objects of sense', u: 'u-visaya',
        note: 'viṣayāḥ — the visarga drops before the voiced v-.' },
      { d: 'विनिवर्तन्ते', i: 'vinivartante', g: 'turn back, fall away', u: 'u-vinivartante' },
      { d: 'निराहारस्य', i: 'nirāhārasya', g: 'of the one who abstains — who fasts from them', u: 'u-nirahara' },
      { d: 'देहिनः', i: 'dehinaḥ', g: 'the embodied one', u: 'u-dehin' },
      DANDA,
    ],
    en: 'For [the embodied one]{u-dehin} [who abstains,]{u-nirahara} [the objects of sense]{u-visaya} [fall away]{u-vinivartante} —',
  }),
  gitaSegment({
    id: 'bg2-59b',
    tokens: [
      {
        d: 'रसवर्जं', i: 'rasavarjaṃ',
        m: [
          { i: 'rasa', g: 'the taste — the felt relish', u: 'u-rasa1' },
          { i: 'varjaṃ', g: 'except, leaving behind', u: 'u-varja' },
        ],
      },
      {
        d: 'रसोऽप्यस्य', i: "raso'pyasya",
        m: [
          { i: 'raso', g: 'the taste — the felt relish', u: 'u-rasa2' },
          { i: "'py", g: 'even', u: 'u-api' },
          { i: 'asya', g: 'his, for him', u: 'u-asya' },
        ],
        note: 'rasaḥ + api + asya — the ऽ (avagraha) marks api’s elided a.',
      },
      { d: 'परं', i: 'paraṃ', g: 'the highest, the supreme', u: 'u-param' },
      { d: 'दृष्ट्वा', i: 'dṛṣṭvā', g: 'having seen', u: 'u-drstva' },
      { d: 'निवर्तते', i: 'nivartate', g: 'turns away', u: 'u-nivartate' },
      mark(59, '५९'),
    ],
    en: '[all but]{u-varja} [the taste;]{u-rasa1} even{u-api} [that taste]{u-rasa2} [turns away]{u-nivartate} [from him]{u-asya} [once the highest]{u-param} [is seen.]{u-drstva}',
  }),

  // ── 2.60 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-60a',
    tokens: [
      { d: 'यततो', i: 'yatato', g: 'of one who strives', u: 'u-yatatah',
        note: 'yatataḥ — final -aḥ becomes -o before the voiced h-.' },
      {
        d: 'ह्यपि', i: 'hyapi',
        m: [
          { i: 'hy', g: 'for, indeed', u: 'u-hi' },
          { i: 'api', g: 'even', u: 'u-api' },
        ],
        note: 'hi + api — the i glides into y before the vowel.',
      },
      { d: 'कौन्तेय', i: 'kaunteya', g: 'O son of Kuntī — Arjuna', u: 'u-kaunteya' },
      { d: 'पुरुषस्य', i: 'puruṣasya', g: 'of a man', u: 'u-purusa' },
      { d: 'विपश्चितः', i: 'vipaścitaḥ', g: 'discerning, clear-seeing', u: 'u-vipascit' },
      DANDA,
    ],
    en: 'For{u-hi} even{u-api} [in a man]{u-purusa} [who strives,]{u-yatatah} discerning,{u-vipascit} [O son of Kuntī,]{u-kaunteya}',
  }),
  gitaSegment({
    id: 'bg2-60b',
    tokens: [
      { d: 'इन्द्रियाणि', i: 'indriyāṇi', g: 'the senses', u: 'u-indriyani' },
      { d: 'प्रमाथीनि', i: 'pramāthīni', g: 'churning, turbulent', u: 'u-pramathi' },
      { d: 'हरन्ति', i: 'haranti', g: 'carry away', u: 'u-haranti' },
      { d: 'प्रसभं', i: 'prasabhaṃ', g: 'by force, violently', u: 'u-prasabham' },
      { d: 'मनः', i: 'manaḥ', g: 'the mind', u: 'u-manas' },
      mark(60, '६०'),
    ],
    en: '[the churning]{u-pramathi} senses{u-indriyani} [carry off]{u-haranti} [the mind]{u-manas} [by force.]{u-prasabham}',
  }),

  // ── 2.61 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-61a',
    tokens: [
      { d: 'तानि', i: 'tāni', g: 'them', u: 'u-tani' },
      { d: 'सर्वाणि', i: 'sarvāṇi', g: 'all', u: 'u-sarvani' },
      { d: 'संयम्य', i: 'saṃyamya', g: 'having reined in', u: 'u-samyamya' },
      { d: 'युक्त', i: 'yukta', g: 'yoked, collected', u: 'u-yukta',
        note: 'yuktaḥ — the visarga drops before the following vowel; the source writes the two words apart.' },
      { d: 'आसीत', i: 'āsīta', g: 'let him sit', u: 'u-asita' },
      {
        // mat-para: "with Me as the highest" — the passage's one theistic turn.
        d: 'मत्परः', i: 'matparaḥ',
        m: [
          { i: 'mat', g: 'me — Krishna speaking', u: 'u-mat' },
          { i: 'paraḥ', g: 'intent on, given over to — as the highest', u: 'u-para' },
        ],
      },
      DANDA,
    ],
    en: '[Reining in]{u-samyamya} them{u-tani} all,{u-sarvani} [let him sit]{u-asita} collected,{u-yukta} [intent on]{u-para} me;{u-mat}',
  }),
  gitaSegment({
    id: 'bg2-61b',
    tokens: [
      { d: 'वशे', i: 'vaśe', g: 'under control, in hand', u: 'u-vase' },
      { d: 'हि', i: 'hi', g: 'for, indeed', u: 'u-hi' },
      {
        d: 'यस्येन्द्रियाणि', i: 'yasyendriyāṇi',
        m: [
          { i: 'yasy', g: 'whose', u: 'u-yasya' },
          { i: 'endriyāṇi', g: 'senses', u: 'u-indriyani' },
        ],
        note: 'yasya + indriyāṇi — a and i fuse into e, shared across the seam.',
      },
      { d: 'तस्य', i: 'tasya', g: 'his', u: 'u-tasya' },
      { d: 'प्रज्ञा', i: 'prajñā', g: 'wisdom', u: 'u-prajna' },
      { d: 'प्रतिष्ठिता', i: 'pratiṣṭhitā', g: 'stands firm, is established', u: 'u-pratisthita' },
      mark(61, '६१'),
    ],
    en: 'for{u-hi} [the man whose]{u-yasya} senses{u-indriyani} [are under control]{u-vase} — his{u-tasya} wisdom{u-prajna} [stands firm.]{u-pratisthita}',
  }),

  // ── 2.62 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-62a',
    tokens: [
      { d: 'ध्यायतो', i: 'dhyāyato', g: 'for one who dwells on, broods over', u: 'u-dhyayatah',
        note: 'dhyāyataḥ — final -aḥ becomes -o before the voiced v-.' },
      {
        d: 'विषयान्पुंसः', i: 'viṣayānpuṃsaḥ',
        m: [
          { i: 'viṣayān', g: 'the objects of sense', u: 'u-visayan' },
          { i: 'puṃsaḥ', g: 'in a man', u: 'u-pumsah' },
        ],
      },
      {
        d: 'सङ्गस्तेषूपजायते', i: 'saṅgasteṣūpajāyate',
        m: [
          { i: 'saṅgas', g: 'attachment — the clinging bond', u: 'u-sanga' },
          { i: 'teṣ', g: 'to them', u: 'u-tesu' },
          { i: 'ūpajāyate', g: 'is born, springs up', u: 'u-upajayate' },
        ],
        note: 'saṅgaḥ + teṣu + upajāyate — the two u-sounds fuse into ū.',
      },
      DANDA,
    ],
    en: '[In a man]{u-pumsah} [who dwells on]{u-dhyayatah} [the objects of sense,]{u-visayan} attachment{u-sanga} [to them]{u-tesu} [is born;]{u-upajayate}',
  }),
  gitaSegment({
    id: 'bg2-62b',
    tokens: [
      {
        d: 'सङ्गात्संजायते', i: 'saṅgātsaṃjāyate',
        m: [
          { i: 'saṅgāt', g: 'from attachment', u: 'u-sangat' },
          { i: 'saṃjāyate', g: 'is born', u: 'u-samjayate' },
        ],
      },
      { d: 'कामः', i: 'kāmaḥ', g: 'desire', u: 'u-kama1' },
      {
        d: 'कामात्क्रोधोऽभिजायते', i: "kāmātkrodho'bhijāyate",
        m: [
          { i: 'kāmāt', g: 'from desire', u: 'u-kamat' },
          { i: 'krodho', g: 'anger', u: 'u-krodha' },
          { i: "'bhijāyate", g: 'is born', u: 'u-abhijayate' },
        ],
        note: 'kāmāt + krodhaḥ + abhijāyate — the ऽ (avagraha) marks abhijāyate’s elided a.',
      },
      mark(62, '६२'),
    ],
    en: '[from attachment]{u-sangat} [is born]{u-samjayate} desire;{u-kama1} [from desire,]{u-kamat} anger{u-krodha} [is born.]{u-abhijayate}',
  }),

  // ── 2.63 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-63a',
    tokens: [
      {
        d: 'क्रोधाद्भवति', i: 'krodhādbhavati',
        m: [
          { i: 'krodhād', g: 'from anger', u: 'u-krodhat' },
          { i: 'bhavati', g: 'comes, arises', u: 'u-bhavati' },
        ],
      },
      { d: 'संमोहः', i: 'saṃmohaḥ', g: 'delusion — full bewilderment', u: 'u-sammoha1' },
      {
        d: 'संमोहात्स्मृतिविभ्रमः', i: 'saṃmohātsmṛtivibhramaḥ',
        m: [
          { i: 'saṃmohāt', g: 'from delusion', u: 'u-sammohat' },
          { i: 'smṛti', g: 'memory', u: 'u-smrti1' },
          { i: 'vibhramaḥ', g: 'the wandering, the scattering', u: 'u-vibhrama' },
        ],
      },
      DANDA,
    ],
    en: '[From anger]{u-krodhat} comes{u-bhavati} delusion;{u-sammoha1} [from delusion,]{u-sammohat} memory{u-smrti1} wanders;{u-vibhrama}',
  }),
  gitaSegment({
    id: 'bg2-63b',
    tokens: [
      {
        d: 'स्मृतिभ्रंशाद्बुद्धिनाशो', i: 'smṛtibhraṃśādbuddhināśo',
        m: [
          { i: 'smṛti', g: 'memory', u: 'u-smrti2' },
          { i: 'bhraṃśād', g: 'from the breaking of', u: 'u-bhramsat' },
          { i: 'buddhi', g: 'understanding', u: 'u-buddhi' },
          { i: 'nāśo', g: 'the ruin, the loss', u: 'u-nasa1' },
        ],
      },
      {
        d: 'बुद्धिनाशात्प्रणश्यति', i: 'buddhināśātpraṇaśyati',
        m: [
          { i: 'buddhi', g: 'understanding', u: 'u-buddhi2' },
          { i: 'nāśāt', g: 'from the ruin of', u: 'u-nasat' },
          { i: 'praṇaśyati', g: 'he perishes', u: 'u-pranasyati' },
        ],
      },
      mark(63, '६३'),
    ],
    en: '[when memory]{u-smrti2} breaks,{u-bhramsat} understanding{u-buddhi} [is ruined;]{u-nasa1} [when understanding]{u-buddhi2} [is ruined,]{u-nasat} [he perishes.]{u-pranasyati}',
  }),

  // ── 2.64 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-64a',
    tokens: [
      {
        d: 'रागद्वेषवियुक्तैस्तु', i: 'rāgadveṣaviyuktaistu',
        m: [
          { i: 'rāga', g: 'passion', u: 'u-raga' },
          { i: 'dveṣa', g: 'hatred', u: 'u-dvesa' },
          { i: 'viyuktais', g: 'freed from, unyoked from', u: 'u-viyukta' },
          { i: 'tu', g: 'but', u: 'u-tu' },
        ],
      },
      {
        d: 'विषयानिन्द्रियैश्चरन्', i: 'viṣayānindriyaiścaran',
        m: [
          { i: 'viṣayān', g: 'the objects of sense', u: 'u-visayan' },
          { i: 'indriyaiś', g: 'with the senses', u: 'u-indriyaih' },
          { i: 'caran', g: 'moving among', u: 'u-caran' },
        ],
      },
      DANDA,
    ],
    en: 'But{u-tu} [moving among]{u-caran} [the objects of sense]{u-visayan} [with senses]{u-indriyaih} freed{u-viyukta} [of passion]{u-raga} [and hatred,]{u-dvesa}',
  }),
  gitaSegment({
    id: 'bg2-64b',
    tokens: [
      {
        d: 'आत्मवश्यैर्विधेयात्मा', i: 'ātmavaśyairvidheyātmā',
        m: [
          { i: 'ātma', g: 'his own self', u: 'u-atma' },
          { i: 'vaśyair', g: 'answering to — under command', u: 'u-vasya' },
          { i: 'vidheyātmā', g: 'himself well in hand — self-governed', u: 'u-vidheyatma' },
        ],
      },
      {
        d: 'प्रसादमधिगच्छति', i: 'prasādamadhigacchati',
        m: [
          { i: 'prasādam', g: 'serenity — a settled clearness', u: 'u-prasada' },
          { i: 'adhigacchati', g: 'he comes to, attains', u: 'u-adhigacchati' },
        ],
      },
      mark(64, '६४'),
    ],
    en: 'senses [answering to]{u-vasya} [his own self,]{u-atma} [himself in hand,]{u-vidheyatma} [he comes to]{u-adhigacchati} serenity.{u-prasada}',
  }),

  // ── 2.65 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-65a',
    tokens: [
      { d: 'प्रसादे', i: 'prasāde', g: 'in serenity', u: 'u-prasade' },
      {
        d: 'सर्वदुःखानां', i: 'sarvaduḥkhānāṃ',
        m: [
          { i: 'sarva', g: 'all', u: 'u-sarva' },
          { i: 'duḥkhānāṃ', g: 'sorrows', u: 'u-duhkha' },
        ],
      },
      {
        d: 'हानिरस्योपजायते', i: 'hānirasyopajāyate',
        m: [
          { i: 'hānir', g: 'the ending, the falling away', u: 'u-hani' },
          { i: 'asy', g: 'for him', u: 'u-asya' },
          { i: 'opajāyate', g: 'is born, comes about', u: 'u-upajayate' },
        ],
        note: 'hāniḥ + asya + upajāyate — a and u fuse into o, shared across the seam.',
      },
      DANDA,
    ],
    en: '[In serenity]{u-prasade} [is born]{u-upajayate} [the ending]{u-hani} [of all]{u-sarva} his{u-asya} sorrows;{u-duhkha}',
  }),
  gitaSegment({
    id: 'bg2-65b',
    tokens: [
      {
        d: 'प्रसन्नचेतसो', i: 'prasannacetaso',
        m: [
          { i: 'prasanna', g: 'clear, settled', u: 'u-prasanna' },
          { i: 'cetaso', g: 'of mind', u: 'u-cetas' },
        ],
        note: 'prasanna-cetasaḥ — final -aḥ becomes -o before the voiced h-.',
      },
      {
        d: 'ह्याशु', i: 'hyāśu',
        m: [
          { i: 'hy', g: 'for, indeed', u: 'u-hi' },
          { i: 'āśu', g: 'swiftly, soon', u: 'u-asu' },
        ],
      },
      { d: 'बुद्धिः', i: 'buddhiḥ', g: 'understanding', u: 'u-buddhi' },
      { d: 'पर्यवतिष्ठते', i: 'paryavatiṣṭhate', g: 'settles firm on every side', u: 'u-paryavatisthate' },
      mark(65, '६५'),
    ],
    en: 'for{u-hi} [in one of clear]{u-prasanna} mind,{u-cetas} understanding{u-buddhi} soon{u-asu} [stands firm.]{u-paryavatisthate}',
  }),

  // ── 2.66 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-66a',
    tokens: [
      {
        d: 'नास्ति', i: 'nāsti',
        m: [
          { i: 'n', g: 'not', u: 'u-na1' },
          { i: 'āsti', g: 'there is', u: 'u-asti' },
        ],
        note: 'na + asti — the two a-sounds fuse into ā.',
      },
      {
        d: 'बुद्धिरयुक्तस्य', i: 'buddhirayuktasya',
        m: [
          { i: 'buddhir', g: 'understanding', u: 'u-buddhi' },
          { i: 'ayuktasya', g: 'for the unyoked — the undisciplined', u: 'u-ayukta1' },
        ],
      },
      { d: 'न', i: 'na', g: 'not', u: 'u-na2' },
      {
        d: 'चायुक्तस्य', i: 'cāyuktasya',
        m: [
          { i: 'c', g: 'and', u: 'u-ca' },
          { i: 'āyuktasya', g: 'for the unyoked — the undisciplined', u: 'u-ayukta2' },
        ],
      },
      // bhāvanā: sustained dwelling on one object — "meditation" in the plain sense.
      { d: 'भावना', i: 'bhāvanā', g: 'sustained thought — dwelling with one idea', u: 'u-bhavana' },
      DANDA,
    ],
    en: '[For the unyoked]{u-ayukta1} [there is]{u-asti} no{u-na1} understanding,{u-buddhi} and{u-ca} [for the unyoked]{u-ayukta2} no{u-na2} [sustained thought;]{u-bhavana}',
  }),
  gitaSegment({
    id: 'bg2-66b',
    tokens: [
      { d: 'न', i: 'na', g: 'not', u: 'u-na3' },
      {
        d: 'चाभावयतः', i: 'cābhāvayataḥ',
        m: [
          { i: 'c', g: 'and', u: 'u-ca2' },
          { i: 'ābhāvayataḥ', g: 'for one without sustained thought', u: 'u-abhavayat' },
        ],
      },
      {
        d: 'शान्तिरशान्तस्य', i: 'śāntiraśāntasya',
        m: [
          { i: 'śāntir', g: 'peace', u: 'u-santi' },
          { i: 'aśāntasya', g: 'for the peaceless', u: 'u-asanta' },
        ],
      },
      { d: 'कुतः', i: 'kutaḥ', g: 'from where?', u: 'u-kutah' },
      { d: 'सुखम्', i: 'sukham', g: 'happiness', u: 'u-sukha' },
      mark(66, '६६'),
    ],
    en: 'and{u-ca2} [for one who cannot hold a thought,]{u-abhavayat} no{u-na3} peace;{u-santi} [and for the peaceless,]{u-asanta} [where is]{u-kutah} happiness?{u-sukha}',
  }),

  // ── 2.67 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-67a',
    tokens: [
      { d: 'इन्द्रियाणां', i: 'indriyāṇāṃ', g: 'of the senses', u: 'u-indriyanam' },
      { d: 'हि', i: 'hi', g: 'for, indeed', u: 'u-hi' },
      { d: 'चरतां', i: 'caratāṃ', g: 'roving, wandering', u: 'u-caratam' },
      {
        d: 'यन्मनोऽनु', i: "yanmano'nu",
        m: [
          { i: 'yan', g: 'whichever', u: 'u-yat' },
          { i: 'mano', g: 'the mind', u: 'u-manas' },
          { i: "'nu", g: 'after, along behind', u: 'u-anu' },
        ],
        note: 'yat + manaḥ + anu — the ऽ (avagraha) marks anu’s elided a.',
      },
      { d: 'विधीयते', i: 'vidhīyate', g: 'is given over, yields itself', u: 'u-vidhiyate' },
      DANDA,
    ],
    en: 'For{u-hi} [when the mind]{u-manas} [is given over]{u-vidhiyate} [to follow]{u-anu} whichever{u-yat} [of the roving]{u-caratam} senses,{u-indriyanam}',
  }),
  gitaSegment({
    id: 'bg2-67b',
    tokens: [
      {
        d: 'तदस्य', i: 'tadasya',
        m: [
          { i: 'tad', g: 'that one — the sense it follows', u: 'u-tat' },
          { i: 'asya', g: 'his', u: 'u-asya' },
        ],
      },
      { d: 'हरति', i: 'harati', g: 'carries away', u: 'u-harati' },
      { d: 'प्रज्ञां', i: 'prajñāṃ', g: 'wisdom', u: 'u-prajna' },
      {
        d: 'वायुर्नावमिवाम्भसि', i: 'vāyurnāvamivāmbhasi',
        m: [
          { i: 'vāyur', g: 'the wind', u: 'u-vayu' },
          { i: 'nāvam', g: 'a ship, a boat', u: 'u-nava' },
          { i: 'iv', g: 'as, like', u: 'u-iva' },
          { i: 'āmbhasi', g: 'on the waters', u: 'u-ambhasi' },
        ],
        note: 'vāyuḥ + nāvam + iva + ambhasi — iva’s a merges into ambhasi’s opening vowel.',
      },
      mark(67, '६७'),
    ],
    en: '[that one]{u-tat} [carries off]{u-harati} his{u-asya} wisdom,{u-prajna} as{u-iva} [the wind]{u-vayu} [a ship]{u-nava} [on the waters.]{u-ambhasi}',
  }),

  // ── 2.68 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-68a',
    tokens: [
      {
        d: 'तस्माद्यस्य', i: 'tasmādyasya',
        m: [
          { i: 'tasmād', g: 'therefore', u: 'u-tasmat' },
          { i: 'yasya', g: 'whose', u: 'u-yasya' },
        ],
      },
      { d: 'महाबाहो', i: 'mahābāho', g: 'O mighty-armed one — Arjuna', u: 'u-mahabaho' },
      { d: 'निगृहीतानि', i: 'nigṛhītāni', g: 'held back, reined in', u: 'u-nigrhita' },
      { d: 'सर्वशः', i: 'sarvaśaḥ', g: 'on every side', u: 'u-sarvasah' },
      DANDA,
    ],
    en: 'Therefore,{u-tasmat} [O mighty-armed one,]{u-mahabaho} [the man whose]{u-yasya} senses are [held back]{u-nigrhita} [on every side]{u-sarvasah}',
  }),
  gitaSegment({
    id: 'bg2-68b',
    tokens: [
      {
        d: 'इन्द्रियाणीन्द्रियार्थेभ्यस्तस्य', i: 'indriyāṇīndriyārthebhyastasya',
        m: [
          { i: 'indriyāṇ', g: 'the senses', u: 'u-indriyani' },
          { i: 'īndriyārthebhyas', g: 'from the sense-objects — what the senses reach for', u: 'u-arthebhyah' },
          { i: 'tasya', g: 'his', u: 'u-tasya' },
        ],
        note: 'The same refrain as 2.58 — the chapter’s recurring measure of firmness.',
      },
      { d: 'प्रज्ञा', i: 'prajñā', g: 'wisdom', u: 'u-prajna' },
      { d: 'प्रतिष्ठिता', i: 'pratiṣṭhitā', g: 'stands firm, is established', u: 'u-pratisthita' },
      mark(68, '६८'),
    ],
    en: '[his senses]{u-indriyani} [from their objects]{u-arthebhyah} — his{u-tasya} wisdom{u-prajna} [stands firm.]{u-pratisthita}',
  }),

  // ── 2.69 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-69a',
    tokens: [
      { d: 'या', i: 'yā', g: 'what', u: 'u-ya' },
      { d: 'निशा', i: 'niśā', g: 'night', u: 'u-nisa1' },
      {
        d: 'सर्वभूतानां', i: 'sarvabhūtānāṃ',
        m: [
          { i: 'sarva', g: 'all', u: 'u-sarva' },
          { i: 'bhūtānāṃ', g: 'beings', u: 'u-bhuta' },
        ],
      },
      { d: 'तस्यां', i: 'tasyāṃ', g: 'in that', u: 'u-tasyam' },
      { d: 'जागर्ति', i: 'jāgarti', g: 'stays awake', u: 'u-jagarti' },
      { d: 'संयमी', i: 'saṃyamī', g: 'the restrained one', u: 'u-samyami' },
      DANDA,
    ],
    en: 'What{u-ya} [is night]{u-nisa1} [to all]{u-sarva} beings{u-bhuta} — [in it]{u-tasyam} [the restrained one]{u-samyami} [is awake;]{u-jagarti}',
  }),
  gitaSegment({
    id: 'bg2-69b',
    tokens: [
      { d: 'यस्यां', i: 'yasyāṃ', g: 'in which', u: 'u-yasyam' },
      { d: 'जाग्रति', i: 'jāgrati', g: 'are awake', u: 'u-jagrati' },
      { d: 'भूतानि', i: 'bhūtāni', g: 'beings', u: 'u-bhutani' },
      { d: 'सा', i: 'sā', g: 'that', u: 'u-sa' },
      { d: 'निशा', i: 'niśā', g: 'night', u: 'u-nisa2' },
      { d: 'पश्यतो', i: 'paśyato', g: 'who sees', u: 'u-pasyat',
        note: 'paśyataḥ — final -aḥ becomes -o before the voiced m-.' },
      { d: 'मुनेः', i: 'muneḥ', g: 'for the sage', u: 'u-muni' },
      mark(69, '६९'),
    ],
    en: '[in what]{u-yasyam} beings{u-bhutani} [are awake]{u-jagrati} — that{u-sa} [is night]{u-nisa2} [for the sage]{u-muni} [who sees.]{u-pasyat}',
  }),

  // ── 2.70 (triṣṭubh — the chapter's one longer metre) ─────────────────
  gitaSegment({
    id: 'bg2-70a',
    tokens: [
      {
        d: 'आपूर्यमाणमचलप्रतिष्ठं', i: 'āpūryamāṇamacalapratiṣṭhaṃ',
        m: [
          { i: 'āpūryamāṇam', g: 'ever being filled', u: 'u-apuryamana' },
          { i: 'acala', g: 'unmoved', u: 'u-acala' },
          { i: 'pratiṣṭhaṃ', g: 'standing firm', u: 'u-pratistham' },
        ],
      },
      {
        d: 'समुद्रमापः', i: 'samudramāpaḥ',
        m: [
          { i: 'samudram', g: 'the sea', u: 'u-samudra' },
          { i: 'āpaḥ', g: 'the waters', u: 'u-apah' },
        ],
      },
      { d: 'प्रविशन्ति', i: 'praviśanti', g: 'enter', u: 'u-pravisanti1' },
      { d: 'यद्वत्', i: 'yadvat', g: 'just as', u: 'u-yadvat' },
      DANDA,
    ],
    en: '[Just as]{u-yadvat} [the waters]{u-apah} enter{u-pravisanti1} [the sea]{u-samudra} — [ever filled,]{u-apuryamana} unmoved,{u-acala} [firm-standing]{u-pratistham} —',
  }),
  gitaSegment({
    id: 'bg2-70b',
    tokens: [
      {
        d: 'तद्वत्कामा', i: 'tadvatkāmā',
        m: [
          { i: 'tadvat', g: 'so, in the same way', u: 'u-tadvat' },
          { i: 'kāmā', g: 'desires', u: 'u-kamah' },
        ],
        note: 'kāmāḥ — the visarga drops before the voiced y-.',
      },
      { d: 'यं', i: 'yaṃ', g: 'whom', u: 'u-yam' },
      { d: 'प्रविशन्ति', i: 'praviśanti', g: 'enter', u: 'u-pravisanti2' },
      { d: 'सर्वे', i: 'sarve', g: 'all', u: 'u-sarve' },
      { d: 'स', i: 'sa', g: 'he', u: 'u-sah',
        note: 'saḥ — the visarga drops before the following ś-.' },
      {
        d: 'शान्तिमाप्नोति', i: 'śāntimāpnoti',
        m: [
          { i: 'śāntim', g: 'peace', u: 'u-santi' },
          { i: 'āpnoti', g: 'attains, wins', u: 'u-apnoti' },
        ],
      },
      { d: 'न', i: 'na', g: 'not', u: 'u-na' },
      {
        d: 'कामकामी', i: 'kāmakāmī',
        m: [
          { i: 'kāma', g: 'desires', u: 'u-kama2' },
          { i: 'kāmī', g: 'the desirer of', u: 'u-kami' },
        ],
      },
      mark(70, '७०'),
    ],
    en: 'so{u-tadvat} [do all]{u-sarve} desires{u-kamah} enter{u-pravisanti2} him{u-yam} — [and he]{u-sah} attains{u-apnoti} peace:{u-santi} not{u-na} [the desirer]{u-kami} [of desires.]{u-kama2}',
  }),

  // ── 2.71 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-71a',
    tokens: [
      { d: 'विहाय', i: 'vihāya', g: 'putting aside, abandoning', u: 'u-vihaya' },
      {
        d: 'कामान्यः', i: 'kāmānyaḥ',
        m: [
          { i: 'kāmān', g: 'desires', u: 'u-kaman' },
          { i: 'yaḥ', g: 'who', u: 'u-yah' },
        ],
      },
      { d: 'सर्वान्', i: 'sarvān', g: 'all', u: 'u-sarvan' },
      {
        d: 'पुमांश्चरति', i: 'pumāṃścarati',
        m: [
          { i: 'pumāṃś', g: 'the man', u: 'u-puman' },
          { i: 'carati', g: 'moves, walks', u: 'u-carati' },
        ],
        note: 'pumān + carati — the n becomes ṃś before c.',
      },
      { d: 'निःस्पृहः', i: 'niḥspṛhaḥ', g: 'free of craving', u: 'u-nihsprha' },
      DANDA,
    ],
    en: '[The man]{u-puman} who,{u-yah} [putting aside]{u-vihaya} all{u-sarvan} desires,{u-kaman} moves{u-carati} [free of craving,]{u-nihsprha}',
  }),
  gitaSegment({
    id: 'bg2-71b',
    tokens: [
      { d: 'निर्ममो', i: 'nirmamo', g: 'without “mine” — claiming nothing', u: 'u-nirmama',
        note: 'nirmamaḥ — final -aḥ becomes -o before the voiced n-.' },
      { d: 'निरहंकारः', i: 'nirahaṃkāraḥ', g: 'without “I” — no self-importance', u: 'u-nirahamkara' },
      { d: 'स', i: 'sa', g: 'he', u: 'u-sah' },
      {
        d: 'शान्तिमधिगच्छति', i: 'śāntimadhigacchati',
        m: [
          { i: 'śāntim', g: 'peace', u: 'u-santi' },
          { i: 'adhigacchati', g: 'comes to, attains', u: 'u-adhigacchati' },
        ],
      },
      mark(71, '७१'),
    ],
    en: '[without “mine,”]{u-nirmama} [without “I”]{u-nirahamkara} — he{u-sah} [comes to]{u-adhigacchati} peace.{u-santi}',
  }),

  // ── 2.72 ──────────────────────────────────────────────────────────────
  gitaSegment({
    id: 'bg2-72a',
    tokens: [
      { d: 'एषा', i: 'eṣā', g: 'this', u: 'u-esa' },
      { d: 'ब्राह्मी', i: 'brāhmī', g: 'of Brahman — the vast, the absolute', u: 'u-brahmi' },
      { d: 'स्थितिः', i: 'sthitiḥ', g: 'the standing, the state', u: 'u-sthiti' },
      { d: 'पार्थ', i: 'pārtha', g: 'O Pārtha — Arjuna', u: 'u-partha' },
      {
        d: 'नैनां', i: 'naināṃ',
        m: [
          { i: 'n', g: 'not', u: 'u-na' },
          { i: 'aināṃ', g: 'it — this state (enām)', u: 'u-enam' },
        ],
        note: 'na + enāṃ — a and e fuse into ai, shared across the seam.',
      },
      { d: 'प्राप्य', i: 'prāpya', g: 'having reached', u: 'u-prapya' },
      { d: 'विमुह्यति', i: 'vimuhyati', g: 'is deluded, loses the way', u: 'u-vimuhyati' },
      DANDA,
    ],
    en: 'This{u-esa} [is the state]{u-sthiti} [of Brahman,]{u-brahmi} [O Pārtha;]{u-partha} reaching{u-prapya} it,{u-enam} [one is deluded]{u-vimuhyati} [no more.]{u-na}',
  }),
  gitaSegment({
    id: 'bg2-72b',
    tokens: [
      {
        d: 'स्थित्वास्यामन्तकालेऽपि', i: "sthitvāsyāmantakāle'pi",
        m: [
          { i: 'sthitvā', g: 'abiding, having taken one’s stand', u: 'u-sthitva' },
          { i: 'syām', g: 'in it — in this state', u: 'u-asyam' },
          { i: 'antakāle', g: 'at the hour of the end — death', u: 'u-antakale' },
          { i: "'pi", g: 'even', u: 'u-api' },
        ],
        note: 'sthitvā + asyām + anta-kāle + api — asyām’s opening a merges into the ā; the ऽ marks api’s elided a.',
      },
      {
        d: 'ब्रह्मनिर्वाणमृच्छति', i: 'brahmanirvāṇamṛcchati',
        m: [
          { i: 'brahma', g: 'Brahman', u: 'u-brahma' },
          { i: 'nirvāṇam', g: 'nirvāṇa — the blowing-out, the stillness', u: 'u-nirvana' },
          { i: 'ṛcchati', g: 'reaches', u: 'u-rcchati' },
        ],
      },
      mark(72, '७२'),
    ],
    en: 'Abiding{u-sthitva} [in it]{u-asyam} even{u-api} [at the hour of death,]{u-antakale} [one reaches]{u-rcchati} [the stillness]{u-nirvana} [of Brahman.]{u-brahma}',
  }),
];
