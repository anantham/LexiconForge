/**
 * Heart Sutra surface → concept bindings — the hand-curated alignment overrides
 * for the inflected/compound forms the lemma-level concept registry can't match
 * on its own. Consumed by components/liturgy/concept/deriveAlignSegment.ts.
 *
 * This is CURATED DATA, not renderer code: changes here are reviewed like
 * content, and a coverage/consistency contract test
 * (components/liturgy/concept/conceptReader.test.ts) round-trips the shipped
 * chant through the derivation to guard against drift (a stale key, a renamed
 * concept, an upstream tokenization change).
 *
 * Deliberately conservative: surfaces that name two different concepts depending
 * on context ("death" — the unarisen pair vs. aging-and-death) are left out
 * rather than mis-aligned. A compound surface binds to several concepts at once.
 */

/** Script-side cleaned surface token → concept ids. */
export const BIND: Record<string, string[]> = {
  // Sanskrit (IAST) — inflected forms + compounds
  bodhisattvo: ['concept.bodhisattva'],
  gambhīrāṃ: ['concept.deep-gambhira'],
  prajñāpāramitācaryāṃ: ['concept.wisdom-prajna', 'concept.perfection-paramita', 'concept.practice-carya'],
  caramāṇo: ['concept.practice-carya'],
  vyavalokayati: ['concept.seeing-vyavalokita'],
  paśyati: ['concept.seeing-vyavalokita'],
  skandhāḥ: ['concept.skandha-aggregate'],
  svabhāvaśūnyān: ['concept.svabhava-own-being', 'concept.emptiness-sunyata'],
  // Tibetan — the shipped line carries the whole name (with the ārya- prefix) as one token
  'འཕགས་པ་སྤྱན་རས་གཟིགས་དབང་ཕྱུག': ['concept.avalokita-bodhisattva'],

  // ── Heart Sutra body (Sonnet-drafted, reviewed; ambiguous/no-concept surfaces left unbound) ──
  // Sanskrit (IAST)
  śūnyatālakṣaṇāḥ: ['concept.emptiness-sunyata'],
  śūnyatāyāṃ: ['concept.emptiness-sunyata'],
  anutpannā: ['concept.unarisen-anutpada'],
  aniruddhā: ['concept.unarisen-anutpada'],
  Chāriputra: ['concept.sariputra-addressee'],
  vedanā: ['concept.skandha-aggregate'],
  saṃjñā: ['concept.skandha-aggregate'],
  saṃskārāḥ: ['concept.skandha-aggregate'],
  vijñānam: ['concept.skandha-aggregate'],
  cakṣur: ['concept.six-faculties'],
  śrotraṃ: ['concept.six-faculties'],
  ghrāṇaṃ: ['concept.six-faculties'],
  kāyo: ['concept.six-faculties'],
  manaḥ: ['concept.six-faculties'],
  dharmāḥ: ['concept.dharma-phenomena'],
  cakṣurdhātur: ['concept.realm-dhatu'],
  manovijñānadhātuḥ: ['concept.realm-dhatu'],
  avidyākṣayo: ['concept.ignorance-avidya'],
  jarāmaraṇaṃ: ['concept.aging-death-jaramarana'],
  jarāmaraṇakṣayaḥ: ['concept.aging-death-jaramarana'],
  'duḥkha-samudaya-nirodha-mārgāḥ': ['concept.four-truths'],
  jñānaṃ: ['concept.knowledge-jnana'],
  jñātavyaṃ: ['concept.knowledge-jnana'],
  prāptiḥ: ['concept.attainment-prapti'],
  aprāptitvāt: ['concept.attainment-prapti'],
  'Cittāvaraṇa-': ['concept.obstruction-cittavarana'],
  viparyāsātikrānto: ['concept.inverted-view-viparyasa'],
  Tryadhvavyavasthitāḥ: ['concept.three-times-tryadhva'],
  prajñāpāramitām: ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  prajñāpāramitā: ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  prajñāpāramitāyām: ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  mahāmantraḥ: ['concept.mantra-vidya'],
  mahāvidyāmantraḥ: ['concept.mantra-vidya'],
  anuttaramantraḥ: ['concept.mantra-vidya'],
  asamasamamantraḥ: ['concept.mantra-vidya'],
  mantraḥ: ['concept.mantra-vidya'],
  sarvaduḥkhapraśamanaḥ: ['concept.suffering-duhkha'],
  // Chinese · Japanese (shared Han characters; keyed by surface)
  '諸法': ['concept.dharma-phenomena'],
  '生': ['concept.unarisen-anutpada'],
  '滅': ['concept.unarisen-anutpada'],
  '受': ['concept.skandha-aggregate'],
  '想': ['concept.skandha-aggregate'],
  '識': ['concept.skandha-aggregate'],
  '眼': ['concept.six-faculties'],
  '耳': ['concept.six-faculties'],
  '鼻': ['concept.six-faculties'],
  '舌': ['concept.six-faculties'],
  '身': ['concept.six-faculties'],
  '意': ['concept.six-faculties'],
  '眼界': ['concept.realm-dhatu'],
  '意識界': ['concept.realm-dhatu'],
  '集': ['concept.four-truths'],
  '道': ['concept.four-truths'],
  '心': ['concept.obstruction-cittavarana'],
  '罣礙': ['concept.obstruction-cittavarana'],
  '恐怖': ['concept.fearless-atrasta'],
  '顛倒': ['concept.inverted-view-viparyasa'],
  '涅槃': ['concept.nirvana-extinguishing'],
  '究竟': ['concept.nirvana-extinguishing'],
  '遠離': ['concept.inverted-view-viparyasa'],
  '夢想': ['concept.inverted-view-viparyasa'],
  '知': ['concept.knowledge-jnana'],
  '般若波羅蜜多': ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  '大神': ['concept.mantra-vidya'],
  '大明': ['concept.mantra-vidya'],
  '無上': ['concept.mantra-vidya'],
  '無等等': ['concept.mantra-vidya'],
  '咒': ['concept.mantra-vidya'],
  '苦厄': ['concept.suffering-duhkha'],
  '三世': ['concept.three-times-tryadhva'],
  '舍利子': ['concept.sariputra-addressee'],
  // Tibetan (syllable tokens)
  'སྟོང་པ': ['concept.emptiness-sunyata'],
  'སྐྱེས': ['concept.unarisen-anutpada'],
  'འགགས': ['concept.unarisen-anutpada'],
  'ཚོར': ['concept.skandha-aggregate'],
  'འདུ': ['concept.skandha-aggregate'],
  'མིག': ['concept.six-faculties'],
  'རྣ': ['concept.six-faculties'],
  'སྣ': ['concept.six-faculties'],
  'ལྕེ': ['concept.six-faculties'],
  'ལུས': ['concept.six-faculties'],
  'ཡིད': ['concept.six-faculties'],
  'གཟུགས': ['concept.form-rupa'],
  'ཁམས': ['concept.realm-dhatu'],
  'རིག': ['concept.mantra-vidya'],
  'རྒ': ['concept.aging-death-jaramarana'],
  'ཤི': ['concept.aging-death-jaramarana'],
  'སྡུག': ['concept.suffering-duhkha'],
  'བསྔལ': ['concept.suffering-duhkha'],
  'ཀུན': ['concept.four-truths'],
  'འབྱུང': ['concept.four-truths'],
  'འགོག': ['concept.four-truths'],
  'ལམ': ['concept.four-truths'],
  'ཡེ': ['concept.knowledge-jnana'],
  'ཐོབ': ['concept.attainment-prapti'],
  'སེམས': ['concept.obstruction-cittavarana'],
  'སྒྲིབ་པ': ['concept.obstruction-cittavarana'],
  'སྐྲག་པ': ['concept.fearless-atrasta'],
  'ཤེས་རབ': ['concept.wisdom-prajna'],
  // Multi-syllable Tibetan words that syllable-split rows fragment into bare
  // syllables — groupTibetan (deriveAlignSegment) rejoins consecutive syllables
  // that exactly form one of these keys, so the word binds instead of vanishing.
  // (Word-token rows like opening-seeing match these directly, no grouping.)
  'སྟོང་པ་ཉིད': ['concept.emptiness-sunyata'],
  'སྟོང་པར': ['concept.emptiness-sunyata'],
  'ཡེ་ཤེས': ['concept.knowledge-jnana'],
  'ཤཱ་རིའི་བུ': ['concept.sariputra-addressee'],
  'རྣམ་པར་ཤེས་པ': ['concept.skandha-aggregate'],
  'རྣམ་པར་བལྟའོ': ['concept.seeing-vyavalokita'],
};

