import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import MusicIcon from './icons/MusicIcon';
import { useAppStore } from '../store';
import { formatDuration } from '../services/audio/storage/utils';

// Stable empty array to prevent re-renders
const EMPTY_AUDIO_LIST: readonly string[] = Object.freeze([]);

interface AudioControlsProps {
  chapterId: string;
  className?: string;
}

const AudioControls: React.FC<AudioControlsProps> = ({ chapterId, className = '' }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio slice selectors - stable references
  const currentPlayback = useAppStore(s => s.currentPlayback);
  const volume = useAppStore(s => s.volume);
  const chapterAudioMap = useAppStore(s => s.chapterAudioMap);
  const chapterAudio = useMemo(() => 
    chapterAudioMap.get(chapterId) ?? EMPTY_AUDIO_LIST, 
    [chapterAudioMap, chapterId]
  );
  const selectedProvider = useAppStore(s => s.selectedProvider);
  const selectedTaskType = useAppStore(s => s.selectedTaskType);
  const selectedStyleAudio = useAppStore(s => s.selectedStyleAudio);
  const uploadedStyleAudio = useAppStore(s => s.uploadedStyleAudio);
  const isAudioGenerating = useAppStore(s => s.isGenerating);
  
  // Audio slice actions - memoized with useCallback
  const generateChapterAudio = useAppStore(s => s.generateChapterAudio);
  const playAudio = useAppStore(s => s.playAudio);
  const pauseAudio = useAppStore(s => s.pauseAudio);
  const stopAudio = useCallback(() => {
    useAppStore.getState().stopAudio();
  }, []);
  const setVolume = useAppStore(s => s.setVolume);
  const seekAudio = useCallback((time: number) => {
    useAppStore.getState().seekAudio(time);
  }, []);
  
  // Chapter data
  const chapters = useAppStore(s => s.chapters);
  const chapter = chapterId ? chapters.get(chapterId) : null;
  
  const hasAudio = chapterAudio.length > 0;
  const isCurrentChapterPlaying = currentPlayback?.chapterId === chapterId;
  const isPlaying = isCurrentChapterPlaying && currentPlayback?.isPlaying;
  const isPaused = isCurrentChapterPlaying && currentPlayback?.isPaused;
  
  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isCurrentChapterPlaying) return;
    
    const handleTimeUpdate = () => {
      // Update playback state with current time
      seekAudio(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      // Update duration using current state
      const state = useAppStore.getState();
      if (state.currentPlayback) {
        useAppStore.setState({
          currentPlayback: {
            ...state.currentPlayback,
            duration: audio.duration
          }
        });
      }
    };
    
    const handleEnded = () => {
      stopAudio();
    };
    
    const handleError = () => {
      setError('Failed to load audio');
      stopAudio();
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [isCurrentChapterPlaying, stopAudio, seekAudio]);
  
  // Sync audio element with playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isCurrentChapterPlaying || !currentPlayback) return;
    
    // Update volume
    audio.volume = volume;
    
    // Update source if changed (but prevent redundant loads)
    const currentSrc = audio.src;
    const newSrc = currentPlayback.audioUrl;
    if (currentSrc !== newSrc) {
      audio.src = newSrc;
      audio.load();
      return; // Don't try to play immediately after load
    }
    
    // Update playback state only if source is stable
    if (isPlaying && audio.paused && audio.readyState >= 2) {
      audio.play().catch(err => {
        console.error('Audio play failed:', err);
        setError('Playback failed');
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isCurrentChapterPlaying, currentPlayback?.audioUrl, isPlaying, volume]);

  // Handle stop - reset audio element when currentPlayback becomes null  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (!currentPlayback && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [currentPlayback]);
  
  const handleGenerateAudio = async () => {
    if (!chapter?.content) {
      setError('No chapter content available');
      return;
    }
    
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
  
  const isAudio2AudioReady = selectedTaskType === 'audio2audio' && 
    (selectedStyleAudio || uploadedStyleAudio);
  
  const getStatusText = () => {
    if (isGenerating || isAudioGenerating) {
      return 'Generating OST...';
    }
    if (error) {
      return error;
    }
    if (hasAudio) {
      if (isPlaying) {
        return 'Playing';
      }
      if (isPaused) {
        return 'Paused';
      }
      return 'Ready';
    }
    return 'Generate OST';
  };
  
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
  
  const canGenerate = selectedTaskType === 'txt2audio' || isAudio2AudioReady;
  
  return (
    <div className={`flex items-center gap-2 relative ${className}`}>
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" playsInline />
      
      {/* Main music button */}
      <button
        onClick={hasAudio ? handlePlayPause : handleGenerateAudio}
        disabled={isGenerating || isAudioGenerating || (!hasAudio && !canGenerate)}
        className={`p-2 rounded-full border transition-all duration-200 ${
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V3zM7 3v14h2V3H7zm4 0v14h2V3h-2z" />
            </svg>
          ) : (
            // Play icon
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
            </svg>
          )
        ) : (
          <MusicIcon className={`w-5 h-5 ${
            (isGenerating || isAudioGenerating) ? 'animate-spin' : ''
          }`} />
        )}
      </button>
      
      {/* Extended controls when audio is available */}
      {hasAudio && (
        <>
          {/* Stop button */}
          <button
            onClick={handleStop}
            className="p-1 text-gray-500 hover:text-red-500 transition-colors"
            title="Stop audio"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
          </button>
          
          {/* Volume control */}
          <div className="flex items-center gap-1">
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
              className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          
          {/* Time display */}
          {currentPlayback && isCurrentChapterPlaying && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDuration(currentPlayback.currentTime)} / {formatDuration(currentPlayback.duration)}
            </span>
          )}
        </>
      )}
      
      
      
    </div>
  );
};

export default AudioControls;