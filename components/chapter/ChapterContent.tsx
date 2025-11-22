import React from 'react';
import Loader from '../Loader';
import DiffParagraphs from './DiffParagraphs';
import InlineEditToolbar from './InlineEditToolbar';
import TranslationEditor from './TranslationEditor';
import type { AppSettings, Chapter, DiffMarkerVisibilitySettings } from '../../types';
import type { TokenizationResult } from './translationTokens';
import type { UiDiffMarker } from './diffVisibility';
import type { InlineEditState } from '../../hooks/useInlineTranslationEditor';

interface ChapterContentProps {
  chapter: Chapter | null;
  settings: AppSettings;
  isGlobalLoading: boolean;
  isTranslating: boolean;
  isHydrating: boolean;
  editableContainerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isEditing: boolean;
  editedContent: string;
  onEditChange: (value: string) => void;
  translationTokensData: TokenizationResult;
  markersByPosition: Map<number, UiDiffMarker[]>;
  markerVisibilitySettings: DiffMarkerVisibilitySettings;
  diffMarkersLoading: boolean;
  onMarkerClick: (marker: UiDiffMarker) => void;
  inlineEditState: InlineEditState | null;
  toolbarCoords: { top: number; left: number } | null;
  saveInlineEdit: () => void;
  cancelInlineEdit: () => void;
  toggleInlineNewVersion: () => void;
  contentToDisplay: React.ReactNode;
  providerLabel: string;
  modelLabel?: string;
  renderEnglishDiffs: boolean;
  showEnglishLoader: boolean;
}

const ChapterContent: React.FC<ChapterContentProps> = ({
  chapter,
  settings,
  isGlobalLoading,
  isTranslating,
  isHydrating,
  editableContainerRef,
  contentRef,
  isEditing,
  editedContent,
  onEditChange,
  translationTokensData,
  markersByPosition,
  markerVisibilitySettings,
  diffMarkersLoading,
  onMarkerClick,
  inlineEditState,
  toolbarCoords,
  saveInlineEdit,
  cancelInlineEdit,
  toggleInlineNewVersion,
  contentToDisplay,
  providerLabel,
  modelLabel,
  renderEnglishDiffs,
  showEnglishLoader,
}) => {
  if (isGlobalLoading) {
    return <Loader text="Fetching chapter raws..." />;
  }

  if (!chapter) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
        <p>Enter a web novel chapter URL above to get started.</p>
      </div>
    );
  }

  if (showEnglishLoader) {
    return (
      <Loader
        text={`Translating with ${providerLabel}${modelLabel ? ' — ' + modelLabel : ''}...`}
      />
    );
  }

  if (isHydrating && !isTranslating) {
    return <Loader text="Loading chapter from cache..." />;
  }

  return (
    <div className="relative" ref={editableContainerRef}>
      {isEditing ? (
        <TranslationEditor value={editedContent} onChange={onEditChange} settings={settings} />
      ) : (
        <div
          ref={contentRef}
          data-translation-content
          className={`prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
          {renderEnglishDiffs ? (
            <DiffParagraphs
              translationTokensData={translationTokensData}
              markersByPosition={markersByPosition}
              showHeatmap={settings.showDiffHeatmap !== false}
              markerVisibilitySettings={markerVisibilitySettings}
              diffMarkersLoading={diffMarkersLoading}
              onMarkerClick={onMarkerClick}
            />
          ) : (
            contentToDisplay
          )}
        </div>
      )}

      {inlineEditState && toolbarCoords && (
        <InlineEditToolbar
          inlineEditState={inlineEditState}
          toolbarCoords={toolbarCoords}
          onSave={saveInlineEdit}
          onCancel={cancelInlineEdit}
          onToggleNewVersion={toggleInlineNewVersion}
        />
      )}
    </div>
  );
};

export default ChapterContent;
