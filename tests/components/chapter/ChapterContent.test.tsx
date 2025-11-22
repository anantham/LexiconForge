import React, { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChapterContent from '../../../components/chapter/ChapterContent';
import type { AppSettings, Chapter } from '../../../types';
import type { TokenizationResult } from '../../../components/chapter/translationTokens';
import type { DiffMarkerVisibilitySettings } from '../../../types';

const baseSettings: AppSettings = {
  contextDepth: 1,
  preloadCount: 1,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.6,
  systemPrompt: '',
  provider: 'OpenAI',
  model: 'gpt-4o',
  imageModel: 'gpt-img',
  temperature: 0.7,
};

const baseChapter: Chapter = {
  title: 'Chapter 1',
  content: 'Original content',
  originalUrl: 'https://example.com',
  nextUrl: null,
  prevUrl: null,
  translationResult: null,
};

const tokenData: TokenizationResult = {
  tokens: [],
  nodes: [],
  paragraphs: [
    {
      position: 0,
      diffChunkId: 'chunk-0',
      chunkId: 'chunk-0',
      nodes: [<p key="node">Diff paragraph</p>],
    },
  ],
};

const visibility: DiffMarkerVisibilitySettings = {
  fan: true,
  rawLoss: true,
  rawGain: true,
  sensitivity: true,
  stylistic: true,
};

const createProps = (overrides: Partial<React.ComponentProps<typeof ChapterContent>> = {}) => ({
  chapter: baseChapter,
  settings: baseSettings,
  isGlobalLoading: false,
  isTranslating: false,
  isHydrating: false,
  editableContainerRef: createRef<HTMLDivElement>(),
  contentRef: createRef<HTMLDivElement>(),
  isEditing: false,
  editedContent: '',
  onEditChange: vi.fn(),
  translationTokensData: tokenData,
  markersByPosition: new Map(),
  markerVisibilitySettings: visibility,
  diffMarkersLoading: false,
  onMarkerClick: vi.fn(),
  inlineEditState: null,
  toolbarCoords: null,
  saveInlineEdit: vi.fn(),
  cancelInlineEdit: vi.fn(),
  toggleInlineNewVersion: vi.fn(),
  contentToDisplay: 'Fallback content',
  providerLabel: 'Gemini',
  modelLabel: '2.0',
  renderEnglishDiffs: false,
  showEnglishLoader: false,
  ...overrides,
});

describe('ChapterContent', () => {
  it('shows global loader when fetching', () => {
    render(<ChapterContent {...createProps({ isGlobalLoading: true })} />);
    expect(screen.getByText(/Fetching chapter raws/i)).toBeInTheDocument();
  });

  it('shows welcome state when no chapter is loaded', () => {
    render(<ChapterContent {...createProps({ chapter: null })} />);
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
  });

  it('shows english translation loader when requested', () => {
    render(<ChapterContent {...createProps({ showEnglishLoader: true })} />);
    expect(screen.getByText(/Translating with/)).toBeInTheDocument();
  });

  it('shows cache loader when hydrating and not translating', () => {
    render(<ChapterContent {...createProps({ isHydrating: true })} />);
    expect(screen.getByText(/Loading chapter from cache/)).toBeInTheDocument();
  });

  it('renders textarea in editing mode and forwards onEditChange', () => {
    const onEditChange = vi.fn();
    render(
      <ChapterContent
        {...createProps({
          isEditing: true,
          editedContent: 'Draft',
          onEditChange,
        })}
      />
    );
    const textarea = screen.getByPlaceholderText('Edit the translation...');
    fireEvent.change(textarea, { target: { value: 'Updated' } });
    expect(onEditChange).toHaveBeenCalledWith('Updated');
  });

  it('renders diff paragraphs when in english mode', () => {
    render(
      <ChapterContent
        {...createProps({
          renderEnglishDiffs: true,
        })}
      />
    );
    expect(screen.getByTestId('diff-paragraph-chunk-0')).toBeInTheDocument();
  });

  it('renders fallback content when not in english mode', () => {
    render(<ChapterContent {...createProps({ contentToDisplay: 'Fan text' })} />);
    expect(screen.getByText('Fan text')).toBeInTheDocument();
  });

  it('renders inline edit toolbar when coords + state provided', () => {
    render(
      <ChapterContent
        {...createProps({
          inlineEditState: { chunkId: '1', element: document.createElement('div'), originalText: 'a', saveAsNewVersion: true },
          toolbarCoords: { top: 10, left: 20 },
        })}
      />
    );
    expect(screen.getByText('New version')).toBeInTheDocument();
  });
});
