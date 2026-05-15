/**
 * Liturgy registry — all chants in the reader, keyed by slug.
 *
 * Hand-curated. Add a new chant by writing a `<slug>.ts` file that
 * default-exports a `LiturgyDoc`, then importing + registering it here.
 *
 * No automated generation. Each chant is its own kind of thing and
 * deserves its own curation pass (Pluralism, Live Machinery principle 5).
 */

import type { LiturgyDoc } from '../../types/liturgy';
import morningChants from './morning-chants';

export const LITURGY_DOCS: Record<string, LiturgyDoc> = {
  [morningChants.slug]: morningChants,
};

export const LITURGY_INDEX = Object.values(LITURGY_DOCS).map((doc) => ({
  slug: doc.slug,
  title: doc.title,
  subtitle: doc.subtitle,
  tradition: doc.tradition,
  context: doc.context,
}));

export function getLiturgyDoc(slug: string): LiturgyDoc | undefined {
  return LITURGY_DOCS[slug];
}
