/**
 * Hosted-library entry builder — Aithihyamala for the lexiconforge-novels repo.
 *
 * Emits novels/aithihyamala/{metadata.json, session.json} in EXACTLY the shape
 * `buildHostedLibraryArtifacts` produces (mirrored field-for-field; the generic
 * builder wants adapter-shaped sources, our data is already structured, so we
 * emit directly and reuse the real `generateStableChapterId`).
 *
 * Track A of the two-track pattern: paragraph-parallel reading in the standard
 * app (content = PD Malayalam, fanTranslation = Opus-draft English), with the
 * description pointing at the deep studio reader (/malayalam) as Track B.
 *
 * Run: npx tsx scripts/malayalam/build-hosted-entry.ts <path-to-novels-repo>
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateStableChapterId } from '../../services/stableIdService';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const novelsRoot = process.argv[2];
if (!novelsRoot) {
  console.error('usage: build-hosted-entry.ts <path-to-lexiconforge-novels-repo>');
  process.exit(1);
}

const RAW = fs.readFileSync(path.join(ROOT, 'data/malayalam/urakam-raw.txt'), 'utf8');
const EN: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/malayalam/urakam-english.json'), 'utf8'),
);
// Sentence 1 lives hand-curated in the studio data; its assembled translation:
EN['p01s01'] =
  'At the Ammathiruvadi temple in Urakam, once upon a time, one of the Vazhappilly Menons held first the gate-watch and later the accounts-writing too.';

// ── assemble chapter text (same normalization as build-legend) ──
const paras = RAW.split(/\n{2,}/)
  .map((p) => p.replace(/:{2,}/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .filter((p) => !p.startsWith('വർഗ്ഗം:')); // wiki category line

const content = paras.join('\n\n');

const enParas: string[] = paras.map((p, pi) => {
  const sents = p.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sents
    .map((_, si) => EN[`p${String(pi + 1).padStart(2, '0')}s${String(si + 1).padStart(2, '0')}`] ?? '')
    .filter(Boolean)
    .join(' ');
});
const fanTranslation = enParas.join('\n\n');

// ── shared fields ──
const today = new Date().toISOString().split('T')[0];
const exportedAt = new Date().toISOString();
const NOVEL = {
  id: 'aithihyamala',
  title: 'ഐതിഹ്യമാല — Aithihyamala',
  alternateTitles: ['Aithihyamala', 'The Garland of Legends', 'ഐതിഹ്യമാല'],
  originalLanguage: 'Malayalam',
  targetLanguage: 'English',
  chapterCount: 126,
  genres: ['Folklore', 'Legends', 'Mythology', 'Classics'],
  description:
    "Kerala's great compendium of temple legends — deities acquiring their territories, yakshis and sorcerers, rajas and namboothiris — collected by Kottarathil Sankunni between 1909 and 1934 from people who still remembered them. " +
    'Public domain; Malayalam text from ml.wikisource.org. The English is an unreviewed AI draft, shown for parallel reading, not authority. ' +
    'For the deep reader — every word sounded out, hover meanings, script-anatomy etymology mode — visit /malayalam on this site.',
  author: 'കൊട്ടാരത്തിൽ ശങ്കുണ്ണി (Kottarathil Sankunni)',
  sourceLinks: {
    wikisource: 'https://ml.wikisource.org/wiki/ഐതിഹ്യമാല',
  },
  tags: ['Public Domain', 'Malayalam', 'Kerala', 'Temple Legends', 'Parallel Text'],
  coverImageUrl: 'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/aithihyamala/cover.svg',
  publicationStatus: 'Ongoing (1 of 126 legends)',
};
const VERSION = {
  versionId: 'v1-opus-draft',
  displayName: 'Opus draft translation (2026)',
  translator: { name: 'Claude Opus 4.8 — unreviewed AI draft', link: 'https://read.adityaarpitha.com/malayalam' },
  targetLanguage: 'English',
  style: 'faithful',
  features: [] as string[],
  completionStatus: 'In Progress',
  translationType: 'ai',
  contentNotes:
    'Chapter 64 (ഊരകത്ത് അമ്മതിരുവടി) only, so far. Malayalam is public domain (author d. 1937); English is an original AI draft pending native review.',
};

const chapter = {
  stableId: generateStableChapterId(content, 64, 'ഊരകത്ത് അമ്മതിരുവടി'),
  canonicalUrl: `lexiconforge://${NOVEL.id}/chapter/64`,
  title: 'ഊരകത്ത് അമ്മതിരുവടി — The Ammathiruvadi of Urakam',
  content,
  fanTranslation,
  nextUrl: null,
  prevUrl: null,
  chapterNumber: 64,
  // The book SHIPS with its translation — model it as an ACTIVE translation
  // version, not an empty slot. Otherwise every keyless visitor lands in
  // 'english' view with hasTranslation:false, the visit-triggered
  // auto-translate fires, and the site's trial-key path 401s at them.
  translations: [
    {
      translatedTitle: 'The Ammathiruvadi of Urakam',
      translation: fanTranslation,
      footnotes: [] as unknown[],
      suggestedIllustrations: [] as unknown[],
      provider: 'Claude',
      model: 'claude-opus-4-8',
      isActive: true,
      customVersionLabel: 'Opus draft (unreviewed)',
      systemPrompt: '',
    },
  ],
};

const session = {
  metadata: {
    format: 'lexiconforge-session',
    version: '2.0',
    exportedAt,
    title: NOVEL.title,
    author: NOVEL.author,
    description: NOVEL.description,
    originalLanguage: NOVEL.originalLanguage,
    targetLanguage: NOVEL.targetLanguage,
    chapterCount: NOVEL.chapterCount,
    genres: NOVEL.genres,
    coverImageUrl: NOVEL.coverImageUrl,
    publicationStatus: NOVEL.publicationStatus,
    tags: NOVEL.tags,
    sourceLinks: NOVEL.sourceLinks,
    lastUpdated: today,
  },
  novel: { id: NOVEL.id, title: NOVEL.title, alternateTitles: NOVEL.alternateTitles },
  version: {
    versionId: VERSION.versionId,
    displayName: VERSION.displayName,
    translator: VERSION.translator,
    targetLanguage: VERSION.targetLanguage,
    style: VERSION.style,
    features: VERSION.features,
    contentNotes: VERSION.contentNotes,
  },
  provenance: {
    originalCreator: { name: VERSION.translator.name, link: VERSION.translator.link, versionId: VERSION.versionId, createdAt: exportedAt },
    contributors: [
      { name: VERSION.translator.name, link: VERSION.translator.link, role: 'original-translator', changes: VERSION.contentNotes, dateRange: today },
    ],
  },
  chapters: [chapter],
  settings: {},
};

const metadata = {
  id: NOVEL.id,
  title: NOVEL.title,
  alternateTitles: NOVEL.alternateTitles,
  metadata: {
    originalLanguage: NOVEL.originalLanguage,
    targetLanguage: NOVEL.targetLanguage,
    chapterCount: NOVEL.chapterCount,
    genres: NOVEL.genres,
    description: NOVEL.description,
    coverImageUrl: NOVEL.coverImageUrl,
    author: NOVEL.author,
    sourceLinks: NOVEL.sourceLinks,
    tags: NOVEL.tags,
    publicationStatus: NOVEL.publicationStatus,
    lastUpdated: today,
  },
  versions: [
    {
      versionId: VERSION.versionId,
      displayName: VERSION.displayName,
      translator: VERSION.translator,
      sessionJsonUrl: `https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/${NOVEL.id}/session.json`,
      targetLanguage: VERSION.targetLanguage,
      style: VERSION.style,
      features: VERSION.features,
      chapterRange: { from: 64, to: 64 },
      completionStatus: VERSION.completionStatus,
      lastUpdated: today,
      contentNotes: VERSION.contentNotes,
      stats: {
        downloads: 0,
        fileSize: '0MB',
        content: {
          totalImages: 0,
          totalFootnotes: 0,
          totalRawChapters: 1,
          totalTranslatedChapters: 1,
          avgImagesPerChapter: 0,
          medianImagesPerChapter: 0,
          avgFootnotesPerChapter: 0,
          medianFootnotesPerChapter: 0,
          avgChapterLength: fanTranslation.length,
          medianChapterLength: fanTranslation.length,
        },
        translation: { translationType: VERSION.translationType, feedbackCount: 0 },
      },
    },
  ],
};

const outDir = path.join(novelsRoot, 'novels', NOVEL.id);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'session.json'), JSON.stringify(session, null, 2));
fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
fs.copyFileSync(path.join(ROOT, 'public/malayalam/aithihyamala-cover.svg'), path.join(outDir, 'cover.svg'));

// registry
const regPath = path.join(novelsRoot, 'registry.json');
const registry = JSON.parse(fs.readFileSync(regPath, 'utf8'));
if (!registry.novels.some((n: { id: string }) => n.id === NOVEL.id)) {
  registry.novels.push({
    id: NOVEL.id,
    metadataUrl: `https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/${NOVEL.id}/metadata.json`,
  });
}
registry.lastUpdated = today;
fs.writeFileSync(regPath, JSON.stringify(registry, null, 2));

console.log(`✓ novels/${NOVEL.id}/: session.json (${Math.round(fs.statSync(path.join(outDir, 'session.json')).size / 1024)}KB), metadata.json, cover.svg; registry updated (${registry.novels.length} novels)`);
