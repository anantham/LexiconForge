import type { LiturgyDoc } from '../../types/liturgy';

export const threeRefugesGeneratedDraft: LiturgyDoc = {
  "slug": "three-refuges-generated-draft",
  "sangha": "bodhi-sangha",
  "title": "Three Refuges",
  "subtitle": "Generated draft from the liturgy generator pilot",
  "tradition": "theravada",
  "context": "Bodhi Sangha's Pali Threefold Refuge formula, used here as the first real structured-packet pilot for generated chant sheets.",
  "sources": {
    "canonical": [
      {
        "label": "Khp 1 (Saraṇagamana)",
        "url": "https://suttacentral.net/kp1/en/sujato"
      }
    ],
    "ritual": [
      {
        "label": "Bodhi Sangha Sutras booklet (May 2016)",
        "url": "https://bodhizendo.org"
      }
    ]
  },
  "curator": "Generated draft by the liturgy generator pilot. Source wording follows the Bodhi Sangha booklet; alignment was inferred from structured word data plus explicit idiom hints for the English phrase \"take refuge\".",
  "sections": [
    {
      "id": "three-refuges",
      "shape": "triple-script-witness",
      "repetitions": 3,
      "large": true,
      "commentary": "The formula repeats with one substitution: Buddha, Dhamma, Sangha. The generated alignment should preserve that rhythm without hand-authored alignTo arrays.",
      "segments": [
        {
          "id": "buddha-refuge",
          "pali": "Buddhaṁ saraṇaṁ gacchāmi.",
          "paliDeva": "बुद्धं सरणं गच्छामि।",
          "witnesses": [
            {
              "by": "Bodhi Sangha",
              "text": "I take refuge in the Buddha.",
              "license": "Bodhi Sangha booklet (Notes)",
              "alignTo": [
                2,
                1,
                1,
                -1,
                -1,
                0
              ],
              "morphemeAlignTo": [
                1,
                0,
                0,
                null,
                null,
                0
              ]
            }
          ],
          "words": [
            {
              "form": "Buddhaṁ",
              "scriptAlt": "बुद्धं",
              "pronunciation": "BUD-dahng",
              "accent": "amber",
              "etymology": "from the root meaning \"to wake up\"",
              "gloss": "the Awakened One",
              "morphemes": [
                {
                  "text": "Buddha",
                  "type": "stem",
                  "gloss": "awakened"
                },
                {
                  "text": "ṁ",
                  "type": "suffix",
                  "gloss": "the chanted nasal close"
                }
              ]
            },
            {
              "form": "saraṇaṁ",
              "scriptAlt": "सरणं",
              "pronunciation": "SAH-rah-nahng",
              "gloss": "refuge, shelter",
              "morphemes": [
                {
                  "text": "saraṇa",
                  "type": "stem",
                  "gloss": "refuge, shelter"
                },
                {
                  "text": "ṁ",
                  "type": "suffix",
                  "gloss": "the chanted nasal close"
                }
              ]
            },
            {
              "form": "gacchāmi",
              "scriptAlt": "गच्छामि",
              "pronunciation": "gahch-CHAH-mee",
              "etymology": "from the verb meaning \"to go\"",
              "gloss": "I go",
              "morphemes": [
                {
                  "text": "gacchā",
                  "type": "stem",
                  "gloss": "go"
                },
                {
                  "text": "mi",
                  "type": "suffix",
                  "gloss": "I"
                }
              ]
            }
          ]
        },
        {
          "id": "dhamma-refuge",
          "pali": "Dhammaṁ saraṇaṁ gacchāmi.",
          "paliDeva": "धम्मं सरणं गच्छामि।",
          "witnesses": [
            {
              "by": "Bodhi Sangha",
              "text": "I take refuge in the Dharma.",
              "license": "Bodhi Sangha booklet (Notes)",
              "alignTo": [
                2,
                1,
                1,
                -1,
                -1,
                0
              ],
              "morphemeAlignTo": [
                1,
                0,
                0,
                null,
                null,
                0
              ]
            }
          ],
          "words": [
            {
              "form": "Dhammaṁ",
              "scriptAlt": "धम्मं",
              "pronunciation": "DHAHM-mahng",
              "accent": "sky",
              "etymology": "from a root meaning \"to hold, support\"",
              "gloss": "the Dharma, the teaching and the way things are",
              "morphemes": [
                {
                  "text": "Dhamma",
                  "type": "stem",
                  "gloss": "Dharma, teaching"
                },
                {
                  "text": "ṁ",
                  "type": "suffix",
                  "gloss": "the chanted nasal close"
                }
              ]
            },
            {
              "form": "saraṇaṁ",
              "scriptAlt": "सरणं",
              "pronunciation": "SAH-rah-nahng",
              "gloss": "refuge, shelter",
              "morphemes": [
                {
                  "text": "saraṇa",
                  "type": "stem",
                  "gloss": "refuge, shelter"
                },
                {
                  "text": "ṁ",
                  "type": "suffix",
                  "gloss": "the chanted nasal close"
                }
              ]
            },
            {
              "form": "gacchāmi",
              "scriptAlt": "गच्छामि",
              "pronunciation": "gahch-CHAH-mee",
              "etymology": "from the verb meaning \"to go\"",
              "gloss": "I go",
              "morphemes": [
                {
                  "text": "gacchā",
                  "type": "stem",
                  "gloss": "go"
                },
                {
                  "text": "mi",
                  "type": "suffix",
                  "gloss": "I"
                }
              ]
            }
          ]
        },
        {
          "id": "sangha-refuge",
          "pali": "Saṅghaṁ saraṇaṁ gacchāmi.",
          "paliDeva": "सङ्घं सरणं गच्छामि।",
          "witnesses": [
            {
              "by": "Bodhi Sangha",
              "text": "I take refuge in the Sangha.",
              "license": "Bodhi Sangha booklet (Notes)",
              "alignTo": [
                2,
                1,
                1,
                -1,
                -1,
                0
              ],
              "morphemeAlignTo": [
                1,
                0,
                0,
                null,
                null,
                0
              ]
            }
          ],
          "words": [
            {
              "form": "Saṅghaṁ",
              "scriptAlt": "सङ्घं",
              "pronunciation": "SUNG-hahng",
              "accent": "rose",
              "gloss": "the Sangha, the community of practitioners",
              "morphemes": [
                {
                  "text": "Saṅgha",
                  "type": "stem",
                  "gloss": "Sangha, community"
                },
                {
                  "text": "ṁ",
                  "type": "suffix",
                  "gloss": "the chanted nasal close"
                }
              ]
            },
            {
              "form": "saraṇaṁ",
              "scriptAlt": "सरणं",
              "pronunciation": "SAH-rah-nahng",
              "gloss": "refuge, shelter",
              "morphemes": [
                {
                  "text": "saraṇa",
                  "type": "stem",
                  "gloss": "refuge, shelter"
                },
                {
                  "text": "ṁ",
                  "type": "suffix",
                  "gloss": "the chanted nasal close"
                }
              ]
            },
            {
              "form": "gacchāmi",
              "scriptAlt": "गच्छामि",
              "pronunciation": "gahch-CHAH-mee",
              "etymology": "from the verb meaning \"to go\"",
              "gloss": "I go",
              "morphemes": [
                {
                  "text": "gacchā",
                  "type": "stem",
                  "gloss": "go"
                },
                {
                  "text": "mi",
                  "type": "suffix",
                  "gloss": "I"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export default threeRefugesGeneratedDraft;
