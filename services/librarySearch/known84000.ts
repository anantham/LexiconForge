/**
 * Curated map of canonical Buddhist text identifiers to 84000.co toh-IDs.
 *
 * Why this exists: 84000.co's public search API isn't available
 * (their /search endpoint returns 504 / is private), and the LLM-driven
 * fan-translation suggestion path hallucinates toh-IDs unreliably (probe
 * catches HTTP 404s but not "right URL, wrong text" — toh50 and toh21 both
 * return 200 OK, but only one is the Heart Sutra).
 *
 * Solution: hand-curated lookup table for the most-asked Mahayana sutras.
 * When the LLM resolves an identity (titleZh / titleEn / aliases) that
 * matches a known canonical name, we synthesise an authoritative 84000
 * candidate with the correct toh-ID — bypassing both the LLM's
 * hallucination risk and the probe's status-only verification.
 *
 * Maintenance:
 *   - Keys are lowercased for case-insensitive lookup
 *   - Multiple keys may map to the same toh-ID (English / Sanskrit /
 *     Chinese / Tibetan-translit aliases)
 *   - Add an entry only after manually verifying the toh-ID resolves to
 *     the right text on https://84000.co/translation/toh{N}
 *   - For texts with multiple Tibetan translations / multiple toh entries,
 *     pick the most-canonical / most-cited one
 */

export interface Known84000Entry {
  /** Canonical English title displayed on 84000's translation page */
  englishTitle: string;
  /** Tōhoku catalogue ID (without the "toh" prefix is the integer; we
   *  store the full url-tail like "toh21" or "toh1-1" for compounds) */
  tohId: string;
  /** Optional explanatory note for the disambiguation card */
  note?: string;
}

const ENTRIES: Array<Known84000Entry & { keys: string[] }> = [
  {
    englishTitle: 'The Heart of the Perfection of Wisdom, the Blessed Mother',
    tohId: 'toh21',
    note: 'Heart Sutra — short version, the most widely recited Prajñāpāramitā text in the Mahayana tradition.',
    keys: [
      'heart sutra',
      'heart sūtra',
      'prajñāpāramitāhṛdaya',
      'prajnaparamita hridaya',
      'prajñāpāramitā hṛdaya',
      'bhagavatī­prajñā­pāramitā­hṛdaya',
      '般若波羅蜜多心經',
      '心經',
      '心经',
      '般若心经',
      'shes rab kyi pha rol tu phyin pa\'i snying po',
    ],
  },
  {
    englishTitle: 'The Perfection of Wisdom in Eight Thousand Lines',
    tohId: 'toh12',
    note: 'Aṣṭasāhasrikā — the foundational Prajñāpāramitā in 8000 lines.',
    keys: [
      'aṣṭasāhasrikā',
      'aṣṭasāhasrikā prajñāpāramitā',
      'astasahasrika',
      'perfection of wisdom in eight thousand lines',
      '八千頌般若',
    ],
  },
  {
    englishTitle: 'The White Lotus of the Good Dharma Sutra',
    tohId: 'toh113',
    note: 'Lotus Sutra (Saddharmapuṇḍarīka) — central scripture of East Asian Mahayana traditions.',
    keys: [
      'lotus sutra',
      'lotus sūtra',
      'saddharmapuṇḍarīka',
      'saddharmapundarika',
      'white lotus of the good dharma',
      '妙法蓮華經',
      '法華經',
      '法华经',
      'dam pa\'i chos pad ma dkar po',
    ],
  },
  {
    englishTitle: 'The Teaching of Vimalakīrti',
    tohId: 'toh176',
    note: 'Vimalakīrtinirdeśa — popular Mahayana sutra featuring the lay bodhisattva Vimalakīrti.',
    keys: [
      'vimalakirti',
      'vimalakīrti',
      'vimalakirtinirdesa',
      'vimalakīrtinirdeśa',
      'teaching of vimalakirti',
      '維摩詰經',
      '維摩詰所說經',
      '维摩诘经',
      'dri ma med par grags pas bstan pa',
    ],
  },
  {
    englishTitle: 'The Display of the Pure Land of Sukhāvatī',
    tohId: 'toh115',
    note: 'Sukhāvatīvyūha (longer) — Pure Land core scripture; Tibetan recension.',
    keys: [
      'sukhāvatīvyūha',
      'sukhavativyuha',
      'longer sukhāvatīvyūha',
      'larger pure land sutra',
      'amitabha sutra',
      '無量壽經',
      '无量寿经',
    ],
  },
  {
    englishTitle: 'The Sutra on the Dhāraṇī of Avalokiteśvara with a Thousand Hands and a Thousand Eyes',
    tohId: 'toh691',
    note: 'Thousand-Armed Avalokiteśvara dhāraṇī.',
    keys: [
      'thousand-armed avalokitesvara',
      'great compassion dharani',
      '千手千眼觀世音菩薩廣大圓滿無礙大悲心陀羅尼經',
      '大悲咒',
    ],
  },
];

const KEY_TO_ENTRY: Map<string, Known84000Entry> = (() => {
  const m = new Map<string, Known84000Entry>();
  for (const entry of ENTRIES) {
    for (const key of entry.keys) {
      const normalised = key.toLowerCase().trim();
      if (normalised.length > 0) m.set(normalised, entry);
    }
  }
  return m;
})();

export interface IdentityForLookup {
  titleZh: string | null;
  titleEn: string | null;
  authorZh: string | null;
  aliases: string[];
}

/**
 * Look up a curated 84000 entry by trying every name in the resolved
 * identity (Chinese title, English title, alias list) against the known
 * key set. Case-insensitive, tolerant of leading/trailing whitespace.
 * Returns null if no match found.
 */
export function lookupKnown84000(identity: IdentityForLookup): Known84000Entry | null {
  const queries = [
    identity.titleZh,
    identity.titleEn,
    ...identity.aliases,
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((s) => s.toLowerCase().trim());

  for (const q of queries) {
    const hit = KEY_TO_ENTRY.get(q);
    if (hit) return hit;
  }
  return null;
}

export function build84000Url(tohId: string): string {
  return `https://84000.co/translation/${tohId}`;
}