/**
 * English surface (lowercase) → concept ids — a fallback consulted only when the
 * registry has no attestation for a witness's word, so witnesses that keep the
 * Sanskrit terms untranslated (Bodhi Sangha, Sariputta Ambedkar — "Prajna",
 * "skandhas") and the shared content words light up like MAPLE/Conze do.
 */
export const EN_BIND: Record<string, string[]> = {
  // names + untranslated Sanskrit
  avalokiteshvara: ['concept.avalokita-bodhisattva'],
  bodhisattva: ['concept.bodhisattva'],
  bodhisattvas: ['concept.bodhisattva'],
  shariputra: ['concept.sariputra-addressee'],
  prajna: ['concept.wisdom-prajna'],
  paramita: ['concept.perfection-paramita'],
  skandhas: ['concept.skandha-aggregate'],
  dharmas: ['concept.dharma-phenomena'],
  nirvana: ['concept.nirvana-extinguishing'],
  // shared content words
  practicing: ['concept.practice-carya'],
  practising: ['concept.practice-carya'],
  deep: ['concept.deep-gambhira'],
  deeply: ['concept.deep-gambhira'],
  wisdom: ['concept.wisdom-prajna'],
  empty: ['concept.emptiness-sunyata'],
  emptiness: ['concept.emptiness-sunyata'],
  form: ['concept.form-rupa'],
  suffering: ['concept.suffering-duhkha'],
  distress: ['concept.suffering-duhkha'],
  saw: ['concept.seeing-vyavalokita'],
  perceived: ['concept.seeing-vyavalokita'],
  born: ['concept.unarisen-anutpada'],
  destroyed: ['concept.unarisen-anutpada'],
  // the five skandhas in English
  feeling: ['concept.skandha-aggregate'],
  feelings: ['concept.skandha-aggregate'],
  perception: ['concept.skandha-aggregate'],
  perceptions: ['concept.skandha-aggregate'],
  reaction: ['concept.skandha-aggregate'],
  impulses: ['concept.skandha-aggregate'],
  consciousness: ['concept.skandha-aggregate'],
  // MAPLE's words for the other skandhas (preference = vedanā, information = saṃjñā, patterning = saṃskāra)
  preference: ['concept.skandha-aggregate'],
  information: ['concept.skandha-aggregate'],
  patterning: ['concept.skandha-aggregate'],
  // audit: content words MAPLE uses that were left unaligned while peers lit in other scripts
  arise: ['concept.unarisen-anutpada'],
  arising: ['concept.four-truths'],
  realm: ['concept.realm-dhatu'],
  aging: ['concept.aging-death-jaramarana'],
  death: ['concept.aging-death-jaramarana'],
  mantra: ['concept.mantra-vidya'],
  // the six faculties
  eye: ['concept.six-faculties'],
  eyes: ['concept.six-faculties'],
  ear: ['concept.six-faculties'],
  ears: ['concept.six-faculties'],
  nose: ['concept.six-faculties'],
  tongue: ['concept.six-faculties'],
  body: ['concept.six-faculties'],
  mind: ['concept.six-faculties'],
  // origination chain + four truths + aging-death
  ignorance: ['concept.ignorance-avidya'],
  age: ['concept.aging-death-jaramarana'],
  path: ['concept.four-truths'],
  cessation: ['concept.four-truths'],
  origination: ['concept.four-truths'],
  stopping: ['concept.four-truths'],
  cognition: ['concept.knowledge-jnana'],
  // additional seeing form
  seeing: ['concept.seeing-vyavalokita'],
  // unarisen / unceased forms across witnesses
  birth: ['concept.unarisen-anutpada'],
  destruction: ['concept.unarisen-anutpada'],
  // rūpa synonyms (each translator picks a different word for the first sense-object)
  forms: ['concept.form-rupa'],
  colour: ['concept.form-rupa'],
  color: ['concept.form-rupa'],
  shape: ['concept.form-rupa'],
  // dhātu / element / realm synonyms
  element: ['concept.realm-dhatu'],
  elements: ['concept.realm-dhatu'],
  realms: ['concept.realm-dhatu'],
  // dharma-phenomena synonym
  phenomena: ['concept.dharma-phenomena'],
  // knowledge (jñāna) — distinct from wisdom (prajñā)
  knowledge: ['concept.knowledge-jnana'],
  // Nirvāṇa with macron (Conze, Red Pine, Thich Nhat Hanh spellings)
  'nirvāṇa': ['concept.nirvana-extinguishing'],
  // Śāriputra with diacritics (Conze)
  'śāriputra': ['concept.sariputra-addressee'],
  // mantra / spell synonyms
  spell: ['concept.mantra-vidya'],
  // obstruction synonyms
  obstructions: ['concept.obstruction-cittavarana'],
  obstacles: ['concept.obstruction-cittavarana'],
  // additional skandha-member words
  impulse: ['concept.skandha-aggregate'],
  sensation: ['concept.skandha-aggregate'],
  memory: ['concept.skandha-aggregate'],
  formations: ['concept.skandha-aggregate'],
  // cause = samudaya (second noble truth)
  cause: ['concept.four-truths'],
  // suffering synonym (Thich Nhat Hanh)
  'ill-being': ['concept.suffering-duhkha'],
  // mind-states near the end
  attainment: ['concept.attainment-prapti'],
  attain: ['concept.attainment-prapti'],
  attained: ['concept.attainment-prapti'],
  hindrance: ['concept.obstruction-cittavarana'],
  fear: ['concept.fearless-atrasta'],
  fears: ['concept.fearless-atrasta'],
};

