/**
 * Build extra tooltip facets from concept IDs. Each facet is a single
 * short string the renderer can show as a separate facet in the
 * click-to-cycle tooltip (mn10 pattern — see
 * `components/sutta-studio/Tooltip.tsx`).
 *
 * Why facets, not concatenation: jamming morpheme-gloss + concept-def
 * into one tooltip line crowds the gloss out. Facets let the reader
 * peek at the morpheme reading first, then click for "what concept is
 * this *member of*" and see the registry-grounded definition.
 *
 * One concept = one facet. The first sentence of the concept's
 * `definition` is used (definitions can run several sentences; only the
 * first carries the load-bearing claim — citations + the rest live in
 * the audit panel).
 */

import { getConcept } from './lookup';

/** Extract the first sentence of a multi-sentence string, trimmed. */
function firstSentence(text: string): string {
  if (!text) return '';
  // Match up to first .!? (with an optional closing quote, so `"Self-nature."`
  // ends the sentence rather than spilling into the next, scholarly one)
  // followed by space-or-EOL. Fall back to the whole string when absent.
  const m = text.match(/^(.+?[.!?]["”'’]?)(?:\s|$)/);
  return (m ? m[1] : text).trim();
}

/**
 * Returns one facet string per concept. Empty array when no concepts
 * resolve. Facets are formatted as:
 *
 *   `◇ <preferredLabel> · <first sentence of definition>`
 *
 * The `◇` glyph signals "this is a concept facet, not a surface gloss."
 */
export function conceptFacets(conceptIds: string[] | undefined): string[] {
  if (!conceptIds || conceptIds.length === 0) return [];
  const single = conceptIds.length === 1;
  const out: string[] = [];
  for (const id of conceptIds) {
    const concept = getConcept(id);
    if (!concept) continue;
    const label = concept.preferredLabel ?? id;
    const def = firstSentence(concept.definition ?? '');
    if (single) {
      // The hover gloss (facet 0) already shows the label; the sense facet adds
      // only the definition — restating the label here is the redundancy.
      if (def) out.push(`◇ ${def}`);
    } else {
      // Several concepts on one token — keep the label so the reader knows which.
      out.push(def ? `◇ ${label} · ${def}` : `◇ ${label}`);
    }
  }
  return out;
}
