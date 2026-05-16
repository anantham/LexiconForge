import React from 'react';

/**
 * Minimal markdown-lite renderer for commentary/prose strings.
 *
 * Handles only what we actually need:
 *   - Paragraph breaks on blank lines
 *   - **bold** and *italic* inline
 *   - `code` inline
 *   - [[wiki-term]] inline — rendered as a subtle italic glossary cue
 *   - {{lang|text}} inline — emits <span lang="…"> with a script-appropriate
 *     font stack so Devanāgarī / Tibetan / CJK render correctly inline
 *     without forcing the whole paragraph into a non-Latin font.
 *
 * Deliberately not a full markdown parser. If the text needs richer
 * formatting, lift it into structured fields on the section type.
 */

const SCRIPT_FONTS: Record<string, string> = {
  sa: "'Noto Serif Devanagari', 'Cardo', serif",
  hi: "'Noto Serif Devanagari', 'Cardo', serif",
  bo: "'Noto Serif Tibetan', 'Cardo', serif",
  zh: "'Noto Serif SC', 'Cardo', serif",
  ja: "'Noto Serif JP', 'Cardo', serif",
};

const INLINE_PATTERNS: Array<{ re: RegExp; wrap: (m: string) => React.ReactNode }> = [
  { re: /\*\*([^*]+)\*\*/g, wrap: (m) => <strong>{m}</strong> },
  { re: /\[\[([^\]]+)\]\]/g, wrap: (m) => <em className="text-emerald-300/90 not-italic font-medium">{m}</em> },
  {
    re: /\{\{([a-z]{2,3}\|[^}]+)\}\}/g,
    wrap: (inner) => {
      const sep = inner.indexOf('|');
      const lang = inner.slice(0, sep);
      const text = inner.slice(sep + 1);
      const fontFamily = SCRIPT_FONTS[lang];
      return (
        <span lang={lang} style={fontFamily ? { fontFamily } : undefined}>
          {text}
        </span>
      );
    },
  },
  { re: /\*([^*]+)\*/g, wrap: (m) => <em>{m}</em> },
  { re: /`([^`]+)`/g, wrap: (m) => <code className="text-emerald-300/90">{m}</code> },
];

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Find earliest pattern match; recursively render before/after.
  let earliest: { idx: number; len: number; inner: string; wrap: (m: string) => React.ReactNode } | null = null;
  for (const { re, wrap } of INLINE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && (earliest === null || m.index < earliest.idx)) {
      earliest = { idx: m.index, len: m[0].length, inner: m[1], wrap };
    }
  }
  if (!earliest) return [text];

  const before = text.slice(0, earliest.idx);
  const after = text.slice(earliest.idx + earliest.len);
  return [
    ...(before ? renderInline(before, keyPrefix + 'b') : []),
    <React.Fragment key={keyPrefix + 'w'}>{earliest.wrap(earliest.inner)}</React.Fragment>,
    ...(after ? renderInline(after, keyPrefix + 'a') : []),
  ];
}

export const ProseBlock: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={className ?? 'space-y-3 text-slate-300 leading-relaxed'}>
      {paragraphs.map((p, i) => (
        <p key={i}>{renderInline(p, `p${i}-`)}</p>
      ))}
    </div>
  );
};

export default ProseBlock;
