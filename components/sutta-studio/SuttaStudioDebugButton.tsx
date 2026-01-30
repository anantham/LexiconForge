import { useState } from 'react';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import { isSuttaFlowDebug } from '../../services/suttaStudioDebug';
import { getPipelineLogs } from '../../services/suttaStudioPipelineLog';
import { ExportService } from '../../services/exportService';

export function SuttaStudioDebugButton({
  packet,
  uid,
}: {
  packet: DeepLoomPacket | null;
  uid?: string | null;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const visible = isSuttaFlowDebug();
  if (!visible) return null;

  const handleDownload = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const logs = getPipelineLogs();
      const safeUid = uid || packet?.source?.workId || 'sutta';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `sutta-debug-${safeUid}-${stamp}.json`;
      const payload = {
        generatedAt: new Date().toISOString(),
        packet,
        logs,
      };
      await ExportService.downloadJSON(payload, fileName);
    } catch (e) {
      console.warn('[SuttaStudioDebug] Failed to download pipeline logs', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="w-9 h-9 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-slate-900/60 transition flex items-center justify-center"
      title="Download Sutta Studio debug bundle"
      aria-label="Download Sutta Studio debug bundle"
      disabled={isSaving}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3a1 1 0 011 1v9.59l2.3-2.3a1 1 0 111.4 1.42l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.42L11 13.6V4a1 1 0 011-1zM5 19a1 1 0 011-1h12a1 1 0 010 2H6a1 1 0 01-1-1z"
        />
      </svg>
    </button>
  );
}