/**
 * Compound splits — the "minimal cut". A Sanskrit compound is one surface token
 * but several meaning-units; bound flat it would highlight the WHOLE word for
 * any one of its concepts. Splitting it into morpheme pieces (each → one
 * concept) makes hovering "wisdom" light only the `prajñā` slice, matching how
 * the other scripts already render the words separately (般若 / ཤེས་རབ).
 *
 * INVARIANT (asserted by the contract test): the pieces' text must concatenate
 * back to the surface key exactly, so the rendered word is unchanged.
 */
export const SPLIT: Record<string, { text: string; concepts: string[] }[]> = {
  prajñāpāramitācaryāṃ: [
    { text: 'prajñā', concepts: ['concept.wisdom-prajna'] },
    { text: 'pāramitā', concepts: ['concept.perfection-paramita'] },
    { text: 'caryāṃ', concepts: ['concept.practice-carya'] },
  ],
  prajñāpāramitām: [
    { text: 'prajñā', concepts: ['concept.wisdom-prajna'] },
    { text: 'pāramitām', concepts: ['concept.perfection-paramita'] },
  ],
  prajñāpāramitā: [
    { text: 'prajñā', concepts: ['concept.wisdom-prajna'] },
    { text: 'pāramitā', concepts: ['concept.perfection-paramita'] },
  ],
  prajñāpāramitāyām: [
    { text: 'prajñā', concepts: ['concept.wisdom-prajna'] },
    { text: 'pāramitāyām', concepts: ['concept.perfection-paramita'] },
  ],
  svabhāvaśūnyān: [
    { text: 'svabhāva', concepts: ['concept.svabhava-own-being'] },
    { text: 'śūnyān', concepts: ['concept.emptiness-sunyata'] },
  ],
};

