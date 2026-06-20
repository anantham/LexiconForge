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
  // mind-states near the end
  attainment: ['concept.attainment-prapti'],
  attain: ['concept.attainment-prapti'],
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
  'middle-no-four-truths': { '滅': ['concept.four-truths'] },
  'middle-no-other-skandhas': { '行': ['concept.skandha-aggregate'] },
  'middle-no-ignorance': { 'རིག': ['concept.ignorance-avidya'] },
  'mantra-therefore-know': { '知': [], 'jñātavyaṃ': [] },
  'middle-no-dhatus': { cognition: [] },
  'middle-because-no-attainment': { practicing: [] },
};
