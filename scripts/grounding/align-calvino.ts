#!/usr/bin/env node
/**
 * Stage ALIGN — Calvino (instance #1 of the reusable source-grounding pipeline).
 *
 * Produces a 22-unit bilingual LexiconForge session: Italian original as chapter
 * `content` (the source), Weaver English as `fanTranslation` (the witness),
 * chapter-level alignment (the granularity chosen for this book).
 *
 * Structure (verified 2026-07-11):
 *  - Italian EPUB packs each frame chapter + the incipit that follows it into one
 *    spine file, with the incipit starting at the element id="heading_id_3".
 *    Split there. Files main/Section0001/Section0002 are frontmatter (skip).
 *    Section0009/0010 (XI/XII) are frame-only (no heading_id_3).
 *  - English EPUB extracts cleanly; the 22 real units are the frames titled [1]..[12]
 *    plus the 10 titled incipits, in reading order.
 *
 * This alignment step is intentionally book-tuned (per the pipeline design: alignment
 * is the per-book part driven by books/<slug>/book.json). Grounding + reader are generic.
 *
 * Usage: tsx scripts/grounding/align-calvino.ts <template-session.json> -o out/calvino-session.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { EpubAdapter } from '../lib/adapters/epub-adapter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, 'books/calvino/book.json'), 'utf8'));

const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’“”]/g, "'").replace(/\s+/g, ' ').trim();

const stripToText = (html: string): string => {
  const body = html.replace(/[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*/i, '');
  const paras = [...body.matchAll(/<(p|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => m[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, (e) =>
      ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#8217;': '’', '&#8220;': '“', '&#8221;': '”' } as any)[e] || e).trim())
    .filter((t) => t.length > 0);
  return paras.join('\n\n');
};

// ---- Italian: raw parse + split at heading_id_3 ----
async function italianUnits(): Promise<{ title: string; text: string }[]> {
  const buf = fs.readFileSync(path.join(REPO, MANIFEST.source.epub));
  const zip = await JSZip.loadAsync(buf);
  const opfPath = Object.keys(zip.files).find((f) => f.endsWith('.opf'))!;
  const opf = await zip.file(opfPath)!.async('string');
  const opfDir = path.posix.dirname(opfPath);
  const manifest: Record<string, string> = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest[id] = href;
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  const skip = new Set(['main.xhtml', 'Section0001.xhtml', 'Section0002.xhtml']);

  const units: { title: string; text: string }[] = [];
  for (const idref of spine) {
    const href = manifest[idref];
    if (!href) continue;
    const base = path.posix.basename(href);
    if (skip.has(base)) continue;
    const full = opfDir && opfDir !== '.' ? `${opfDir}/${href}` : href;
    const html = await zip.file(full)?.async('string');
    if (!html) continue;

    const anchor = html.search(/<h[1-6][^>]*id="heading_id_3"/i);
    if (anchor >= 0) {
      // frame = before the incipit heading, incipit = from it onward
      const framePart = html.slice(0, anchor);
      const incipitPart = html.slice(anchor);
      const frameText = stripToText(framePart);
      const incipitText = stripToText(incipitPart);
      if (frameText) units.push({ title: `Frame (${base})`, text: frameText });
      if (incipitText) units.push({ title: incipitText.split('\n')[0].slice(0, 60), text: incipitText });
    } else {
      const text = stripToText(html);
      if (text) units.push({ title: text.split('\n')[0].slice(0, 60), text });
    }
  }
  return units;
}

// ---- English: adapter + filter to the 22 real units, reading order ----
async function englishUnits(): Promise<{ title: string; text: string }[]> {
  const out = await new EpubAdapter().extract(path.join(REPO, MANIFEST.witnesses[0].epub));
  const incipitSet = new Set(MANIFEST.alignment.incipitTitlesEn.map(norm));
  const isFrame = (t: string) => /^\[\d+\]$/.test(t.trim());
  const keep = out.chapters
    .filter((c) => isFrame(c.title) || incipitSet.has(norm(c.title)))
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  return keep.map((c) => ({ title: c.title, text: c.paragraphs.map((p) => p.text).join('\n\n') }));
}

async function main() {
  const args = process.argv.slice(2);
  const template = args[0];
  const outIdx = args.indexOf('-o');
  const outPath = outIdx >= 0 ? args[outIdx + 1] : 'out/calvino-session.json';
  if (!template) throw new Error('usage: align-calvino.ts <template-session.json> -o <out.json>');

  const it = await italianUnits();
  const en = await englishUnits();
  console.log(`Italian units: ${it.length}, English units: ${en.length}`);

  const n = Math.min(it.length, en.length);
  console.log('\n#  | Italian (source)                              | English (Weaver)');
  console.log('---+-----------------------------------------------+------------------');
  for (let i = 0; i < Math.max(it.length, en.length); i++) {
    const itl = (it[i]?.title || '—').slice(0, 45).padEnd(45);
    const enl = (en[i]?.title || '—').slice(0, 40);
    console.log(`${String(i + 1).padStart(2)} | ${itl} | ${enl}`);
  }
  if (it.length !== 22 || en.length !== 22) {
    console.error(`\n⚠️  Expected 22 units each, got IT=${it.length} EN=${en.length}. NOT writing session; inspect the table above.`);
    process.exit(2);
  }

  // Clone template scaffolding, replace chapters
  const session = JSON.parse(fs.readFileSync(template, 'utf8'));
  const sid = (i: number) => `calvino_u${i + 1}`;
  const url = (i: number) => `polyglot://${sid(i)}`;
  interface AlignedChapter {
    stableId: string;
    canonicalUrl: string;
    title: string;
    content: string;
    fanTranslation: string;
    nextUrl: string | undefined;
    prevUrl: string | undefined;
    chapterNumber: number;
    translations: unknown[];
    feedback: unknown[];
  }
  const chapters: AlignedChapter[] = [];
  for (let i = 0; i < 22; i++) {
    chapters.push({
      stableId: sid(i),
      canonicalUrl: url(i),
      title: en[i].title.startsWith('[') ? `Chapter ${en[i].title}` : en[i].title,
      content: it[i].text,
      fanTranslation: en[i].text,
      nextUrl: i < 21 ? url(i + 1) : undefined,
      prevUrl: i > 0 ? url(i - 1) : undefined,
      chapterNumber: i + 1,
      translations: [],
      feedback: [],
    });
  }
  session.chapters = chapters;
  session.urlMappings = chapters.map((c) => ({ url: c.canonicalUrl, stableId: c.stableId, canonicalUrl: c.canonicalUrl }));
  session.navigation = {
    ...(session.navigation || {}),
    history: chapters.map((c) => c.stableId),
    lastActive: { id: chapters[0].stableId },
  };
  if (Array.isArray(session.novels) && session.novels[0]) {
    session.novels[0].title = MANIFEST.title;
  }

  fs.mkdirSync(path.dirname(path.resolve(REPO, outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(REPO, outPath), JSON.stringify(session, null, 2));
  console.log(`\n✅ Wrote ${outPath} — 22 aligned units (IT source + Weaver EN witness).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
