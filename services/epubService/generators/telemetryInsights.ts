import type { TelemetryInsights } from '../types';

export const renderTelemetryInsights = (telemetry?: TelemetryInsights): string => {
  if (!telemetry) return '';

  const formatMs = (ms: number): string => {
    if (!Number.isFinite(ms)) return '—';
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(minutes >= 10 ? 1 : 2)} min`;
    const hours = minutes / 60;
    return `${hours.toFixed(2)} h`;
  };

  const renderRow = (label: string, data?: { count: number; totalMs: number; averageMs: number }) => {
    if (!data || data.count === 0) return '';
    return `
      <tr>
        <td style="padding: 0.6em; border: 1px solid #e5e7eb;">${label}</td>
        <td style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: center;">${data.count}</td>
        <td style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: center;">${formatMs(data.totalMs)}</td>
        <td style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: center;">${formatMs(data.averageMs)}</td>
      </tr>`;
  };

  const rows = [
    renderRow('Navigation requests', telemetry.navigation),
    renderRow('IndexedDB hydration', telemetry.hydration),
    renderRow('Chapter ready-to-read', telemetry.chapterReady),
    renderRow('JSON exports', telemetry.exports?.json),
    renderRow('EPUB exports', telemetry.exports?.epub),
  ]
    .filter(Boolean)
    .join('');

  let html = `<div style="margin: 2em 0;">
`;
  html += `<h2 style="color: #1a56db; border-bottom: 1px solid #1a56db; padding-bottom: 0.5em;">Session Insights</h2>
`;
  html += `<p style="color: #555;">Recorded via LexiconForge telemetry during preparation of this EPUB.</p>
`;
  html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1em; margin: 1em 0;">
`;
  html += `  <div style="padding: 1em; background: #eef2ff; border-radius: 8px;">
`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #4338ca;">${telemetry.totalEvents.toLocaleString()}</div>
`;
  html += `    <div style="color: #666;">Telemetry Events</div>
`;
  html += `  </div>
`;
  html += `  <div style="padding: 1em; background: #fef3c7; border-radius: 8px;">
`;
  html += `    <div style="font-size: 1.6em; font-weight: bold; color: #b45309;">${formatMs(telemetry.sessionDurationMs)}</div>
`;
  html += `    <div style="color: #666;">Session Duration</div>
`;
  html += `  </div>
`;
  html += `</div>
`;

  if (rows) {
    html += `<table style="width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.95em;">
`;
    html += `  <thead>
`;
    html += `    <tr style="background: #f3f4f6;">
`;
    html += `      <th style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: left;">Activity</th>
`;
    html += `      <th style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: center;">Occurrences</th>
`;
    html += `      <th style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: center;">Total Duration</th>
`;
    html += `      <th style="padding: 0.6em; border: 1px solid #e5e7eb; text-align: center;">Average Duration</th>
`;
    html += `    </tr>
`;
    html += `  </thead>
`;
    html += `  <tbody>
`;
    html += rows;
    html += `  </tbody>
`;
    html += `</table>
`;
  }

  html += `</div>

`;
  return html;
};

