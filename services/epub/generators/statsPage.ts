import { TranslationStats, EpubTemplate, TelemetryInsights } from '../types';
import { escapeXml } from '../sanitizers/xhtmlSanitizer';

/**
 * Generates a detailed statistics and acknowledgments page
 */
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
    renderRow('EPUB exports', telemetry.exports?.epub)
  ].filter(Boolean).join('');

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

export const generateStatsAndAcknowledgments = (stats: TranslationStats, template: EpubTemplate, telemetry?: TelemetryInsights): string => {
  let html = `<h1 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 1em;">Acknowledgments</h1>\n\n`;

  // Project description
  html += `<div style="margin: 2em 0; padding: 1.5em; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
`;
  html += `<h2 style="margin-top: 0; color: #007bff;">About This Translation</h2>
`;
  html += `<p>${escapeXml(template.projectDescription || '')}</p>
`;
  if (template.githubUrl) {
    html += `<p><strong>Source Code:</strong> <a href="${escapeXml(template.githubUrl)}" style="color: #007bff;">${escapeXml(template.githubUrl)}</a></p>
`;
  }
  html += `</div>\n\n`;

  // Translation statistics
  html += `<div style="margin: 2em 0;">
`;
  html += `<h2 style="color: #28a745; border-bottom: 1px solid #28a745; padding-bottom: 0.5em;">Translation Statistics</h2>
`;
  
  html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em; margin: 1em 0;">
`;
  html += `  <div style="text-align: center; padding: 1em; background: #e7f3ff; border-radius: 8px;">
`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #007bff;">${stats.chapterCount}</div>
`;
  html += `    <div style="color: #666;">Chapters</div>
`;
  html += `  </div>
`;
  html += `  <div style="text-align: center; padding: 1em; background: #e7f8e7; border-radius: 8px;">
`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #28a745;">$${stats.totalCost.toFixed(4)}</div>
`;
  html += `    <div style="color: #666;">Total Cost</div>
`;
  html += `  </div>
`;
  html += `  <div style="text-align: center; padding: 1em; background: #fff3e0; border-radius: 8px;">
`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #f57c00;">${Math.round(stats.totalTime)}s</div>
`;
  html += `    <div style="color: #666;">Total Time</div>
`;
  html += `  </div>
`;
  html += `  <div style="text-align: center; padding: 1em; background: #fce4ec; border-radius: 8px;">
`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #c2185b;">${stats.totalTokens.toLocaleString()}</div>
`;
  html += `    <div style="color: #666;">Total Tokens</div>
`;
  html += `  </div>
`;
  if (stats.imageCount > 0) {
    html += `  <div style="text-align: center; padding: 1em; background: #f3e5f5; border-radius: 8px;">
`;
    html += `    <div style="font-size: 2em; font-weight: bold; color: #7b1fa2;">${stats.imageCount}</div>
`;
    html += `    <div style="color: #666;">Images Generated</div>
`;
    html += `  </div>
`;
  }
  html += `</div>
`;
  html += `</div>\n\n`;

  html += renderTelemetryInsights(telemetry);

  // Provider breakdown
  const providers = Object.keys(stats.providerBreakdown);
  if (providers.length > 0) {
    html += `<div style="margin: 2em 0;">
`;
    html += `<h3 style="color: #6f42c1;">Translation Providers Used</h3>
`;
    html += `<table style="width: 100%; border-collapse: collapse; margin: 1em 0;">
`;
    html += `  <thead>
`;
    html += `    <tr style="background: #f8f9fa;">
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: left;">Provider</th>
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Chapters</th>
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Cost</th>
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Time</th>
`;
    html += `    </tr>
`;
    html += `  </thead>
`;
    html += `  <tbody>
`;
    
    providers.forEach(provider => {
      const providerStats = stats.providerBreakdown[provider];
      html += `    <tr>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; font-weight: bold;">${escapeXml(provider)}</td>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${providerStats.chapters}</td>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">$${providerStats.cost.toFixed(4)}</td>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${Math.round(providerStats.time)}s</td>
`;
      html += `    </tr>
`;
    });
    
    html += `  </tbody>
`;
    html += `</table>
`;
    html += `</div>\n\n`;
  }

  // Model breakdown (top 10 most used)
  const models = Object.entries(stats.modelBreakdown)
    .sort(([,a], [,b]) => b.chapters - a.chapters)
    .slice(0, 10);
    
  if (models.length > 0) {
    html += `<div style="margin: 2em 0;">
`;
    html += `<h3 style="color: #dc3545;">AI Models Used</h3>
`;
    html += `<table style="width: 100%; border-collapse: collapse; margin: 1em 0;">
`;
    html += `  <thead>
`;
    html += `    <tr style="background: #f8f9fa;">
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: left;">Model</th>
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Chapters</th>
`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Tokens</th>
`;
    html += `    </tr>
`;
    html += `  </thead>
`;
    html += `  <tbody>
`;
    
    models.forEach(([model, modelStats]) => {
      html += `    <tr>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; font-family: monospace; font-size: 0.9em;">${escapeXml(model)}</td>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${modelStats.chapters}</td>
`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${modelStats.tokens.toLocaleString()}</td>
`;
      html += `    </tr>
`;
    });
    
    html += `  </tbody>
`;
    html += `</table>
`;
    html += `</div>\n\n`;
  }

  // Gratitude message
  html += `<div style="margin: 3em 0; padding: 2em; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
`;
  html += `<h2 style="margin-top: 0; color: white; text-align: center;">Acknowledgments</h2>
`;
  html += `<p style="font-size: 1.1em; line-height: 1.6; text-align: justify;">${escapeXml(template.gratitudeMessage || '')}</p>
`;
  if (template.additionalAcknowledgments) {
    html += `<p style="font-size: 1.1em; line-height: 1.6; text-align: justify;">${escapeXml(template.additionalAcknowledgments)}</p>
`;
  }
  html += `</div>\n\n`;

  // Footer
  if (template.customFooter) {
    html += `<div style="margin: 2em 0; text-align: center; padding: 1em; border-top: 1px solid #dee2e6; font-style: italic; color: #666;">
`;
    html += `${escapeXml(template.customFooter)}
`;
    html += `</div>
`;
  }

  html += `<div style="margin: 2em 0; text-align: center; padding: 1em; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #666;">
`;
  html += `<p><em>Translation completed on ${new Date().toLocaleDateString()}</em></p>
`;
  html += `</div>
`;

  return html;
};
