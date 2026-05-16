/**
 * Sangha registry — the communities whose chants live in this reader.
 *
 * Each LiturgyDoc carries a `sangha` field that references one of these
 * by slug. New sanghas are added by appending an entry here and tagging
 * the relevant LiturgyDocs.
 *
 * Browse order: docs are listed within a sangha by their position in
 * data/liturgy/index.ts; sanghas are listed here in chronological order
 * of founding (oldest first) so historical lineages anchor first when
 * the index grows.
 */

import type { Sangha } from '../../types/liturgy';

export const SANGHAS: Record<string, Sangha> = {
  'bodhi-sangha': {
    slug: 'bodhi-sangha',
    name: 'Bodhi Sangha',
    fullName: 'Bodhi Sangha (Bodhi Zendo)',
    description:
      'Rinzai-Soto Zen sangha founded by AMA Samy in Tamil Nadu, India, drawing from Yamada Roshi\'s Sanbo Kyodan lineage. Chant book mixes Japanese-Zen liturgy (Hakuin, Torei, Dogen) with Pali Theravāda framing.',
    location: 'Perumalmalai, Tamil Nadu, India',
    founded: 'c. 1996',
    url: 'https://bodhizendo.org',
    primaryTradition: 'zen',
  },
  maple: {
    slug: 'maple',
    name: 'MAPLE',
    fullName: 'Monastic Academy for the Preservation of Life on Earth',
    description:
      'Contemporary monastic training centre led by Soryu Forall. Practice draws from Theravāda (morning chants), Vajrayāna (evening mantra), and Mahāyāna (Heart Sutra) — plus original MAPLE-composed practice texts (Jade Method).',
    location: 'Vermont, USA',
    founded: '2014',
    url: 'https://monasticacademy.org',
    primaryTradition: 'mixed',
    schedule: [
      { time: '4:15 AM', event: 'Wake-up bell', icon: 'bell' },
      { time: '4:35 AM', event: 'Morning chanting in the zendo', icon: 'cushion' },
      { time: '', event: 'Morning Chants', chantSlug: 'morning-chants' },
      { time: '', event: 'Enmē Jikku Kannon Gyō', chantSlug: 'enmei-jikku-kannon-gyo' },
      { time: '', event: 'Sho Sai Myō Kichijō Darani', chantSlug: 'sho-sai-myo-kichijo-darani' },
      { time: '', event: 'Heart Sutra', chantSlug: 'heart-sutra' },
      { time: 'Meditation', event: 'Jade Method', chantSlug: 'jade-method' },
      { time: 'Evening', event: 'Oṃ Maṇi Padme Hūṃ — before sleep', icon: 'rest', chantSlug: 'om-mani-padme-hum' },
    ],
  },
};

export const SANGHA_INDEX = Object.values(SANGHAS);

export function getSangha(slug: string): Sangha | undefined {
  return SANGHAS[slug];
}
