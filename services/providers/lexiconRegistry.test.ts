import { describe, it, expect, vi } from 'vitest';
import { LexiconProviderRegistry, mergeLexiconEntries } from './lexiconRegistry';
import type { LexiconEntry, LexiconProvider } from './types';

const makeProvider = (
  id: LexiconProvider['id'],
  entries: LexiconEntry[],
  opts: { throws?: boolean; latencyMs?: number } = {},
): LexiconProvider => ({
  id,
  label: `provider:${id}`,
  license: 'test-license',
  lookup: vi.fn(async () => {
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
    if (opts.throws) throw new Error('simulated provider failure');
    return entries;
  }),
});

describe('mergeLexiconEntries', () => {
  it('preserves per-provider entries in entriesBySource', () => {
    const dpdEntry: LexiconEntry = { lemma: 'sati', sourceId: 'dpd:1', senses: [{ english: 'mindfulness' }] };
    const scEntry: LexiconEntry = { lemma: 'sati', sourceId: 'sc:1', senses: [{ english: 'memory' }] };
    const merged = mergeLexiconEntries('sati', [
      { providerId: 'dpd', entries: [dpdEntry] },
      { providerId: 'sc-dictionary-full', entries: [scEntry] },
    ]);
    expect(merged.entriesBySource.dpd).toEqual([dpdEntry]);
    expect(merged.entriesBySource['sc-dictionary-full']).toEqual([scEntry]);
    expect(merged.allEntries).toHaveLength(2);
    expect(merged.hasAny).toBe(true);
    expect(merged.respondingProviders).toEqual(['dpd', 'sc-dictionary-full']);
  });

  it('omits providers that returned no entries', () => {
    const merged = mergeLexiconEntries('obscure-lemma', [
      { providerId: 'dpd', entries: [] },
      { providerId: 'sc-dictionary-full', entries: [] },
    ]);
    expect(merged.hasAny).toBe(false);
    expect(merged.allEntries).toHaveLength(0);
    expect(merged.respondingProviders).toEqual([]);
    expect(merged.entriesBySource).toEqual({});
  });

  it('preserves registration order in allEntries', () => {
    const a: LexiconEntry = { lemma: 'x', sourceId: 'a', senses: [] };
    const b: LexiconEntry = { lemma: 'x', sourceId: 'b', senses: [] };
    const merged = mergeLexiconEntries('x', [
      { providerId: 'dpd', entries: [a] },
      { providerId: 'sc-dictionary-full', entries: [b] },
    ]);
    expect(merged.allEntries.map((e) => e.sourceId)).toEqual(['a', 'b']);
  });
});

describe('LexiconProviderRegistry', () => {
  it('runs providers in parallel and merges responses', async () => {
    const registry = new LexiconProviderRegistry()
      .register(makeProvider('dpd', [{ lemma: 'sati', sourceId: 'dpd:1', senses: [{ english: 'mindfulness' }] }]))
      .register(makeProvider('sc-dictionary-full', [{ lemma: 'sati', sourceId: 'sc:1', senses: [{ english: 'memory' }] }]));
    const merged = await registry.lookup('sati');
    expect(merged.hasAny).toBe(true);
    expect(merged.respondingProviders).toEqual(['dpd', 'sc-dictionary-full']);
    expect(merged.allEntries).toHaveLength(2);
  });

  it('isolates one provider failure from the others', async () => {
    const registry = new LexiconProviderRegistry()
      .register(makeProvider('dpd', [{ lemma: 'sati', sourceId: 'dpd:1', senses: [] }]))
      .register(makeProvider('sc-dictionary-full', [], { throws: true }));
    const merged = await registry.lookup('sati');
    expect(merged.respondingProviders).toEqual(['dpd']);
    expect(merged.entriesBySource['sc-dictionary-full']).toBeUndefined();
    expect(merged.hasAny).toBe(true);
  });

  it('returns an empty MergedLexiconLookup when no provider answers', async () => {
    const registry = new LexiconProviderRegistry()
      .register(makeProvider('dpd', [], { throws: true }))
      .register(makeProvider('sc-dictionary-full', []));
    const merged = await registry.lookup('nothing');
    expect(merged.hasAny).toBe(false);
    expect(merged.allEntries).toEqual([]);
  });

  it('rejects duplicate provider registration', () => {
    const registry = new LexiconProviderRegistry()
      .register(makeProvider('dpd', []));
    expect(() => registry.register(makeProvider('dpd', []))).toThrow(/already registered/);
  });

  it('exposes registered providers via list() in registration order', () => {
    const registry = new LexiconProviderRegistry()
      .register(makeProvider('dpd', []))
      .register(makeProvider('sc-dictionary-full', []));
    expect(registry.list().map((p) => p.id)).toEqual(['dpd', 'sc-dictionary-full']);
  });
});
