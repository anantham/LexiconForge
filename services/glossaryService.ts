/**
 * GlossaryService - Fetches and merges layered glossary files
 *
 * Resolution order: user (lowest) → genre → book (highest).
 * Later tiers override earlier ones for conflicting source terms.
 */

import type { GlossaryEntry } from '../types';

export interface GlossaryLayer {
  format: string;
  tier: 'user' | 'genre' | 'book';
  id?: string;
  inherits?: string[];
  entries: GlossaryEntry[];
}

export interface GlossaryLayerRef {
  tier: 'user' | 'genre' | 'book';
  id?: string;
  url: string;
}

/**
 * Merge glossary layers by tier priority: user → genre → book.
 * Book entries override genre, genre overrides user.
 * Within a tier, later entries override earlier ones.
 */
export const mergeGlossaryLayers = (
  userEntries: GlossaryEntry[],
  genreEntries: GlossaryEntry[],
  bookEntries: GlossaryEntry[]
): GlossaryEntry[] => {
  const merged = new Map<string, GlossaryEntry>();

  for (const e of userEntries) merged.set(e.source, e);
  for (const e of genreEntries) merged.set(e.source, e);
  for (const e of bookEntries) merged.set(e.source, e);

  return Array.from(merged.values());
};

export const mergeGlossaryEntries = (
  baseEntries: GlossaryEntry[],
  overrideEntries: GlossaryEntry[]
): GlossaryEntry[] => {
  const merged = new Map<string, GlossaryEntry>();

  for (const entry of baseEntries) {
    merged.set(entry.source, entry);
  }

  for (const entry of overrideEntries) {
    merged.set(entry.source, entry);
  }

  return Array.from(merged.values());
};

/**
 * Fetch a single glossary JSON from a URL.
 * Returns empty entries array on any failure (network, parse, etc).
 */
const fetchGlossaryLayer = async (url: string): Promise<GlossaryLayer | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[GlossaryService] Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (!data.entries || !Array.isArray(data.entries)) {
      console.warn(`[GlossaryService] Invalid glossary at ${url}: no entries array`);
      return null;
    }
    return data as GlossaryLayer;
  } catch (error) {
    console.warn(`[GlossaryService] Error fetching glossary from ${url}:`, error);
    return null;
  }
};

/**
 * Fetch all glossary layers from metadata refs and merge them.
 * Returns a flat array of GlossaryEntry[], ready to pass into AppSettings.glossary.
 */
export const fetchAndMergeGlossary = async (
  layerRefs: GlossaryLayerRef[]
): Promise<GlossaryEntry[]> => {
  if (!layerRefs.length) return [];

  const results = await Promise.all(
    layerRefs.map(ref => fetchGlossaryLayer(ref.url))
  );

  const byTier: Record<string, GlossaryEntry[]> = {
    user: [],
    genre: [],
    book: [],
  };

  for (let i = 0; i < layerRefs.length; i++) {
    const layer = results[i];
    if (layer) {
      byTier[layerRefs[i].tier] = layer.entries;
    }
  }

  return mergeGlossaryLayers(byTier.user, byTier.genre, byTier.book);
};
