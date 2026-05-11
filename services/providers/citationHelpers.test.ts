import { describe, it, expect } from 'vitest';
import { citationIdFor, materializeCitation } from './citationHelpers';
import type { LexiconEntry } from './types';

describe('citationIdFor', () => {
  it('uses sourceId when present', () => {
    expect(citationIdFor('dpd', 'sati-1234', 'sati')).toBe('cite:dpd:sati-1234');
  });

  it('falls back to query when sourceId is missing', () => {
    expect(citationIdFor('sc-dictionary-full', undefined, 'sati')).toBe('cite:sc-dictionary-full:q:sati');
  });

  it('falls back to query when sourceId is empty string', () => {
    expect(citationIdFor('vri-attha', '', 'mn10:1.1')).toBe('cite:vri-attha:q:mn10:1.1');
  });

  it('is deterministic across calls', () => {
    const a = citationIdFor('dpd', 'kaya-12', 'kāya');
    const b = citationIdFor('dpd', 'kaya-12', 'kāya');
    expect(a).toBe(b);
  });

  it('produces distinct ids for different providers with the same sourceId', () => {
    expect(citationIdFor('dpd', 'sati', 'sati')).not.toBe(citationIdFor('ped-dsal', 'sati', 'sati'));
  });
});

describe('materializeCitation', () => {
  const providerLicense = 'CC BY-NC-SA 4.0';
  const providerLabel = 'DPD';

  it('mints a Citation with deterministic id from sourceId', () => {
    const response: LexiconEntry = {
      lemma: 'sati',
      sourceId: 'dpd:sati-12',
      senses: [{ english: 'mindfulness' }],
      rawExcerpt: 'sati, f. mindfulness, awareness, attention; memory.',
    };
    const citation = materializeCitation('dpd', providerLabel, providerLicense, response, 'sati', { fetchedAt: '2026-05-11' });
    expect(citation.id).toBe('cite:dpd:dpd:sati-12');
    expect(citation.provenance).toBe('dpd');
    expect(citation.query).toBe('sati');
    expect(citation.excerpt).toContain('mindfulness');
    expect(citation.license).toBe(providerLicense);
    expect(citation.fetchedAt).toBe('2026-05-11');
    expect(citation.short).toBe('DPD s.v. sati');
  });

  it('uses the provider-supplied citationId verbatim when present', () => {
    const response: LexiconEntry = {
      lemma: 'kāya',
      sourceId: 'kaya-99',
      citationId: 'cite:custom:override',
      senses: [],
    };
    const citation = materializeCitation('dpd', providerLabel, providerLicense, response, 'kāya');
    expect(citation.id).toBe('cite:custom:override');
  });

  it('falls back to query-based id when sourceId is missing', () => {
    const response: LexiconEntry = { lemma: 'me', senses: [] };
    const citation = materializeCitation('sc-dictionary-full', 'SC', 'mixed', response, 'me');
    expect(citation.id).toBe('cite:sc-dictionary-full:q:me');
  });

  it('honours overrides for short, url, and license', () => {
    const response: LexiconEntry = { lemma: 'sati', sourceId: 'x', senses: [] };
    const citation = materializeCitation('dpd', 'DPD', 'CC BY-NC-SA', response, 'sati', {
      short: 'DPD entry 1234',
      url: 'https://dpdict.example/sati',
      license: 'public domain',
      fetchedAt: '2026-05-11',
    });
    expect(citation.short).toBe('DPD entry 1234');
    expect(citation.url).toBe('https://dpdict.example/sati');
    expect(citation.license).toBe('public domain');
  });

  it('defaults fetchedAt to today (YYYY-MM-DD)', () => {
    const response: LexiconEntry = { lemma: 'sati', sourceId: 'x', senses: [] };
    const citation = materializeCitation('dpd', 'DPD', 'CC BY-NC-SA', response, 'sati');
    expect(citation.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('omits url when no override is provided', () => {
    const response: LexiconEntry = { lemma: 'sati', sourceId: 'x', senses: [] };
    const citation = materializeCitation('dpd', 'DPD', 'CC BY-NC-SA', response, 'sati');
    expect(citation.url).toBeUndefined();
  });
});
