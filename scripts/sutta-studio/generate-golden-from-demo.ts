#!/usr/bin/env npx tsx
/**
 * Generate golden fixture from demoPacket by fetching actual segment data from SuttaCentral.
 *
 * This is the principled approach:
 * 1. Read the demo map to know which segmentIds are needed
 * 2. Fetch actual Pali/English text from SuttaCentral API (source of truth)
 * 3. Generate fixture with correct data
 *
 * Usage: npx tsx scripts/sutta-studio/generate-golden-from-demo.ts
 */

import fs from 'fs/promises';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DemoMap = {
  _description?: string;
  _sourceDemoPacket?: string;
  _workId?: string;
  _notes?: string;
  skeletonPhases: Array<{
    id: string;
    title?: string | null;
    segmentIds: string[];
    _sourceDemoPhases?: string[];
  }>;
};

type CanonicalSegment = {
  ref: { provider: string; workId: string; segmentId: string };
  order: number;
  pali: string;
  baseEnglish: string;
};

type BilaraResponse = {
  root_text: Record<string, string>;
  translation_text: Record<string, string>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch from SuttaCentral API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSuttaCentralSegments(workId: string): Promise<Map<string, { pali: string; english: string }>> {
  const url = `https://suttacentral.net/api/bilarasuttas/${workId}/sujato`;
  console.log(`[SuttaCentral] Fetching ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from SuttaCentral: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as BilaraResponse;
  const segments = new Map<string, { pali: string; english: string }>();

  // Combine Pali (root_text) and English (translation_text)
  for (const [segmentId, pali] of Object.entries(data.root_text || {})) {
    const english = data.translation_text?.[segmentId] || '';
    segments.set(segmentId, { pali, english });
  }

  console.log(`[SuttaCentral] Fetched ${segments.size} segments for ${workId}`);
  return segments;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate fixture
// ─────────────────────────────────────────────────────────────────────────────

async function generate(params: {
  mapPath: string;
  outputPath: string;
}) {
  const mapAbs = path.resolve(params.mapPath);
  const outAbs = path.resolve(params.outputPath);

  // 1. Read demo map
  const mapRaw = await fs.readFile(mapAbs, 'utf8');
  const map = JSON.parse(mapRaw) as DemoMap;

  if (!map?.skeletonPhases?.length) {
    throw new Error('Map file is missing skeletonPhases.');
  }

  const workId = map._workId || 'mn10';
  console.log(`[Generate] Using workId: ${workId}`);

  // 2. Collect unique segment IDs needed
  const segmentIds = map.skeletonPhases.flatMap((phase) => phase.segmentIds);
  const uniqueSegmentIds = Array.from(new Set(segmentIds));
  console.log(`[Generate] Need ${uniqueSegmentIds.length} unique segments: ${uniqueSegmentIds.join(', ')}`);

  // 3. Fetch actual data from SuttaCentral
  const suttaCentralSegments = await fetchSuttaCentralSegments(workId);

  // 4. Build canonical segments from SuttaCentral data
  const canonicalSegments: CanonicalSegment[] = [];
  const missing: string[] = [];

  for (let i = 0; i < uniqueSegmentIds.length; i++) {
    const segmentId = uniqueSegmentIds[i];
    const scData = suttaCentralSegments.get(segmentId);

    if (!scData) {
      missing.push(segmentId);
      continue;
    }

    canonicalSegments.push({
      ref: { provider: 'suttacentral', workId, segmentId },
      order: i,
      pali: scData.pali,
      baseEnglish: scData.english,
    });
  }

  if (missing.length > 0) {
    console.error(`[Generate] ERROR: Missing segments in SuttaCentral: ${missing.join(', ')}`);
    console.error('[Generate] These segment IDs do not exist in the SuttaCentral API.');
    console.error('[Generate] Please update the demo map to use valid segment IDs.');
    throw new Error(`Missing segments: ${missing.join(', ')}`);
  }

  // 5. Build output fixture
  const outputFixture = {
    _description: 'Golden test data generated from SuttaCentral API',
    _source: `Generated from demo map (${path.relative(process.cwd(), mapAbs)})`,
    _lastUpdated: new Date().toISOString().slice(0, 10),
    _workId: workId,
    _apiSource: `https://suttacentral.net/api/bilarasuttas/${workId}/sujato`,

    skeleton: {
      _title: `${workId.toUpperCase()} (from demo packet)`,
      _notes: 'Canonical segments fetched from SuttaCentral API',
      canonicalSegments,
      expectedPhases: map.skeletonPhases,
    },
  };

  await fs.writeFile(outAbs, JSON.stringify(outputFixture, null, 2), 'utf8');
  console.log(`[Generate] Wrote ${outAbs}`);

  // 6. Validate that segments have content
  const emptyPali = canonicalSegments.filter((s) => !s.pali || s.pali.trim() === '');
  if (emptyPali.length > 0) {
    console.warn(`[Generate] WARNING: ${emptyPali.length} segments have empty Pali text:`);
    emptyPali.forEach((s) => console.warn(`  - ${s.ref.segmentId}`));
  }

  // Log segment details for verification
  console.log('\n[Generate] Segment details:');
  for (const seg of canonicalSegments) {
    const wordCount = seg.pali.split(/\s+/).filter(Boolean).length;
    console.log(`  ${seg.ref.segmentId}: ${wordCount} words - "${seg.pali.slice(0, 50)}..."`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const mapPath = process.argv[2] ?? 'test-fixtures/sutta-studio-demo-map.json';
const outputPath = process.argv[3] ?? 'test-fixtures/sutta-studio-golden-from-demo.json';

generate({ mapPath, outputPath }).catch((error) => {
  console.error('[Generate] Failed:', error);
  process.exitCode = 1;
});
