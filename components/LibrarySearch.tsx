import React, { useState, useRef } from 'react';
import { Search, Loader2, ExternalLink, CheckCircle, XCircle, Globe } from 'lucide-react';
import { searchNovelSources } from '../services/librarySearch/searchService';
import { useAppStore } from '../store';
import type { SearchResult, SourceCandidate } from '../services/librarySearch/types';

interface LibrarySearchProps {
  onSourceSelected?: (raw: SourceCandidate | null, fan: SourceCandidate | null) => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : pct >= 50
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
      {pct}%
    </span>
  );
}

function SourceCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: SourceCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const supported = candidate.adapterSupported;

  return (
    <button
      onClick={supported ? onSelect : undefined}
      disabled={!supported}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
          : supported
            ? 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {candidate.site}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                candidate.sourceType === 'official'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {candidate.sourceType}
            </span>
            <ConfidenceBadge confidence={candidate.confidence} />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{candidate.matchedTitle}</p>
          {candidate.matchedAuthor && (
            <p className="text-xs text-gray-500 dark:text-gray-500">by {candidate.matchedAuthor}</p>
          )}
          {candidate.chapterCount && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              {candidate.chapterCount} chapters
              {candidate.status ? ` · ${candidate.status}` : ''}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
            {candidate.whyThisMatches}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          {selected ? (
            <CheckCircle className="h-5 w-5 text-blue-500" />
          ) : supported ? (
            <Globe className="h-4 w-4 text-gray-400" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
      {!supported && (
        <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">
          Site not yet supported — adapter needed
        </p>
      )}
    </button>
  );
}

export function LibrarySearch({ onSourceSelected }: LibrarySearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRaw, setSelectedRaw] = useState<SourceCandidate | null>(null);
  const [selectedFan, setSelectedFan] = useState<SourceCandidate | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const settings = useAppStore((s) => s.settings);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Abort any in-flight search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setError(null);
    setResult(null);
    setSelectedRaw(null);
    setSelectedFan(null);

    try {
      const searchResult = await searchNovelSources(trimmed, settings, controller.signal);

      if (searchResult.rawSources.length === 0 && searchResult.fanTranslations.length === 0) {
        setError('No sources found. Try a different title, author, or language.');
      } else {
        setResult(searchResult);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[LibrarySearch] Search failed:', err);
      setError(err.message || 'Search failed. Check your API key and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (selectedRaw || selectedFan) {
      onSourceSelected?.(selectedRaw, selectedFan);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author (e.g. Omniscient Reader, 修真四万年, 卧牛真人)"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={isSearching}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500 animate-spin" />
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
          Uses your configured AI provider to find novel sources across the web
        </p>
      </form>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Resolved Identity */}
          {result.identity.titleZh && (
            <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Resolved:{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {result.identity.titleZh}
                </span>
                {result.identity.authorZh && (
                  <span className="text-gray-500"> by {result.identity.authorZh}</span>
                )}
                {result.identity.titleEn && (
                  <span className="text-gray-500"> ({result.identity.titleEn})</span>
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Raw Sources */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                Raw Sources ({result.rawSources.length})
              </h4>
              {result.rawSources.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No raw sources found</p>
              ) : (
                <div className="space-y-2">
                  {result.rawSources.map((candidate, i) => (
                    <SourceCard
                      key={`raw-${i}`}
                      candidate={candidate}
                      selected={selectedRaw?.url === candidate.url}
                      onSelect={() =>
                        setSelectedRaw((prev) => (prev?.url === candidate.url ? null : candidate))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fan Translations */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
                Fan Translations ({result.fanTranslations.length})
              </h4>
              {result.fanTranslations.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No fan translations found</p>
              ) : (
                <div className="space-y-2">
                  {result.fanTranslations.map((candidate, i) => (
                    <SourceCard
                      key={`fan-${i}`}
                      candidate={candidate}
                      selected={selectedFan?.url === candidate.url}
                      onSelect={() =>
                        setSelectedFan((prev) => (prev?.url === candidate.url ? null : candidate))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Confirm button */}
          {(selectedRaw || selectedFan) && (
            <div className="text-center">
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
              >
                Add to Library
                {selectedRaw && selectedFan
                  ? ' (Raw + Fan Translation)'
                  : selectedRaw
                    ? ' (Raw Source)'
                    : ' (Fan Translation)'}
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {selectedRaw && !selectedRaw.adapterSupported
                  ? ''
                  : 'Chapters will be fetched and added to your library'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
