import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import Loader from '../Loader';
import MigrationRecovery from '../MigrationRecovery';
import { prepareConnection } from '../../services/db/core/connection';
import { shouldBlockApp, type VersionCheckResult } from '../../services/db/core/versionGate';
import { SuttaStudioView } from './SuttaStudioView';
import { DEMO_PACKET_MN10 } from './demoPacket';
import { SuttaStudioFallback } from './SuttaStudioFallback';
import { compileSuttaStudioPacket, SUTTA_STUDIO_PROMPT_VERSION } from '../../services/suttaStudioCompiler';
import { ChapterOps } from '../../services/db/operations/chapters';
import { isSuttaFlowDebug, logSuttaFlow, warnSuttaFlow } from '../../services/suttaStudioDebug';
import { resetPipelineLogs } from '../../services/suttaStudioPipelineLog';

const parseSuttaRoute = () => {
  if (typeof window === 'undefined') return { uid: null, lang: 'en', author: 'sujato' };
  const parts = window.location.pathname.split('/').filter(Boolean);
  const uidRaw = parts[1] || null;
  const params = new URLSearchParams(window.location.search);
  const langRaw = params.get('lang') || 'en';
  const authorRaw = params.get('author') || 'sujato';
  const recompileRaw = params.get('recompile');
  const stitchRaw = params.get('stitch') || '';
  const allowCrossRaw = params.get('cross');
  const stitch = stitchRaw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return {
    uid: uidRaw ? uidRaw.toLowerCase() : null,
    lang: langRaw.toLowerCase(),
    author: authorRaw.toLowerCase(),
    recompile: recompileRaw === '1' || recompileRaw === 'true',
    stitch,
    allowCrossChapter: allowCrossRaw === '1' || allowCrossRaw === 'true',
  };
};

