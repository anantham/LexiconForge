/**
 * Italian lens tables — the curated knowledge the render(facts, lens) layer needs
 * that spaCy + Wiktionary don't give it. See docs/reader/LENSES.md.
 *
 * These are deliberately small, high-frequency, and extensible — the register
 * inversion is DEMONSTRATED, not exhaustively covered. Etymology-derived cognates
 * (from the kaikki Wiktionary dump) can widen COGNATES later; the shape stays.
 */

// COGNATE ANCHOR: Italian lemma -> the LEARNED English word that unlocks it.
// The everyday meaning comes from the gloss; this is the memory hook — register
// inversion (plain Italian = scholarly English). Value = cognate word(s) only.
export const COGNATES: Record<string, string> = {
  notte: 'nocturnal', giorno: 'diurnal', acqua: 'aquatic, aquarium', mare: 'marine, maritime',
  terra: 'terrain, terrestrial', cielo: 'celestial', sole: 'solar', luna: 'lunar', stella: 'stellar',
  vento: 'ventilate', luce: 'lucid, translucent', ombra: 'umbra, umbrella', fuoco: 'focus (Latin hearth)',
  pietra: 'petrify', albero: 'arboreal', fiore: 'floral, flora', pesce: 'Pisces', cane: 'canine',
  cavallo: 'cavalry', mano: 'manual, manage', occhio: 'ocular', bocca: 'buccal', dente: 'dental',
  capo: 'captain, capital', cuore: 'cordial, courage', sangue: 'sanguine', piede: 'pedal, pedestrian',
  morte: 'mortal', vita: 'vital, vitality', tempo: 'temporal, tempo', mondo: 'mundane',
  luogo: 'local, location', parola: 'parable, parole', voce: 'vocal', nome: 'nominal, nomenclature',
  libro: 'library', lettera: 'literate, literary', pagina: 'paginate', romanzo: 'romance',
  lettura: 'lecture', forte: 'fort, fortify', comodo: 'commodious, accommodate', vero: 'verify, veracity',
  leggere: 'legible, lecture', scrivere: 'scribe, describe', vedere: 'video, vision, evident',
  sentire: 'sentiment, sense', udire: 'audible, audio', sapere: 'sapient, savant', credere: 'credible, creed',
  pensare: 'pensive', parlare: 'parlor, parley', dire: 'dictate, diction', vedere2: '',
  guardare: 'regard, guard', aspettare: 'expect (spectare)', prendere: 'apprehend, prehensile',
  tenere: 'tenacious, contain', portare: 'portable, transport', correre: 'current, course',
  dormire: 'dormant, dormitory', bere: 'beverage, imbibe', venire: 'advent, convene', dare: 'donate, data',
  stare: 'station, stable, state', essere: 'essence, essential', volere: 'volition, voluntary',
  potere: 'potent, potential', dovere: 'due, duty', vivere: 'vivid, survive, revive',
  cominciare: 'commence', finire: 'finish, finite, final', continuare: 'continue',
  chiudere: 'close, seclude', aprire: 'aperture', muovere: 'move, motion, mobile',
  cambiare: 'change, exchange', posizione: 'position', pensiero: 'pensive', voglia: 'volition',
  attesa: 'await', esperienza: 'experience', straordinario: 'extraordinary', personale: 'personal',
  generale: 'general', conclusione: 'conclusion', avvenimento: 'advent, event', domani: '(cras →) procrastinate',
  fatica: 'fatigue', gambe: '', scarpa: '', freddo: 'frigid', caldo: 'caldron, scald', nuovo: 'novel, innovate',
};

// FALSE FRIENDS: lemma -> the warning. The reader would otherwise sail past these
// picturing the wrong scene — invisible damage, so this fires louder than a gloss.
export const FALSE_FRIENDS: Record<string, string> = {
  camera: "room / bedroom — NOT a photo camera",
  libreria: "bookshop or bookcase — NOT a library (that's biblioteca)",
  parente: "a relative — NOT a parent (that's genitore)",
  fattoria: "a farm — NOT a factory (that's fabbrica)",
  morbido: "soft — NOT morbid",
  caldo: "hot / warm — NOT cold",
  fabbrica: "a factory — NOT a fabric (that's tessuto)",
  educato: "polite, well-mannered — NOT educated (that's istruito)",
  sensibile: "sensitive — NOT sensible (that's ragionevole)",
  simpatico: "nice, likeable — NOT sympathetic",
  attualmente: "currently, now — NOT actually (that's in realtà)",
  eventualmente: "possibly, if need be — NOT eventually",
  noioso: "boring — NOT noisy",
  rumore: "noise — NOT rumour (that's diceria)",
  fame: "hunger — NOT fame (that's fama)",
  suggestione: "a suggestion's spell / evocative power — NOT a plain suggestion",
  confrontare: "to compare — NOT to confront",
  pretendere: "to demand, expect — NOT to pretend (that's fingere)",
  argomento: "topic, subject — NOT an argument (that's discussione)",
  fastidioso: "annoying — NOT fastidious",
  romanzo: "a novel — NOT romance (the feeling)",
  vero: "true / real — 'very' is a false echo; vero = veracity, not 'very'",
  triviale: "vulgar, crude — NOT trivial",
  magazzino: "warehouse, storeroom — NOT a magazine (that's rivista)",
  annoiare: "to bore — NOT to annoy",
};

// DERIVATIONAL SUFFIXES/PREFIXES: word-building = the vocabulary multiplier.
// Ordered; first match wins. Tested against the LEMMA (lowercased).
export const AFFIXES: { re: RegExp; note: string }[] = [
  { re: /tore$/, note: "·-tore = English -er (the one who does it)" },
  { re: /trice$/, note: "·-trice = -er (feminine agent)" },
  { re: /zione$/, note: "·-zione = English -tion" },
  { re: /sione$/, note: "·-sione = English -sion" },
  { re: /mente$/, note: "·-mente = English -ly (makes an adverb)" },
  { re: /ità$/, note: "·-ità = English -ity" },
  { re: /oso$/, note: "·-oso = -ous / full of" },
  { re: /evole$/, note: "·-evole = -able / -worthy" },
  { re: /issimo$/, note: "·-issimo = 'very / most' (superlative)" },
  { re: /ino$/, note: "·-ino = little (diminutive)" },
  { re: /etto$/, note: "·-etto = little (diminutive)" },
  { re: /ello$/, note: "·-ello = little (diminutive)" },
  { re: /one$/, note: "·-one = big (augmentative)" },
  { re: /accio$/, note: "·-accio = nasty (pejorative)" },
  { re: /eria$/, note: "·-eria = a shop / place (like -ery)" },
  { re: /aio$/, note: "·-aio = a trade / place" },
  // NOTE: no prefix rules (s-, ri-) — a bare regex false-fires on stare/sole/riva
  // etc. Prefix stripping needs real morphology; confident-wrong is worse than silent.
];
