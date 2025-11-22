import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TranslationStatusPanel from '../../../components/chapter/TranslationStatusPanel';

const createProps = () => ({
  currentChapterId: 'c1',
  viewMode: 'english' as const,
  isLoading: false,
  isTranslating: false,
  canManualRetranslate: true,
  retranslateSettingsChanged: false,
  isRetranslationActive: false,
  onRetranslateClick: vi.fn(),
  providerLabel: 'OpenAI',
  modelLabel: 'gpt-4o',
  usageMetrics: {
    totalTokens: 100,
    promptTokens: 40,
    completionTokens: 60,
    estimatedCost: 0.0123,
    requestTime: 1.5,
    provider: 'OpenAI',
    model: 'gpt-4o',
  } as any,
  showUsageMetrics: true,
  imageMetrics: {
    count: 2,
    totalTime: 1.1,
    totalCost: 0.5,
    lastModel: 'gpt-img',
  },
  showImageMetrics: true,
});

describe('TranslationStatusPanel', () => {
  it('renders usage and image metrics', () => {
    const props = createProps();
    render(<TranslationStatusPanel {...props} />);
    expect(screen.getByText(/Translated in/)).toBeInTheDocument();
    expect(screen.getByText(/Generated 2 images/)).toBeInTheDocument();
    expect(screen.queryByTitle('Retranslate chapter')).not.toBeInTheDocument();
  });

  it('shows translating banner when active', () => {
    render(
      <TranslationStatusPanel
        {...createProps()}
        isTranslating
        usageMetrics={null}
        showUsageMetrics={false}
      />
    );
    expect(screen.getByText(/Translating/)).toBeInTheDocument();
  });
});