/**
 * Devanāgarī for the few Sanskrit tokens that have no `words[].scriptAlt` in the
 * chant data (hyphenated compounds the registry didn't carry). Same self-
 * validation as everything else: the akshara romanizer must reproduce the IAST.
 */
export const EXTRA_DEVA: Record<string, string> = {
  'duḥkha-samudaya-nirodha-mārgāḥ': 'दुःखसमुदयनिरोधमार्गाः',
  'Cittāvaraṇa-': 'चित्तावरण',
};

/**
 * Per-character Japanese on'yomi for the multi-character phonetic-loan words
 * whose whole-word reading carries no separators ("hannya", "haramita"), so the
 * Han row can show 日 per character. Unambiguous within this chant.
 */
export const CHAR_JA: Record<string, string> = {
  般: 'han', 若: 'nya', 波: 'ha', 羅: 'ra', 蜜: 'mi', 多: 'ta',
};

/**
 * Context-scoped binding overrides, keyed by segment id then cleaned token. They
 * fix homograph collisions where a bare surface form means different concepts in
 * different lines — a global BIND key can't tell them apart:
 *   滅  = "cease" (anirodha) in 不生不滅 BUT "cessation" (nirodha, a Noble Truth) in 苦集滅道
 *   行  = caryā (practice) in the opening BUT the saṃskāra aggregate in 受想行識
 *   རིག = vidyā standing alone BUT "ignorance" inside མ་རིག་པ (ma-rig-pa)
 * An empty array means "deliberately unbound in this line" — a verb or particle
 * that carries no concept here (the verb 知 / jñātavyaṃ "to know" ≠ the noun jñāna;
 * "cognition" = vijñāna, not jñāna; interpretive "practicing" with no caryā in the
 * source). Distinct from "not aligned yet". Consulted before BIND / EN_BIND.
 */
