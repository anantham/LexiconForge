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

import type { LiturgyDoc } from '../../types/liturgy';
import morningChants from './morning-chants';
import enmeiJikkuKannonGyo from './enmei-jikku-kannon-gyo';
import shoSaiMyoKichijoDarani from './sho-sai-myo-kichijo-darani';
import heartSutra from './heart-sutra';
import bodhicittaDedication from './bodhicitta-dedication';
import jadeMethod from './jade-method';
import omManiPadmeHum from './om-mani-padme-hum';

const ALL_DOCS: LiturgyDoc[] = [
  morningChants,
  enmeiJikkuKannonGyo,
  shoSaiMyoKichijoDarani,
  heartSutra,
  bodhicittaDedication,
  jadeMethod,
  omManiPadmeHum,
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
