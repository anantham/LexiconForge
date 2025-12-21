import type { AppSettings } from '../../types';

export interface GlossaryEntry {
  source: string;
  target: string;
  note?: string;
}

export interface MetadataPreamble {
  projectName?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  styleNotes?: string | null;
  footnotePolicy?: string | null;
  chapterTitle?: string | null;
  tags?: string[] | null;
  glossary?: GlossaryEntry[] | null;
}

const formatGlossary = (glossary: GlossaryEntry[]): string => {
  if (!glossary.length) return '- Glossary: none';

  const header = '| Source term | Translation | Notes |\n| --- | --- | --- |';
  const rows = glossary.map(entry => {
    const source = entry.source || '';
    const target = entry.target || '';
    const note = entry.note || '';
    return `| ${source} | ${target} | ${note} |`;
  });

  return ['Glossary:', header, ...rows].join('\n');
};

export const buildMetadataPreamble = (meta: MetadataPreamble): string => {
  const {
    projectName,
    sourceLanguage,
    targetLanguage,
    styleNotes,
    footnotePolicy,
    chapterTitle,
    tags,
    glossary,
  } = meta;

  const parts: string[] = [];

  parts.push('Session Context:');
  parts.push(`- Project: ${projectName || 'Unspecified'}`);
  parts.push(`- Source → Target: ${sourceLanguage || 'Unknown'} → ${targetLanguage || 'Unknown'}`);
  if (chapterTitle) {
    parts.push(`- Chapter: ${chapterTitle}`);
  }
  if (tags && tags.length) {
    parts.push(`- Tags: ${tags.join(', ')}`);
  }
  if (styleNotes) {
    parts.push(`- Style cues: ${styleNotes}`);
  }
  if (footnotePolicy) {
    parts.push(`- Footnote policy: ${footnotePolicy}`);
  }

  if (glossary && glossary.length) {
    parts.push('');
    parts.push(formatGlossary(glossary));
  } else {
    parts.push('');
    parts.push('- Glossary: none');
  }

  return parts.join('\n');
};

export const buildPreambleFromSettings = (
  settings: AppSettings,
  overrides: Partial<MetadataPreamble> = {}
): string => {
  const meta: MetadataPreamble = {
    projectName: overrides.projectName ?? (settings as any)?.novelTitle ?? null,
    sourceLanguage: overrides.sourceLanguage ?? (settings as any)?.sourceLanguage ?? null,
    targetLanguage: overrides.targetLanguage ?? settings.targetLanguage ?? null,
    styleNotes: overrides.styleNotes ?? null,
    footnotePolicy: overrides.footnotePolicy ?? null,
    chapterTitle: overrides.chapterTitle ?? null,
    tags: overrides.tags ?? null,
    glossary: overrides.glossary ?? null,
  };

  return buildMetadataPreamble(meta);
};