export const SEGMENT_BIND: Record<string, Record<string, string[]>> = {
  // ── existing homograph fixes ──────────────────────────────────────────────
  'middle-no-four-truths': {
    '滅': ['concept.four-truths'],            // 苦集滅道: cessation = nirodha truth
    source: ['concept.four-truths'],          // Red Pine's samudaya rendering
    relief: ['concept.four-truths'],          // Red Pine's nirodha rendering
    end: ['concept.four-truths'],             // Thich Nhat Hanh's nirodha rendering
  },
  'middle-no-other-skandhas': { '行': ['concept.skandha-aggregate'] },
  'middle-no-ignorance': { 'རིག': ['concept.ignorance-avidya'] },
  'mantra-therefore-know': { '知': [], 'jñātavyaṃ': [] },
  // cognition = vijñāna/manas (sixth faculty), not jñāna — bind to six-faculties
  'middle-no-dhatus': {
    cognition: ['concept.six-faculties'],
    world: ['concept.realm-dhatu'],           // Sariputta Ambedkar's dhātu rendering
    organs: ['concept.six-faculties'],        // Thich Nhat Hanh "six Sense Organs"
  },
  'middle-because-no-attainment': { practicing: [] },
  // ── new witness-specific overrides from English alignment audit ───────────
  // In "no birth and no death" context, "death" = anirodha (not jarāmaraṇa)
  'middle-no-arise-no-cease': {
    death: ['concept.unarisen-anutpada'],     // Thich Nhat Hanh + Sariputta Ambedkar
    stopped: ['concept.unarisen-anutpada'],   // Conze (1958)
    produced: ['concept.unarisen-anutpada'],  // Conze (1958) "not produced"
  },
  // The sixth sense-object (dharmas / mental objects) expressed as "thought" / "objects"
  'middle-no-six-objects': {
    objects: ['concept.dharma-phenomena'],    // Conze + Bodhi Sangha
    object: ['concept.dharma-phenomena'],     // Thich Nhat Hanh "Object of Mind"
    thought: ['concept.dharma-phenomena'],    // MAPLE + Red Pine
  },
  // Inverted-view paraphrases across all five witnesses
  'result-far-from-inversion': {
    overcome: ['concept.inverted-view-viparyasa'],  // Conze (1958)
    distorted: ['concept.inverted-view-viparyasa'], // Red Pine (2004)
    wrong: ['concept.inverted-view-viparyasa'],     // Thich Nhat Hanh (2014)
    delusive: ['concept.inverted-view-viparyasa'],  // Bodhi Sangha
    deluded: ['concept.inverted-view-viparyasa'],   // Sariputta Ambedkar
  },
  // Sariputta splits svabhāva into two tokens "own" + "being"
  'opening-seeing': {
    own: ['concept.svabhava-own-being'],
    being: ['concept.svabhava-own-being'],
  },
  // "knowledge" in the mantra titles = vidyā (the spell), not jñāna
  'mantra-great-knowledge': {
    knowledge: ['concept.mantra-vidya'],
  },
  // past/present/future = the three times (tryadhva)
  'buddhas-all-three-times': {
    past: ['concept.three-times-tryadhva'],
    present: ['concept.three-times-tryadhva'],
    future: ['concept.three-times-tryadhva'],
  },
  // Red Pine: "realize" = attain (prāpti); "Enlightenment" = unsurpassed bodhi
  'buddhas-attain-bodhi': {
    realize: ['concept.attainment-prapti'],
    enlightenment: ['concept.three-times-tryadhva'],
  },
  // Conze: "Perfection of Wisdom" → paramita + prajna
  'buddhas-rely-prajna': {
    perfection: ['concept.perfection-paramita'],
  },
  // Conze: "gone beyond" = pāramitā
  'opening-practice': {
    beyond: ['concept.perfection-paramita'],
  },
};

