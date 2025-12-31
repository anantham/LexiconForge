import React, { useRef, useEffect, useState, useCallback } from 'react';
import MusicIcon from './icons/MusicIcon';
import { useAppStore } from '../store';
import { formatDuration } from '../services/audio/storage/utils';

interface AudioPlayerProps {
  chapterId: string;
  isVisible: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ chapterId, isVisible }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tempSeekTime, setTempSeekTime] = useState<number | null>(null);
  
  // Audio slice selectors
  const currentPlayback = useAppStore(s => s.currentPlayback);
  const volume = useAppStore(s => s.volume);
  const chapterAudioMap = useAppStore(s => s.chapterAudioMap);
  const chapterAudio = chapterAudioMap.get(chapterId) ?? [];
  const selectedProvider = useAppStore(s => s.selectedProvider);
  const selectedTaskType = useAppStore(s => s.selectedTaskType);
  const selectedStyleAudio = useAppStore(s => s.selectedStyleAudio);
  const uploadedStyleAudio = useAppStore(s => s.uploadedStyleAudio);
  const isAudioGenerating = useAppStore(s => s.isGenerating);
  
  // Audio slice actions
  const generateChapterAudio = useAppStore(s => s.generateChapterAudio);
  const playAudio = useAppStore(s => s.playAudio);
  const pauseAudio = useAppStore(s => s.pauseAudio);
  const stopAudio = useAppStore(s => s.stopAudio);
  const setVolume = useAppStore(s => s.setVolume);
  const seekAudio = useAppStore(s => s.seekAudio);
  const updatePlaybackProgress = useAppStore(s => s.updatePlaybackProgress);
  
  // Chapter data
  const chapters = useAppStore(s => s.chapters);
  const chapter = chapterId ? chapters.get(chapterId) : null;
  
  const hasAudio = chapterAudio.length > 0;
  const isCurrentChapterPlaying = currentPlayback?.chapterId === chapterId;
  const isPlaying = isCurrentChapterPlaying && currentPlayback?.isPlaying;
  const isAudio2AudioReady = selectedTaskType === 'txt2audio' || (selectedTaskType === 'audio2audio' && (selectedStyleAudio || uploadedStyleAudio));
  
  // Handle audio generation
  const handleGenerateAudio = async () => {
    if (!chapter?.content || isGenerating || isAudioGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      await generateChapterAudio(chapterId, chapter.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audio generation failed');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handlePlayPause = () => {
    if (!hasAudio) return;
    
    if (isPlaying) {
      pauseAudio();
    } else {
      playAudio(chapterId);
    }
  };
  
  const handleStop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopAudio();
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };
  
  // Seek functionality
  const handleSeekStart = () => {
    setIsDragging(true);
  };
  
  const handleSeekMove = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setTempSeekTime(newTime);
  };
  
  const handleSeekEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setIsDragging(false);
    setTempSeekTime(null);

    // Actually seek the audio element
    const audio = audioRef.current;
    if (audio && isFinite(newTime)) {
      audio.currentTime = newTime;
    }
    seekAudio(newTime);
  };
  
  const currentTime = isDragging && tempSeekTime !== null ? tempSeekTime : (currentPlayback?.currentTime ?? 0);
  const duration = currentPlayback?.duration ?? 0;
  
  const canGenerate = selectedTaskType === 'txt2audio' || isAudio2AudioReady;
  
  const getButtonTitle = () => {
    if (isGenerating || isAudioGenerating) {
      return 'Generating audio...';
    }
    if (!hasAudio) {
      if (selectedTaskType === 'audio2audio' && !isAudio2AudioReady) {
        return 'Select reference audio to generate';
      }
      return `Generate background music for this chapter using ${selectedProvider}`;
    }
    return isPlaying ? 'Pause audio' : 'Play audio';
  };
  
  // Sync audio element with playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isCurrentChapterPlaying) return;
    
    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
    
    audio.volume = volume;
  }, [isPlaying, volume, isCurrentChapterPlaying]);
  
  // Load audio when available
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasAudio) return;

    const latestAudio = chapterAudio[chapterAudio.length - 1];
    if (latestAudio && audio.src !== latestAudio) {
      audio.src = latestAudio;
      audio.load();
    }
  }, [chapterAudio, hasAudio]);

  // Update playback progress from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDragging && isCurrentChapterPlaying) {
        updatePlaybackProgress(audio.currentTime, audio.duration || 0);
      }
    };

    const handleLoadedMetadata = () => {
      if (isCurrentChapterPlaying) {
        updatePlaybackProgress(audio.currentTime, audio.duration || 0);
      }
    };

    const handleDurationChange = () => {
      if (isCurrentChapterPlaying && audio.duration && isFinite(audio.duration)) {
        updatePlaybackProgress(audio.currentTime, audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
  }, [isDragging, isCurrentChapterPlaying, updatePlaybackProgress]);
  
  if (!isVisible) return null;
  
  return (
    <div className="mt-8 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 p-4">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" playsInline />
      
      <div className="max-w-4xl mx-auto">
        {/* Main controls row */}
        <div className="flex items-center gap-4 mb-3">
          {/* Play/Generate button */}
          <button
            onClick={hasAudio ? handlePlayPause : handleGenerateAudio}
            disabled={isGenerating || isAudioGenerating || (!hasAudio && !canGenerate)}
            className={`p-3 rounded-full border transition-all duration-200 flex-shrink-0 ${
              (isGenerating || isAudioGenerating)
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                : hasAudio
                ? isPlaying
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                  : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/40'
                : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-300'
            }`}
            title={getButtonTitle()}
          >
            {hasAudio ? (
              isPlaying ? (
                // Pause icon
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V3zM7 3v14h2V3H7zm4 0v14h2V3h-2z" />
                </svg>
              ) : (
                // Play icon
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
                </svg>
              )
            ) : (
              <MusicIcon className={`w-6 h-6 ${
                (isGenerating || isAudioGenerating) ? 'animate-spin' : ''
              }`} />
            )}
          </button>
          
          {/* Stop button (only when audio exists) */}
          {hasAudio && (
            <button
              onClick={handleStop}
              className="p-2 text-gray-500 hover:text-red-500 transition-colors"
              title="Stop audio"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <rect x="6" y="6" width="8" height="8" rx="1" />
              </svg>
            </button>
          )}
          
          {/* Seek slider (full width) */}
          {hasAudio && (
            <div className="flex-1 flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                {formatDuration(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onMouseDown={handleSeekStart}
                onChange={handleSeekMove}
                onMouseUp={handleSeekEnd}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: duration > 0 
                    ? `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(currentTime / duration) * 100}%, #E5E7EB ${(currentTime / duration) * 100}%, #E5E7EB 100%)`
                    : undefined
                }}
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 w-12">
                {formatDuration(duration)}
              </span>
            </div>
          )}
          
          {/* Volume control */}
          {hasAudio && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.824L4.586 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.586l3.797-2.824a1 1 0 011.617.824z" />
                <path d="M12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          )}
        </div>
        
        {/* Error display */}
        {error && (
          <div className="text-red-500 text-sm mb-2">
            {error}
          </div>
        )}
        
        {/* Audio generation status */}
        {(isGenerating || isAudioGenerating) && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Generating audio with {selectedProvider}...
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;