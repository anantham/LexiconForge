/**
 * Verifies the auto-resolution wiring: for every Sanskrit / Chinese /
 * Japanese / Tibetan morpheme + word in the Heart Sutra data, query the
 * concept registry by surface form and report what gets tagged.
 *
 * This is a coverage report disguised as a test. It does NOT fail when
 * tokens are unresolved — many surface forms are inflected and won't
 * match citation-form registry entries. It DOES fail if the wiring
 * silently regresses (no tokens at all auto-resolve), which would
 * indicate a normalization or import bug.
 */
import { describe, it, expect } from 'vitest';
import { heartSutra } from '../../../data/liturgy/heart-sutra';
import { conceptsForToken } from '../../../data/concepts/lookup';
import type { WordGloss, WordMorpheme } from '../../../types/liturgy';

type Resolution = {
  segmentId: string;
  surface: string;
  level: 'word' | 'morpheme' | 'scriptMorpheme';
  lang: string;
  script: string;
  resolved: string[];
  explicit?: string[];
};

function languageSubtag(lang: string): string {
  return lang.split('-')[0] ?? lang;
}
function scriptSubtag(lang: string): string {
  const parts = lang.split('-');
  return parts.length >= 2 ? parts[1] : 'Latn';
}

function collectResolutions(): Resolution[] {
  const out: Resolution[] = [];
  for (const section of heartSutra.sections) {
    if ((section as any).shape !== 'triple-script-witness') continue;
    const segments = (section as any).segments as Array<{
      id: string;
      scripts?: { lang: string }[];
      words?: WordGloss[];
    }>;
    if (!segments) continue;
    for (const seg of segments) {
      const segId = seg.id;
      const scripts = seg.scripts;
      const words = seg.words;
      if (!words || !scripts) continue;
      for (const word of words) {
        // Word-level resolution per script
        for (const variant of scripts) {
          const lang = variant.lang;
          let surface: string | undefined;
          if (scriptSubtag(lang) === 'Latn' && languageSubtag(lang) === 'sa') surface = word.form;
          else if (scriptSubtag(lang) === 'Deva') surface = word.scriptAlt;
          else surface = word.scriptAlts?.[lang];
          if (!surface) continue;
          const resolved = conceptsForToken(languageSubtag(lang), scriptSubtag(lang), surface);
          if (resolved.length > 0 || word.conceptIds) {
            out.push({
              segmentId: segId,
              surface,
              level: 'word',
              lang: languageSubtag(lang),
              script: scriptSubtag(lang),
              resolved,
              explicit: word.conceptIds,
            });
          }
        }
        // Morpheme-level (Sanskrit IAST)
        if (word.morphemes) {
          for (const m of word.morphemes) {
            const resolved = conceptsForToken('sa', 'Latn', m.text);
            if (resolved.length > 0 || m.conceptIds) {
              out.push({
                segmentId: segId,
                surface: m.text,
                level: 'morpheme',
                lang: 'sa',
                script: 'Latn',
                resolved,
                explicit: m.conceptIds,
              });
            }
          }
        }
        // scriptMorphemes (CJK / Tibetan)
        if (word.scriptMorphemes) {
          for (const [lang, morphs] of Object.entries(word.scriptMorphemes)) {
            for (const m of morphs as WordMorpheme[]) {
              const resolved = conceptsForToken(languageSubtag(lang), scriptSubtag(lang), m.text);
              if (resolved.length > 0 || m.conceptIds) {
                out.push({
                  segmentId: segId,
                  surface: m.text,
                  level: 'scriptMorpheme',
                  lang: languageSubtag(lang),
                  script: scriptSubtag(lang),
                  resolved,
                  explicit: m.conceptIds,
                });
              }
            }
          }
        }
      }
    }
  }
  return out;
}

describe('Heart Sutra concept-coverage', () => {
  const resolutions = collectResolutions();

  it('auto-resolves a non-trivial number of tokens (sanity)', () => {
    const autoResolved = resolutions.filter((r) => r.resolved.length > 0);
    expect(autoResolved.length).toBeGreaterThan(20);
  });

  it('per-segment coverage report', () => {
    const bySeg = new Map<string, Resolution[]>();
    for (const r of resolutions) {
      const list = bySeg.get(r.segmentId) ?? [];
      list.push(r);
      bySeg.set(r.segmentId, list);
    }
    const report: string[] = [];
    for (const [segId, list] of bySeg) {
      const auto = list.filter((r) => r.resolved.length > 0);
      const onlyExplicit = list.filter((r) => r.resolved.length === 0 && r.explicit);
      report.push(`\n[${segId}] ${list.length} tagged tokens · ${auto.length} auto · ${onlyExplicit.length} explicit-only`);
      for (const r of list.slice(0, 10)) {
        const ids = r.resolved.length > 0 ? r.resolved.join(',') : `(explicit:${r.explicit?.join(',')})`;
        report.push(`  ${r.level} ${r.lang}-${r.script} "${r.surface}" → ${ids}`);
      }
    }
    // Write the report to a file so we can inspect it outside vitest's
    // log-capture defaults.
    const fs = require('fs');
    const path = require('path');
    const outPath = path.join('/tmp', 'heart-sutra-concept-coverage.txt');
    fs.writeFileSync(outPath, report.join('\n'));
    // eslint-disable-next-line no-console
    console.log(`\nCoverage report written to ${outPath}`);
    expect(bySeg.size).toBeGreaterThan(5);
  });

  it('opening-practice retains its known auto-resolutions', () => {
    const seg = resolutions.filter((r) => r.segmentId === 'opening-practice');
    const prajna = seg.find((r) => r.surface === 'prajñā');
    expect(prajna?.resolved).toContain('concept.wisdom-prajna');
    const paramita = seg.find((r) => r.surface === 'pāramitā');
    expect(paramita?.resolved).toContain('concept.perfection-paramita');
  });
});