/**
 * Literal word-glosses for the connective tissue — words that carry meaning but
 * aren't aligned CONCEPTS (grammatical particles, pronouns, and content words the
 * concept graph doesn't elevate). So every word gives at least its plain meaning
 * on hover, not a blank. Keys: Sanskrit by lowercase IAST, Chinese by Han.
 * (Tibetan deferred — its rows split into syllable fragments, not words.)
 * These are standard dictionary meanings; review welcome — it's sacred text.
 */
export const WORD_GLOSS: Record<string, string> = {
  // ── Sanskrit (IAST, lowercase) ──
  na: 'not, no',
  ca: 'and',
  sma: '(narrative past particle)',
  iha: 'here',
  'pañca': 'five',
  'tāṃś': 'those (the aggregates)',
  pṛthak: 'separate, different',
  pṛthag: 'separate, different',
  yad: 'which, that',
  yā: 'which (f.)',
  'sā': 'that, she (f.)',
  tad: 'that',
  'amalā': 'stainless, undefiled',
  'vimalā': 'spotless, immaculate',
  'anūnā': 'not deficient, not lessened',
  'paripūrṇāḥ': 'complete, full',
  'tasmāc': 'therefore',
  'tasmād': 'therefore',
  'tasmāj': 'therefore',
  śabdo: 'sound',
  gandho: 'smell, odour',
  raso: 'taste, flavour',
  'spraṣṭavyaṃ': 'the tangible, what is touched',
  yāvan: 'up to, as far as',
  'nāstitvād': 'because of non-existence',
  'sarvabuddhāḥ': 'all Buddhas',
  'āśritya': 'relying on, depending on',
  'anuttarāṃ': 'unsurpassed, supreme',
  'samyaksaṃbodhim': 'perfect, complete awakening',
  'abhisaṃbuddhāḥ': 'fully awaken to, completely realise',
  'jñātavyaṃ': 'to be known, should be known',
  satyam: 'true, truth',
  'amithyatvāt': 'because it is not false',
  ukto: 'spoken, declared',
  'tadyathā': 'namely, that is to say',
  // ── Chinese (Han) ──
  時: 'time, when',
  五: 'five',
  皆: 'all, entirely',
  度: 'cross over, deliver',
  一切: 'all, everything',
  不: 'not, no',
  異: 'different, to differ',
  即: 'is precisely, namely',
  是: 'this; is',
  相: 'characteristic, mark, appearance',
  垢: 'defilement, impurity',
  淨: 'pure, clean',
  增: 'increase',
  減: 'decrease',
  是故: 'therefore',
  中: 'within, in the midst of',
  無: 'no, without; there is no',
  聲: 'sound',
  香: 'smell, fragrance',
  味: 'taste, flavour',
  觸: 'touch, the tangible',
  乃至: 'and so on, up to',
  亦: 'also, likewise',
  盡: 'exhaustion, end',
  以: 'by means of, because of',
  故: 'therefore, because',
  有: 'there is, to have',
  諸佛: 'all Buddhas',
  依: 'rely on, depend on',
  阿耨多羅: '(transliterates *anuttara*, "unsurpassed")',
  三藐三: '(transliterates *samyak-saṃ*, "perfect, complete")',
  菩提: '(transliterates *bodhi*, "awakening")',
  知: 'to know',
  能: 'can, is able to',
  除: 'remove, eliminate',
  真實: 'true, real',
  不虛: 'not false, not empty',
  說: 'speak, expound',
  曰: 'says (introduces a quotation)',
};