export function SuttaStudioApp() {
  const STALE_BUILD_MS = 3 * 60 * 1000;
  const [dbGate, setDbGate] = useState<{
    status: 'checking' | 'blocked' | 'ready';
    result: VersionCheckResult | null;
  }>({ status: 'checking', result: null });

  const initializeStore = useAppStore((s) => s.initializeStore);
  const handleNavigate = useAppStore((s) => s.handleNavigate);
  const chapter = useAppStore((s) =>
    s.currentChapterId ? s.chapters.get(s.currentChapterId) ?? null : null
  );
  const isInitialized = useAppStore((s) => s.isInitialized);
  const settings = useAppStore((s) => s.settings);
  const updateChapter = useAppStore((s) => s.updateChapter);
  const loadChapterFromIDB = useAppStore((s) => s.loadChapterFromIDB);
  const setCurrentChapter = useAppStore((s) => s.setCurrentChapter);

  const { uid, lang, author, recompile, stitch, allowCrossChapter } = useMemo(parseSuttaRoute, []);
  const targetUrl = uid ? `https://suttacentral.net/${uid}/${lang}/${author}` : null;
  const fetchOnce = useRef(false);
  const compileOnce = useRef(false);
  const resolveOnce = useRef(false);
  const compileAbortRef = useRef<AbortController | null>(null);
  const routeKeyRef = useRef<string | null>(null);
  const resolveGateReason = useRef<string | null>(null);
  const navigateGateReason = useRef<string | null>(null);
  const compileGateReason = useRef<string | null>(null);
  const renderGateReason = useRef<string | null>(null);
  const chapterMatches = chapter?.originalUrl?.includes(`suttacentral.net/${uid}`);
  const routeKey = useMemo(() => {
    const stitched = stitch.join(',');
    return `${uid ?? ''}|${lang}|${author}|${recompile ? '1' : '0'}|${stitched}|${allowCrossChapter ? '1' : '0'}`;
  }, [uid, lang, author, recompile, stitch, allowCrossChapter]);

  const logGate = (
    gate: string,
    reason: string,
    payload: Record<string, unknown>,
    ref: typeof resolveGateReason
  ) => {
    if (!isSuttaFlowDebug()) return;
    const key = `${gate}:${reason}`;
    if (ref.current === key) return;
    ref.current = key;
    logSuttaFlow(`${gate} gate`, { reason, ...payload });
  };

  useEffect(() => {
    if (routeKeyRef.current && routeKeyRef.current !== routeKey && compileAbortRef.current) {
      compileAbortRef.current.abort();
      compileAbortRef.current = null;
      logSuttaFlow('compiler aborted', {
        reason: 'route_change',
        previousKey: routeKeyRef.current,
        nextKey: routeKey,
      });
    }
    routeKeyRef.current = routeKey;
    fetchOnce.current = false;
    compileOnce.current = false;
    resolveOnce.current = false;
    resolveGateReason.current = null;
    navigateGateReason.current = null;
    compileGateReason.current = null;
    renderGateReason.current = null;
  }, [routeKey]);

  useEffect(() => {
    if (!isSuttaFlowDebug()) return;
    logSuttaFlow('route parsed', {
      uid,
      lang,
      author,
      recompile,
      stitch,
      allowCrossChapter,
      targetUrl,
    });
  }, [uid, lang, author, recompile, stitch, allowCrossChapter, targetUrl]);

  useEffect(() => {
    if (!isInitialized) {
      logGate(
        'resolve',
        'not_initialized',
        { isInitialized, targetUrl, chapterId: chapter?.id ?? null },
        resolveGateReason
      );
      return;
    }
    if (!targetUrl) {
      logGate('resolve', 'missing_target_url', { targetUrl }, resolveGateReason);
      return;
    }
    if (resolveOnce.current) {
      logGate('resolve', 'already_resolved', { targetUrl }, resolveGateReason);
      return;
    }
    if (chapter) {
      logGate(
        'resolve',
        'chapter_present',
        { chapterId: chapter.id, chapterUrl: chapter.originalUrl ?? null },
        resolveGateReason
      );
      return;
    }
    logGate('resolve', 'start', { targetUrl }, resolveGateReason);
    resolveOnce.current = true;

    (async () => {
      logSuttaFlow('resolve lookup', { targetUrl });
      try {
        const record = await ChapterOps.getByUrl(targetUrl);
        if (!record?.stableId) {
          console.warn('[SuttaStudio] No chapter record found for URL', { targetUrl });
          warnSuttaFlow('resolve lookup missed', { targetUrl });
          return;
        }
        const hydrated = await loadChapterFromIDB(record.stableId);
        if (hydrated) {
          setCurrentChapter(record.stableId);
          logSuttaFlow('resolve hydrate success', {
            chapterId: record.stableId,
            title: hydrated.title,
          });
        } else {
          console.warn('[SuttaStudio] Failed to hydrate chapter from IDB', {
            chapterId: record.stableId,
          });
          warnSuttaFlow('resolve hydrate failed', {
            chapterId: record.stableId,
          });
        }
      } catch (e) {
        console.warn('[SuttaStudio] IDB fallback resolution failed', e);
        warnSuttaFlow('resolve threw', {
          targetUrl,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  }, [chapter, isInitialized, loadChapterFromIDB, setCurrentChapter, targetUrl]);

  useEffect(() => {
    const init = async () => {
      const versionCheck = await prepareConnection();
      if (shouldBlockApp(versionCheck)) {
        setDbGate({ status: 'blocked', result: versionCheck });
        return;
      }
      setDbGate({ status: 'ready', result: versionCheck });
      await initializeStore();
    };
    init();
  }, [initializeStore]);

  useEffect(() => {
    if (!isInitialized) {
      logGate(
        'navigate',
        'not_initialized',
        { isInitialized, targetUrl },
        navigateGateReason
      );
      return;
    }
    if (!targetUrl) {
      logGate('navigate', 'missing_target_url', { targetUrl }, navigateGateReason);
      return;
    }
    if (fetchOnce.current) {
      logGate('navigate', 'already_requested', { targetUrl }, navigateGateReason);
      return;
    }
    logGate('navigate', 'start', { targetUrl }, navigateGateReason);
    fetchOnce.current = true;
    logSuttaFlow('navigate request', { targetUrl });
    handleNavigate(targetUrl);
  }, [handleNavigate, isInitialized, targetUrl]);

  useEffect(() => {
    if (isSuttaFlowDebug()) {
      logSuttaFlow('compile gate check', {
        isInitialized,
        uid,
        chapterId: chapter?.id ?? null,
        chapterMatches,
        chapterUrl: chapter?.originalUrl ?? null,
        hasPacket: !!chapter?.suttaStudio,
        progressState: chapter?.suttaStudio?.progress?.state ?? null,
        lastProgressAt: chapter?.suttaStudio?.progress?.lastProgressAt ?? null,
        promptVersion: chapter?.suttaStudio?.compiler?.promptVersion ?? null,
        recompile,
        stitch,
        allowCrossChapter,
      });
    }

    if (!isInitialized) {
      logGate(
        'compile',
        'not_initialized',
        { isInitialized, uid, chapterId: chapter?.id ?? null },
        compileGateReason
      );
      return;
    }
    if (!uid) {
      logGate('compile', 'missing_uid', { uid }, compileGateReason);
      return;
    }
    if (!chapterMatches) {
      logGate(
        'compile',
        'chapter_mismatch',
        {
          uid,
          chapterId: chapter?.id ?? null,
          chapterUrl: chapter?.originalUrl ?? null,
          targetUrl,
        },
        compileGateReason
      );
      return;
    }
    if (!chapter) {
      logGate('compile', 'missing_chapter', { uid, targetUrl }, compileGateReason);
      return;
    }
    if (compileOnce.current) {
      logGate('compile', 'already_started', { chapterId: chapter.id }, compileGateReason);
      return;
    }

    const existing = chapter.suttaStudio;
    const isComplete = existing?.progress?.state === 'complete';
    const isBuilding = existing?.progress?.state === 'building';
    const lastProgressAt =
      existing?.progress?.lastProgressAt ??
      (existing?.compiler?.createdAtISO ? Date.parse(existing.compiler.createdAtISO) : null);
    const isStaleBuild =
      Boolean(isBuilding && lastProgressAt) && Date.now() - (lastProgressAt || 0) > STALE_BUILD_MS;
    const promptVersionMismatch =
      existing?.compiler?.promptVersion && existing.compiler.promptVersion !== SUTTA_STUDIO_PROMPT_VERSION;
    const shouldRecompile = Boolean(recompile || promptVersionMismatch || isStaleBuild);
    if (!shouldRecompile && (isComplete || isBuilding)) {
      logGate(
        'compile',
        isComplete ? 'already_complete' : 'already_building',
        {
          chapterId: chapter.id,
          progressState: existing?.progress?.state ?? null,
          lastProgressAt,
          staleBuild: isStaleBuild,
          promptVersionMismatch: Boolean(promptVersionMismatch),
        },
        compileGateReason
      );
      return;
    }

    logGate(
      'compile',
      isStaleBuild ? 'stale_build_recompile' : 'start',
      {
        chapterId: chapter.id,
        recompile,
        promptVersionMismatch: Boolean(promptVersionMismatch),
        staleBuild: isStaleBuild,
        stitchedCount: stitch.length,
        allowCrossChapter,
      },
      compileGateReason
    );

    if (isSuttaFlowDebug()) {
      resetPipelineLogs('compile_start', {
        uid,
        chapterId: chapter.id,
        model: settings.model,
        provider: settings.provider,
      });
    }

    compileOnce.current = true;
    const controller = new AbortController();
    compileAbortRef.current = controller;
    const stitchedUids = (stitch || []).filter((entry) => entry && entry !== uid);

    compileSuttaStudioPacket({
      uid,
      uids: stitchedUids,
      lang,
      author,
      settings,
      allowCrossChapter,
      signal: controller.signal,
      onProgress: ({ packet, stage, message }) => {
        logSuttaFlow('compiler progress', { stage, message });
        updateChapter(chapter.id, { suttaStudio: packet });
        ChapterOps.storeEnhanced({ ...chapter, suttaStudio: packet, id: chapter.id }).catch((e) => {
          console.warn('[SuttaStudio] Failed to persist packet update:', e);
          warnSuttaFlow('persist packet failed', {
            chapterId: chapter.id,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      },
    })
      .catch((e) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('[SuttaStudio] Compiler failed:', e);
        warnSuttaFlow('compiler failed', {
          chapterId: chapter.id,
          error: errorMessage,
        });
        // Update the packet progress state to show error in UI
        const errorPacket = {
          ...chapter.suttaStudio,
          progress: {
            ...chapter.suttaStudio?.progress,
            state: 'error' as const,
            errorMessage,
          },
        };
        updateChapter(chapter.id, { suttaStudio: errorPacket });
      })
      .finally(() => {
        if (compileAbortRef.current === controller) {
          compileAbortRef.current = null;
        }
      });
  }, [author, chapter, chapterMatches, isInitialized, lang, recompile, settings, uid, stitch, allowCrossChapter, updateChapter]);

  const packet = chapterMatches ? chapter?.suttaStudio : null;
  const resolvedPacket = packet ?? (!chapterMatches && uid === 'mn10' ? DEMO_PACKET_MN10 : null);
  const progressPacket = packet ?? resolvedPacket;
  const backToReaderUrl = targetUrl
    ? `/?chapter=${encodeURIComponent(targetUrl)}`
    : '/';

  const totalPhases = progressPacket?.progress?.totalPhases ?? progressPacket?.phases?.length ?? 0;
  const readyPhases = progressPacket?.progress?.readyPhases ?? progressPacket?.phases?.length ?? 0;
  const progressState = progressPacket?.progress?.state;
  const allPhasesDegraded = progressPacket?.phases?.length > 0 &&
    progressPacket.phases.every((p: { degraded?: boolean }) => p.degraded);
  const hasError = progressState === 'error' || allPhasesDegraded;

  useEffect(() => {
    if (!isSuttaFlowDebug()) return;
    let state = 'ready';
    if (dbGate.status === 'checking') state = 'db_checking';
    else if (dbGate.status === 'blocked') state = 'db_blocked';
    else if (!uid) state = 'missing_uid';
    else if (!isInitialized) state = 'store_initializing';
    else if (!resolvedPacket) state = 'fallback_no_packet';
    else if (readyPhases === 0) state = 'fallback_no_ready_phases';

    if (renderGateReason.current === state) return;
    renderGateReason.current = state;

    logSuttaFlow('render state', {
      state,
      uid,
      chapterId: chapter?.id ?? null,
      chapterMatches,
      hasPacket: Boolean(packet),
      hasResolvedPacket: Boolean(resolvedPacket),
      readyPhases,
      totalPhases,
      progressState: progressPacket?.progress?.state ?? null,
    });
  }, [
    chapter?.id,
    chapterMatches,
    dbGate.status,
    isInitialized,
    packet,
    progressPacket?.progress?.state,
    readyPhases,
    resolvedPacket,
    totalPhases,
    uid,
  ]);

  if (dbGate.status === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader text="Checking database..." />
      </div>
    );
  }

  if (dbGate.status === 'blocked' && dbGate.result) {
    return <MigrationRecovery versionCheck={dbGate.result} onRetry={() => window.location.reload()} />;
  }

  if (!uid) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-slate-500">Missing sutta id. Use /sutta/&lt;uid&gt;.</div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader text="Initializing Sutta Studio..." />
      </div>
    );
  }

  if (!resolvedPacket) {
    return (
      <SuttaStudioFallback
        chapter={chapter}
        backToReaderUrl={backToReaderUrl}
        progress={progressPacket?.progress ?? null}
        canonicalSegments={progressPacket?.canonicalSegments ?? null}
      />
    );
  }

  if (readyPhases === 0) {
    return (
      <SuttaStudioFallback
        chapter={chapter}
        backToReaderUrl={backToReaderUrl}
        progress={progressPacket?.progress ?? null}
        canonicalSegments={progressPacket?.canonicalSegments ?? null}
      />
    );
  }

  // Show fallback with error when all phases are degraded
  if (hasError) {
    const errorProgress = {
      ...progressPacket?.progress,
      state: 'error' as const,
      errorMessage: allPhasesDegraded
        ? `All ${progressPacket?.phases?.length} phases degraded: ${progressPacket?.phases?.[0]?.degradedReason || 'Unknown error'}`
        : progressPacket?.progress?.errorMessage,
    };
    return (
      <SuttaStudioFallback
        chapter={chapter}
        backToReaderUrl={backToReaderUrl}
        progress={errorProgress}
        canonicalSegments={progressPacket?.canonicalSegments ?? null}
      />
    );
  }

  return (
    <SuttaStudioView packet={resolvedPacket} backToReaderUrl={backToReaderUrl} />
  );
}
