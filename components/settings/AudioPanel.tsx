import React, { useState } from 'react';
import { useAudioPanelStore } from '../../hooks/useAudioPanelStore';
import { ostLibraryService } from '../../services/audio/OSTLibraryService';
import type { OSTSample } from '../../services/audio/OSTLibraryService';

export const AudioPanel: React.FC = () => {
  const {
    selectedProvider,
    setProvider,
    selectedTaskType,
    setTaskType,
    selectedPreset,
    setPreset,
    volume,
    setVolume,
    getAvailablePresets,
    audioMetrics,
    selectedStyleAudio,
    uploadedStyleAudio,
    setStyleAudio,
    setUploadedStyleAudio,
    setError,
  } = useAudioPanelStore();
  const [ostSamples, setOstSamples] = useState<OSTSample[]>([]);

  React.useEffect(() => {
    ostLibraryService.getSamples().then(setOstSamples).catch(() => setOstSamples([]));
  }, []);

  const handleTaskTypeChange = (taskType: 'txt2audio' | 'audio2audio') => {
    setTaskType(taskType);
    if (taskType === 'txt2audio') {
      setStyleAudio(null);
      setUploadedStyleAudio(null);
    }
  };

  const handleStyleAudioChange = (audioId: string) => {
    setStyleAudio(audioId);
    setUploadedStyleAudio(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid audio file (MP3, WAV, OGG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploadedStyleAudio(file);
    setStyleAudio(null);
  };

  return (
    <fieldset>
      <legend className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        Audio Settings
      </legend>
      <div className="space-y-6">
        <div>
          <label htmlFor="audio-provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Audio Provider</label>
          <select
            id="audio-provider"
            value={selectedProvider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="ace-step">Ace Step (Flexible durations)</option>
            <option value="diffrhythm">DiffRhythm (Fixed durations)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {selectedProvider === 'ace-step'
              ? 'Variable length audio (10-240s) at $0.0005/second'
              : 'Fixed length audio: 1.35min or 4.45min at $0.02/generation'}
          </p>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Generation Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleTaskTypeChange('txt2audio')}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedTaskType === 'txt2audio'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              Text → Audio
            </button>
            <button
              onClick={() => handleTaskTypeChange('audio2audio')}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedTaskType === 'audio2audio'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              Audio → Audio
            </button>
          </div>
        </div>

        {selectedTaskType === 'audio2audio' && (
          <div className="mb-3">
            <label htmlFor="reference-style" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Reference Audio Style</label>
            <select
              id="reference-style"
              value={selectedStyleAudio || ''}
              onChange={(e) => handleStyleAudioChange(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-2"
            >
              <option value="">Select from OST Library...</option>
              {ostSamples.map((sample) => (
                <option key={sample.id} value={sample.url}>
                  {sample.name} ({sample.category})
                </option>
              ))}
            </select>
            <div className="text-center text-xs text-gray-500 mb-2">or</div>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              aria-label="Upload reference audio"
              className="w-full text-xs text-gray-600 dark:text-gray-400"
            />
            {uploadedStyleAudio && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs">
                ✓ Uploaded: {uploadedStyleAudio.name}
              </div>
            )}
            {selectedStyleAudio && !uploadedStyleAudio && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-xs">
                ✓ OST Selected: {ostSamples.find((s) => s.url === selectedStyleAudio)?.name}
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="music-style" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Music Style</label>
          <select
            id="music-style"
            value={selectedPreset || ''}
            onChange={(e) => setPreset(e.target.value || null)}
            className="block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">Auto-detect from content</option>
            {getAvailablePresets().map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Default Volume: {Math.round(volume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Usage Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
              <span className="ml-2 font-mono">${audioMetrics.totalCost.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Generations:</span>
              <span className="ml-2 font-mono">{audioMetrics.generationCount}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Duration:</span>
              <span className="ml-2 font-mono">
                {Math.round(audioMetrics.totalDuration / 60)}m {Math.round(audioMetrics.totalDuration % 60)}s
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Avg Cost/Min:</span>
              <span className="ml-2 font-mono">
                ${audioMetrics.totalDuration > 0 ? (audioMetrics.totalCost / (audioMetrics.totalDuration / 60)).toFixed(4) : '0.0000'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">How It Works</h3>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Click the music icon in any chapter header to generate OST</li>
            <li>• Audio is cached locally for offline playback</li>
            <li>• Content is analyzed to choose appropriate music style</li>
            <li>• Generated audio plays in background while reading</li>
          </ul>
        </div>
      </div>
    </fieldset>
  );
};

export default AudioPanel;
