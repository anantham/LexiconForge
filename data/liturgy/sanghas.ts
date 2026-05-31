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
    // Self-description, bodhizendo.org
    description: 'Zen training center in South India\'s Kodaikanal Hills.',
    location: 'Perumalmalai, Tamil Nadu, India',
    founded: 'c. 1996',
    url: 'https://bodhizendo.org',
  },
  maple: {
    slug: 'maple',
    name: 'MAPLE',
    fullName: 'Monastic Academy for the Preservation of Life on Earth',
    // Self-description, monasticacademy.org
    description: 'Buddhist training for a world in crisis.',
    location: 'Vermont, USA',
    founded: '2014',
    url: 'https://monasticacademy.org',
    schedule: [
      { time: '4:15 AM', event: 'Wake-up bell', icon: 'bell' },
      { time: '4:35 AM', event: 'Morning chanting in the zendo', icon: 'cushion' },
      { time: '', event: 'Morning Chants', chantSlug: 'morning-chants' },
      { time: '', event: 'Enmē Jikku Kannon Gyō', chantSlug: 'enmei-jikku-kannon-gyo' },
      { time: '', event: 'Sho Sai Myō Kichijō Darani', chantSlug: 'sho-sai-myo-kichijo-darani' },
      { time: '', event: 'Heart Sutra', chantSlug: 'heart-sutra' },
      { time: '7:30 AM', event: 'Breakfast', icon: 'meal' },
      { time: '', event: 'Metta Sutta (before the meal)', chantSlug: 'metta-sutta' },
      { time: '', event: 'Vows (after the meal)', chantSlug: 'vows' },
      { time: 'Meditation', event: 'Jade Method', chantSlug: 'jade-method' },
      { time: '12:00 PM', event: 'Lunch', icon: 'meal' },
      { time: '', event: 'Metta Sutta (before the meal)', chantSlug: 'metta-sutta' },
      { time: '', event: 'Vows (after the meal)', chantSlug: 'vows' },
      { time: 'Before sleep', event: 'Oṃ Maṇi Padme Hūṃ', icon: 'rest', chantSlug: 'om-mani-padme-hum' },
    ],
  },
  'sariputta-ambedkar': {
    slug: 'sariputta-ambedkar',
    name: 'Sariputta Ambedkar Monastery',
    // Description grounded in the community's chant sheets (chants/rinzai zen chants/):
    // its liturgy blends Theravāda Pali devotion with Rinzai Zen practice.
    // TODO(curator): fullName / location / founded / url unknown — fill from a
    // primary source rather than inferring.
    description:
      'A monastery whose daily liturgy weaves Theravāda Pali devotion — the refuges, the five precepts, the Itipiso recollections — together with Rinzai Zen practice: the Heart Sutra, the great dharanis, Hakuin\'s Song of Zazen, and the Teidai Dempo ancestral lineage.',
    primaryTradition: 'mixed',
  },
};

export const SANGHA_INDEX = Object.values(SANGHAS);

export function getSangha(slug: string): Sangha | undefined {
  return SANGHAS[slug];
}
