import fs from 'node:fs';
import path from 'node:path';

// Report IDs are directory names emitted by the benchmark, never URL paths.
// ASCII basenames reject separators, drive names, escapes and Windows devices.
export function isSafeReportId(id: string): boolean {
  return typeof id === 'string' && id === id.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id);
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && !path.isAbsolute(relative) &&
    relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

export function findReportPacket(reportsDir: string, reportId: string): string | null {
  if (!isSafeReportId(reportId)) throw new Error('Invalid report ID');
  if (!fs.existsSync(reportsDir)) return null;
  const root = fs.realpathSync(reportsDir);
  const candidates = [
    path.join(root, reportId, 'outputs', 'gemini-3-flash', 'packet.json'),
    path.join(root, reportId, 'packet.json'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const canonical = fs.realpathSync(candidate);
    // Symlinked report/output/packet files must not expose anything outside
    // the canonical reports directory, including a similarly named sibling.
    if (!isContained(root, canonical)) throw new Error('Report packet is outside the reports directory');
    if (fs.statSync(canonical).isFile()) return canonical;
  }
  return null;
}
