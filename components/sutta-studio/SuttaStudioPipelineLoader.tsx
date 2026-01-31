/**
 * SuttaStudioPipelineLoader.tsx
 *
 * Loads and displays assembled pipeline output from benchmark runs.
 * Route: /sutta/pipeline or /sutta/pipeline?report=<timestamp>
 */

import { useEffect, useState } from 'react';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import { SuttaStudioView } from './SuttaStudioView';
import Loader from '../Loader';

type LoaderState = {
  status: 'loading' | 'ready' | 'error';
  packet: DeepLoomPacket | null;
  error: string | null;
  reportId: string | null;
  availableReports: string[];
};

export function SuttaStudioPipelineLoader() {
  const [state, setState] = useState<LoaderState>({
    status: 'loading',
    packet: null,
    error: null,
    reportId: null,
    availableReports: [],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportParam = params.get('report');
    const pathParam = params.get('path');

    // If a direct path is provided, load from that path
    if (pathParam) {
      loadFromPath(pathParam);
    } else {
      loadPacket(reportParam);
    }
  }, []);

  // Load packet directly from a path (e.g., /reports/sutta-studio/.../packet.json)
  const loadFromPath = async (path: string) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      const response = await fetch(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load packet from ${path}: ${response.status}`);
      }
      const packet = await response.json();

      // Extract report ID from path for display
      const pathParts = path.split('/');
      const reportId = pathParts.find((p) => p.match(/^\d{4}-\d{2}-\d{2}/)) || 'direct';

      setState({
        status: 'ready',
        packet,
        error: null,
        reportId,
        availableReports: [],
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState((s) => ({
        ...s,
        status: 'error',
        error: errorMessage,
      }));
    }
  };

  const loadPacket = async (reportId: string | null) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      // First, get list of available reports
      const reportsResponse = await fetch('/api/sutta-studio/reports');
      if (!reportsResponse.ok) {
        throw new Error('Failed to fetch reports list');
      }
      const { reports } = await reportsResponse.json();

      if (!reports || reports.length === 0) {
        throw new Error('No benchmark reports found. Run the benchmark first.');
      }

      // Use specified report or latest
      const targetReport = reportId || reports[0];

      // Load the packet
      const packetResponse = await fetch(`/api/sutta-studio/reports/${targetReport}/packet.json`);
      if (!packetResponse.ok) {
        if (packetResponse.status === 404) {
          throw new Error(`No assembled packet found for report ${targetReport}. Run benchmark with phasesToTest configured.`);
        }
        throw new Error(`Failed to load packet: ${packetResponse.statusText}`);
      }

      const packet = await packetResponse.json();

      setState({
        status: 'ready',
        packet,
        error: null,
        reportId: targetReport,
        availableReports: reports,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setState((s) => ({
        ...s,
        status: 'error',
        error: errorMessage,
      }));
    }
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Loader text="Loading pipeline output..." />
      </div>
    );
  }

  if (state.status === 'error' || !state.packet) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-red-400 text-lg">Failed to load pipeline output</div>
        <div className="text-slate-400 text-sm max-w-lg text-center">{state.error}</div>
        <div className="mt-4 text-slate-500 text-sm">
          <p>To generate pipeline output:</p>
          <code className="block mt-2 bg-slate-800 px-3 py-2 rounded text-xs">
            npm run bench:sutta-studio
          </code>
        </div>
        {state.availableReports.length > 0 && (
          <div className="mt-6 text-slate-400">
            <p className="mb-2">Available reports:</p>
            <ul className="text-sm space-y-1">
              {state.availableReports.slice(0, 5).map((report) => (
                <li key={report}>
                  <a
                    href={`/sutta/pipeline?report=${report}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {report}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <a
          href="/sutta/demo"
          className="mt-8 text-emerald-400 hover:underline text-sm"
        >
          View demo instead
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Report selector banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Pipeline Output:</span>
          <select
            value={state.reportId || ''}
            onChange={(e) => {
              window.location.href = `/sutta/pipeline?report=${e.target.value}`;
            }}
            className="bg-slate-800 text-slate-200 border border-slate-600 rounded px-2 py-1 text-xs"
          >
            {state.availableReports.map((report) => (
              <option key={report} value={report}>
                {report}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500">
            {state.packet.phases.length} phases
          </span>
          <a
            href="/sutta/demo"
            className="text-emerald-400 hover:underline"
          >
            View demo
          </a>
        </div>
      </div>
      {/* Add padding to account for fixed banner */}
      <div className="pt-10">
        <SuttaStudioView packet={state.packet} backToReaderUrl="/" />
      </div>
    </>
  );
}
