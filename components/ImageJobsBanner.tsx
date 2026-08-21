import React from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2, X } from 'lucide-react';
import { useAppStore } from '../store';
import type { ImageJob } from '../store/slices/imageJobsSlice';

const formatDuration = (seconds: number): string => {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded}s`;
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
};

const isActive = (job: ImageJob): boolean => ['queued', 'submitted', 'running'].includes(job.status);

const ImageJobsBanner: React.FC = () => {
  // Some test/embedded consumers intentionally provide a partial store. The
  // banner is additive UI and must remain inert when the job slice is absent.
  const imageJobs = useAppStore(state => state.imageJobs ?? {});
  const chapters = useAppStore(state => state.chapters);
  const setCurrentChapter = useAppStore(state => state.setCurrentChapter);
  const loadChapterFromIDB = useAppStore(state => state.loadChapterFromIDB);
  const showNotification = useAppStore(state => state.showNotification);
  const dismissImageJob = useAppStore(state => state.dismissImageJob);
  const [now, setNow] = React.useState(() => Date.now());

  const visibleJobs = React.useMemo(() => Object.values(imageJobs)
    .filter(job => isActive(job) || job.status === 'interrupted' || job.status === 'completed' || job.status === 'failed')
    .sort((a, b) => b.updatedAt - a.updatedAt), [imageJobs]);

  React.useEffect(() => {
    if (!visibleJobs.some(isActive)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visibleJobs]);

  if (visibleJobs.length === 0) return null;

  const job = visibleJobs[0];
  const chapter = chapters.get(job.chapterId);
  const title = chapter?.translationResult?.translatedTitle || chapter?.title || job.chapterId;
  const elapsedSeconds = ((job.completedAt || now) - job.startedAt) / 1000;
  const remainingSeconds = job.estimatedDurationSeconds
    ? Math.max(0, job.estimatedDurationSeconds - elapsedSeconds)
    : null;
  const progress = job.estimatedDurationSeconds
    ? Math.min(95, Math.round((elapsedSeconds / job.estimatedDurationSeconds) * 100))
    : null;
  const more = visibleJobs.length - 1;

  const icon = job.status === 'completed'
    ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
    : job.status === 'failed' || job.status === 'interrupted'
      ? <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      : job.status === 'running' || job.status === 'submitted'
        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        : <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />;

  const statusText = job.status === 'completed'
    ? `Illustration ready after ${formatDuration(job.durationSeconds ?? elapsedSeconds)}`
    : job.status === 'failed'
      ? `Illustration failed: ${job.error || 'provider error'}`
      : job.status === 'interrupted'
        ? `Illustration paused: ${job.error || 'provider task will be checked again after reload'}`
        : remainingSeconds !== null && job.estimateSampleCount > 0
          ? `${job.status === 'submitted' ? 'Queued by provider' : 'Generating'} · about ${formatDuration(remainingSeconds)} left (${job.estimateSampleCount} prior run${job.estimateSampleCount === 1 ? '' : 's'})`
          : `${job.status === 'submitted' ? 'Queued by provider' : 'Generating'} · ${formatDuration(elapsedSeconds)} elapsed · gathering ETA data`;

  const tone = job.status === 'completed'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-100'
    : job.status === 'failed' || job.status === 'interrupted'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/90 dark:text-amber-100'
      : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/90 dark:text-violet-100';

  const openOrigin = async (): Promise<void> => {
    try {
      const origin = chapters.get(job.chapterId) || await loadChapterFromIDB(job.chapterId);
      if (!origin) {
        console.error('[ImageJobsBanner] Origin chapter is unavailable after hydration', {
          jobId: job.id,
          chapterId: job.chapterId,
          placementMarker: job.placementMarker,
        });
        showNotification('The originating chapter could not be loaded. The image job was preserved.', 'error');
        return;
      }
      setCurrentChapter(job.chapterId);
    } catch (error) {
      console.error('[ImageJobsBanner] Failed to hydrate the originating chapter', {
        jobId: job.id,
        chapterId: job.chapterId,
        placementMarker: job.placementMarker,
        error,
      });
      showNotification('The originating chapter could not be loaded. The image job was preserved.', 'error');
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[min(25rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      <div className={`rounded-xl border shadow-lg ${tone}`}>
        <div className="flex items-start gap-2 px-3 py-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            onClick={() => { void openOrigin(); }}
            aria-label={`Open ${title}`}
            title={`Open ${title}`}
          >
            {icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{title}</span>
              <span className="block text-xs opacity-85">{statusText}</span>
              {more > 0 && <span className="block text-xs opacity-70">+{more} more image job{more === 1 ? '' : 's'}</span>}
            </span>
          </button>
          {!isActive(job) && (
            <button type="button" aria-label="Dismiss image job" onClick={() => dismissImageJob(job.id)} className="rounded p-1 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {progress !== null && isActive(job) && (
          <div className="h-1 overflow-hidden rounded-b-xl bg-black/10" aria-label={`Estimated ${progress}% complete`}>
            <div className="h-full bg-current opacity-50 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageJobsBanner;
