import React, { useState } from 'react';
import type { WordGloss } from '../../types/liturgy';

/**
 * A line of Pāli text where each known word becomes hover-enabled.
 * Tokens are matched against the section's `words` array by form
 * (case-insensitive, punctuation-stripped). Matched tokens get a subtle
 * dotted underline + tooltip on hover. Unmatched text renders plain.
 *
 * Sutta Studio aesthetic: minimal default, hint on hover, no toggles.
 */

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?"'()\[\]।॥]/g, '').trim();
}

/** Split a Pali line into tokens preserving whitespace/punctuation structure. */
function tokenize(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  // Split on whitespace AND punctuation, keeping both
  const re = /([A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁṬṬāĀīĪūŪṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+|[^A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    const isWord = /^[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+$/.test(tok);
    out.push({ kind: isWord ? 'word' : 'gap', text: tok });
  }
  return out;
}

export const PaliLine: React.FC<{
  text: string;
  words?: WordGloss[];
  className?: string;
}> = ({ text, words = [], className }) => {
  const [hovered, setHovered] = useState<{ form: string; gloss: string; root?: string; scriptAlt?: string } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Index words by normalized form for O(1) lookup. Multiple forms can map
  // to the same word (e.g., "buddhaṁ" and "buddha" both → buddha entry).
  const wordIndex = new Map<string, WordGloss>();
  const glosses: WordGloss[] = words;
  for (const w of glosses) {
    const key = normalizeForMatch(w.form);
    if (key) wordIndex.set(key, w);
  }

  const tokens = tokenize(text);

  return (
    <div className="relative">
      <pre
        className={
          className ??
          'whitespace-pre-wrap font-serif text-slate-100 text-lg leading-loose m-0'
        }
        style={{ fontFamily: "'Noto Serif', 'Lora', serif" }}
      >
        {tokens.map((t, i) => {
          if (t.kind === 'gap') return <React.Fragment key={i}>{t.text}</React.Fragment>;
          const norm = normalizeForMatch(t.text);
          // Try exact match, then prefix matches in word index (for inflected forms)
          let match: WordGloss | undefined = wordIndex.get(norm);
          if (!match) {
            for (const [key, w] of wordIndex) {
              if (norm.startsWith(key) || key.startsWith(norm)) {
                if (key.length >= 3) {
                  match = w;
                  break;
                }
              }
            }
          }
          if (!match) {
            return <React.Fragment key={i}>{t.text}</React.Fragment>;
          }
          return (
            <span
              key={i}
              className="cursor-help border-b border-dotted border-emerald-700/40 hover:border-emerald-300 hover:text-emerald-100 transition-colors"
              onMouseEnter={(e) => {
                setHovered({
                  form: match!.form,
                  gloss: match!.gloss,
                  root: match!.root,
                  scriptAlt: match!.scriptAlt,
                });
                const rect = (e.currentTarget as HTMLSpanElement).getBoundingClientRect();
                setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
              }}
              onMouseLeave={() => setHovered(null)}
            >
              {t.text}
            </span>
          );
        })}
      </pre>
      {hovered && (
        <div
          className="fixed z-50 max-w-xs px-3 py-2 rounded bg-slate-900 border border-emerald-700/40 shadow-xl text-sm pointer-events-none"
          style={{ left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
        >
          <div className="text-emerald-200 font-mono">
            {hovered.form}
            {hovered.scriptAlt && (
              <span className="ml-2 text-slate-400 font-serif" lang="pi-Deva">
                {hovered.scriptAlt}
              </span>
            )}
            {hovered.root && <span className="ml-2 text-slate-500 italic">({hovered.root})</span>}
          </div>
          <div className="text-slate-300 mt-1 leading-snug">{hovered.gloss}</div>
        </div>
      )}
    </div>
  );
};

export default PaliLine;
