import type { CanonicalSegment } from '../../types/suttaStudio';
import { fetchJsonViaProxies } from './dictionary';

const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);

const buildCanonicalSegments = (
  uid: string,
  rootText: Record<string, string>,
  translationText: Record<string, string>
): CanonicalSegment[] => {
  const keys = Object.keys(rootText).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  return keys.map((key, order) => ({
    ref: {
      provider: 'suttacentral',
      workId: uid,
      segmentId: key,
    },
    order,
    pali: rootText[key],
    baseEnglish: translationText[key] || undefined,
  }));
};

export const fetchCanonicalSegmentsForUid = async (
  uid: string,
  author: string,
  signal?: AbortSignal
): Promise<CanonicalSegment[]> => {
  const bilaraUrl = `https://suttacentral.net/api/bilarasuttas/${uid}/${author}`;
  const plexUrl = `https://suttacentral.net/api/suttaplex/${uid}`;

  const [bilaraJson] = await Promise.all([
    fetchJsonViaProxies(bilaraUrl, signal),
    fetchJsonViaProxies(plexUrl, signal).catch((e) => {
      warn('Suttaplex fetch failed, continuing without metadata.', e);
      return null;
    }),
  ]);

  if (!bilaraJson?.root_text) {
    throw new Error(`Bilara API did not return root_text for ${uid}.`);
  }

  const rootText = bilaraJson.root_text as Record<string, string>;
  const translationText = (bilaraJson.translation_text || {}) as Record<string, string>;
  return buildCanonicalSegments(uid, rootText, translationText);
};
