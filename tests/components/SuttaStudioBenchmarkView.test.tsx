import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuttaStudioBenchmarkView } from '../../components/bench/SuttaStudioBenchmarkView';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import leaderboard from '../../public/benchmarks/sutta-studio-leaderboard.json';
import type { CompareArtifact } from '../../scripts/sutta-studio/publish-compare';

const comparison: CompareArtifact = {
  model: leaderboard.entries[0].modelId,
  run: 'synthetic-run',
  scoreProvenance: { rubricVersion: '2.2', verifiedAgainst: 'quality-scores.json' },
  phases: [{
    phaseId: 'phase-1', pali: 'synthetic pali', goldenWordCount: 1, modelWordCount: 1,
    scores: { rubricVersion: '2.2', segF1: 1, contentF1: 1, contentPrecision: 1, contentRecall: 1, semantic: 1, coverage: 1, overall: 1, textIntegrity: 1 },
    words: [{
      surface: 'synthetic-word',
      golden: { seg: 'synthetic·word', tips: ['Reference tooltip'], senses: ['meaning'] },
      model: { seg: 'synthetic·word', tips: ['Model tooltip'], senses: ['meaning'], segMatch: true },
      tokens: { matched: ['meaning'], modelOnly: [], goldenOnly: [], f1: 1 },
      judge: { score: 1, verdict: 'faithful', hallucination: false, rationale: 'Same meaning.' },
    }],
    unmatched: [],
  }],
};
const json = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

describe('SuttaStudioBenchmarkView typed artifacts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async input => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/compare/')) return json(comparison);
      if (url.includes('leaderboard.json')) return json(leaderboard);
      if (url.includes('/index.json')) return json({
        generatedAt: '2026-10-24T00:00:00Z',
        entries: [{ id: 'golden', kind: 'golden', timestamp: '2026-10-24T00:00:00Z', runId: 'golden', path: '/golden.json' }],
      });
      if (url.includes('active-run.json')) return new Response('', { status: 404 });
      throw new Error(`Unexpected fixture URL: ${url}`);
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('renders published leaderboard fields and the writer-shaped word comparison', async () => {
    render(<SuttaStudioBenchmarkView />);
    await screen.findByText(leaderboard.entries[0].modelName);
    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
    expect(await screen.findByText('Reference tooltip')).toBeInTheDocument();
    expect(screen.getByText('Model tooltip')).toBeInTheDocument();
    expect(screen.getByText('Same meaning.')).toBeInTheDocument();
  });

  it('shows the golden word surface reconstructed from its typed segments', async () => {
    render(<SuttaStudioBenchmarkView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run Inspector' }));
    const selectors = screen.getAllByRole('combobox');
    const passSelector = selectors.find(select => select.querySelector('option[value="anatomist"]'));
    expect(passSelector).toBeDefined();
    fireEvent.change(passSelector!, { target: { value: 'anatomist' } });
    const word = DEMO_PACKET_MN10.phases[0].paliWords[0];
    const surface = word.segments.map(segment => segment.text).join('');
    expect(surface.length).toBeGreaterThan(0);
    expect(await screen.findByText(`${word.id}: ${surface} (${word.wordClass}) → ${word.segments.length} segs`)).toBeInTheDocument();
  });
});
