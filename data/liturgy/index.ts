/**
 * Liturgy registry — all chants in the reader, indexed by `<sangha>/<slug>`.
 *
 * Hand-curated. Add a new chant by writing a `<slug>.ts` file that
 * default-exports a `LiturgyDoc` (with its `sangha` set to a registered
 * Sangha slug), then importing + registering it here.
 *
 * No automated generation. Each chant is its own kind of thing and
 * deserves its own curation pass (Pluralism, Live Machinery principle 5).
 *
 * Routing model: `/liturgy` (sangha picker) → `/liturgy/<sangha>` (that
 * sangha's chants) → `/liturgy/<sangha>/<slug>` (one chant). Slugs are
 * unique within a sangha but can repeat across sanghas (Heart Sutra
 * appears under MAPLE and Bodhi Sangha as separate docs with distinct
 * English witnesses).
 */

import type { CommunityChant, LiturgyDoc } from '../../types/liturgy';
import { resolveAll } from './resolve';
import morningChants from './morning-chants';
import enmeiJikkuKannonGyo from './enmei-jikku-kannon-gyo';
import shoSaiMyoKichijoDarani from './sho-sai-myo-kichijo-darani';
import heartSutra from './heart-sutra';
import mettaSutta from './metta-sutta';
import vows from './vows';
import bodhicittaDedication from './bodhicitta-dedication';
import jadeMethod from './jade-method';
import omManiPadmeHum from './om-mani-padme-hum';
// Bodhi Sangha
import tiSarana from './ti-sarana';
import bodhiVows from './bodhi-vows';
import bodhiHeartSutra from './bodhi-heart-sutra';
import bodhiEnmeiJikkuKannonGyo from './bodhi-enmei-jikku-kannon-gyo';
import shinJinNoMei from './shin-jin-no-mei';
import hokyoZanmai from './hokyo-zanmai';
import precepts from './precepts';
import bodhisattvaVowTorei from './bodhisattva-vow-torei';
import songOfZazen from './song-of-zazen';
import wayOfCompassion from './way-of-compassion';
import dedicationAndEveningCall from './dedication-and-evening-call';

/**
 * Community chants — multiple sanghas chanting the same chant (same
 * `contentId`). The resolver pools their English witnesses (keyed by segment
 * `phraseId`) so each sangha's page can cycle every community's translation
 * while leading with its own. The resolved render views slot into ALL_DOCS
 * at the same positions their source files used to occupy, so the flat index
 * order is unchanged. See docs/sutta-studio/COMMUNITY_CHANT_MODEL.md.
 */
export const COMMUNITY_CHANTS: CommunityChant[] = [
  enmeiJikkuKannonGyo, // maple
  bodhiEnmeiJikkuKannonGyo, // bodhi-sangha
];
const [enmeiMapleDoc, enmeiBodhiDoc] = resolveAll(COMMUNITY_CHANTS);

const ALL_DOCS: LiturgyDoc[] = [
  morningChants,
  enmeiMapleDoc,
  shoSaiMyoKichijoDarani,
  heartSutra,
  mettaSutta,
  vows,
  bodhicittaDedication,
  jadeMethod,
  omManiPadmeHum,
  // Bodhi Sangha
  tiSarana,
  bodhiVows,
  bodhiHeartSutra,
  enmeiBodhiDoc,
  shinJinNoMei,
  hokyoZanmai,
  precepts,
  bodhisattvaVowTorei,
  songOfZazen,
  wayOfCompassion,
  dedicationAndEveningCall,
];

/**
 * Doc grouping: `LITURGY_DOCS_BY_SANGHA['maple']['heart-sutra']` resolves
 * to the chant. Built once from the doc list.
 */
export const LITURGY_DOCS_BY_SANGHA: Record<string, Record<string, LiturgyDoc>> = (() => {
  const out: Record<string, Record<string, LiturgyDoc>> = {};
  for (const doc of ALL_DOCS) {
    if (!out[doc.sangha]) out[doc.sangha] = {};
    out[doc.sangha][doc.slug] = doc;
  }
  return out;
})();

/** Flat list of every chant index entry across all sanghas. */
export const LITURGY_INDEX = ALL_DOCS.map((doc) => ({
  slug: doc.slug,
  sangha: doc.sangha,
  title: doc.title,
  subtitle: doc.subtitle,
  tradition: doc.tradition,
  context: doc.context,
}));

/**
 * All chants belonging to a sangha, sorted by `order` if present (lower
 * comes first), then by registration order as a stable fallback. So a
 * sangha\'s morning service flows in the order it\'s actually chanted.
 */
export function liturgyDocsForSangha(sangha: string): LiturgyDoc[] {
  return ALL_DOCS.filter((d) => d.sangha === sangha).sort((a, b) => {
    const ao = a.order ?? Infinity;
    const bo = b.order ?? Infinity;
    return ao - bo;
  });
}

/** Lookup one chant by sangha slug + chant slug. */
export function getLiturgyDoc(sangha: string, slug: string): LiturgyDoc | undefined {
  return LITURGY_DOCS_BY_SANGHA[sangha]?.[slug];
}
