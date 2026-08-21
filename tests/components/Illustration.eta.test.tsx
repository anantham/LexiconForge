import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Illustration from '../../components/Illustration';

const getAverageImageGenerationTime = vi.hoisted(() => vi.fn());

const storeState: Record<string, any> = {
  currentChapterId: 'chapter-1',
  getChapter: () => ({
    id: 'chapter-1',
    translationResult: {
      suggestedIllustrations: [{
        placementMarker: '[ILLUSTRATION-1]',
        imagePrompt: 'A riverboat at dusk',
      }],
    },
  }),
  generatedImages: {
    'chapter-1:[ILLUSTRATION-1]': { isLoading: true, data: null, error: null },
  },
  handleRetryImage: vi.fn(),
  updateIllustrationPrompt: vi.fn(),
  updateIllustrationPlan: vi.fn(),
  regenerateIllustrationPlanFromCaption: vi.fn(),
  steeringImages: {},
  setSteeringImage: vi.fn(),
  negativePrompts: {},
  setNegativePrompt: vi.fn(),
  guidanceScales: {},
  setGuidanceScale: vi.fn(),
  loraModels: {},
  setLoraModel: vi.fn(),
  loraStrengths: {},
  setLoraStrength: vi.fn(),
  settings: {
    imageModel: 'indrasnet/gen_anime',
    defaultNegativePrompt: '',
    defaultGuidanceScale: 3.5,
  },
  imageJobs: {},
  imageVersions: {},
  activeImageVersion: {},
  navigateToNextVersion: vi.fn(),
  navigateToPreviousVersion: vi.fn(),
  getVersionInfo: vi.fn(() => null),
  deleteVersion: vi.fn(),
};

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => selector(storeState)),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

vi.mock('../../services/apiMetricsService', () => ({
  apiMetricsService: { getAverageImageGenerationTime },
}));

vi.mock('../../hooks/useBlobUrl', () => ({
  useBlobUrl: () => null,
  isBase64DataUrl: () => false,
}));

vi.mock('../../components/AdvancedImageControls', () => ({ default: () => null }));
vi.mock('../../components/illustration/IllustrationPromptEditor', () => ({ default: () => null }));

describe('Illustration empirical ETA', () => {
  beforeEach(() => {
    getAverageImageGenerationTime.mockReset();
    storeState.imageJobs = {};
  });

  it('does not invent a countdown before this exact workflow has measured history', async () => {
    getAverageImageGenerationTime.mockResolvedValue(null);

    render(<Illustration marker="[ILLUSTRATION-1]" />);

    await waitFor(() => {
      expect(getAverageImageGenerationTime).toHaveBeenCalledWith('indrasnet/gen_anime');
    });
    expect(screen.getByText(/gathering ETA data/i)).toBeInTheDocument();
    expect(screen.queryByText(/seconds? remaining|\d+s remaining/i)).not.toBeInTheDocument();
  });

  it('shows the measured countdown and sample count when history exists', async () => {
    getAverageImageGenerationTime.mockResolvedValue({
      avgTimeSeconds: 187,
      sampleCount: 3,
      minTimeSeconds: 61,
      maxTimeSeconds: 240,
    });

    render(<Illustration marker="[ILLUSTRATION-1]" />);

    expect(await screen.findByText(/~187s remaining \(3 prior runs\)/i)).toBeInTheDocument();
  });

  it('switches inline ETA to the active fallback task model and clears stale history', async () => {
    let resolveFallback!: (_value: unknown) => void;
    const fallbackEstimate = new Promise(_resolve => { resolveFallback = _resolve; });
    getAverageImageGenerationTime.mockImplementation((model: string) => model === 'indrasnet/gen_anime'
      ? Promise.resolve({ avgTimeSeconds: 187, sampleCount: 3 })
      : fallbackEstimate);
    storeState.imageJobs = {
      'job-1': {
        id: 'job-1',
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        requestedModel: 'indrasnet/gen_anime',
        taskModel: 'indrasnet/gen_anime',
        status: 'running',
      },
    };

    const view = render(<Illustration marker="[ILLUSTRATION-1]" />);
    expect(await screen.findByText(/~187s remaining/i)).toBeInTheDocument();

    storeState.imageJobs = {
      'job-1': { ...storeState.imageJobs['job-1'], taskModel: 'Qubico/flux1-dev' },
    };
    view.rerender(<Illustration marker="[ILLUSTRATION-1]" />);

    await waitFor(() => expect(getAverageImageGenerationTime).toHaveBeenCalledWith('Qubico/flux1-dev'));
    expect(screen.getByText(/gathering ETA data/i)).toBeInTheDocument();
    expect(screen.queryByText(/~187s remaining/i)).not.toBeInTheDocument();
    resolveFallback({ avgTimeSeconds: 42, sampleCount: 2 });
    expect(await screen.findByText(/~42s remaining \(2 prior runs\)/i)).toBeInTheDocument();
  });

  it('does not start an inline countdown while its batch job is queued', () => {
    storeState.imageJobs = {
      'job-1': {
        id: 'job-1',
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        requestedModel: 'indrasnet/gen_anime',
        status: 'queued',
      },
    };

    render(<Illustration marker="[ILLUSTRATION-1]" />);

    expect(screen.getByText(/waiting for earlier illustrations/i)).toBeInTheDocument();
    expect(getAverageImageGenerationTime).not.toHaveBeenCalled();
  });

  it('does not start an inline countdown while the provider still has the task queued', () => {
    storeState.imageJobs = {
      'job-1': {
        id: 'job-1',
        chapterId: 'chapter-1',
        placementMarker: '[ILLUSTRATION-1]',
        requestedModel: 'indrasnet/gen_anime',
        status: 'submitted',
      },
    };

    render(<Illustration marker="[ILLUSTRATION-1]" />);

    expect(screen.getByText(/queued by provider/i)).toBeInTheDocument();
    expect(screen.queryByText(/generating illustration/i)).not.toBeInTheDocument();
    expect(getAverageImageGenerationTime).not.toHaveBeenCalled();
  });
});
