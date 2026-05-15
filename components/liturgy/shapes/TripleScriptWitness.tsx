import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  TripleScriptWitnessSection,
  TripleScriptWitnessSegment,
  WordGloss,
} from '../../../types/liturgy';
import { Tooltip } from '../../sutta-studio/Tooltip';
import { ProseBlock } from '../ProseBlock';

/**
 * Shape: triple-script-witness — per-segment interleaved layout.
 *
 * Each segment renders as a Pāli line directly above its English line.
 * The next segment follows. No "all Pāli then all English" bulk.
 *
 * Borrowed from Sutta Studio:
 *  - Tooltip component (hover popover with auto-flip / viewport-clamp)
 *  - Color + typography aesthetic (Cardo serif, slate palette, emerald accent)
 *
 * Liturgy-specific (no equivalent in Sutta Studio):
 *  - Witness cycling per segment (MAPLE → Sujato → Thanissaro)
 *  - Script cycling per section (roman ↔ Devanāgarī)
 *  - The "stone marker" opening treatment
 *
 * Audit-panel intent: hover a Pāli word → Tooltip shows pronunciation,
 * etymology, gloss. No inline structure dump. Citation chips and deeper
 * detail will move to a real slide-in audit panel in the next iteration;
 * this iteration delivers the interleave + hover-glimpse.
 */

const SERIF_STACK = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const DEVA_STACK = "'Noto Serif Devanagari', 'Cardo', serif";

/** Tokenise a Pāli line into hover-enabled words + plain gaps. */
function tokenize(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  const re = /([A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+|[^A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    const isWord = /^[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+$/.test(tok);
    out.push({ kind: isWord ? 'word' : 'gap', text: tok });
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?"'()\[\]।॥-]/g, '').trim();
}

function buildWordIndex(words: WordGloss[]): Map<string, WordGloss> {
  const idx = new Map<string, WordGloss>();
  for (const w of words) {
    const key = normalizeForMatch(w.form);
    if (key) idx.set(key, w);
  }
  return idx;
}

function matchWord(token: string, idx: Map<string, WordGloss>): WordGloss | undefined {
  const norm = normalizeForMatch(token);
  if (!norm) return undefined;
  if (idx.has(norm)) return idx.get(norm);
  // Prefix / inflected-form fallback
  for (const [key, w] of idx) {
    if (key.length >= 3 && (norm.startsWith(key) || key.startsWith(norm))) {
      return w;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// SegmentRow — one chant phrase: Pāli line + English line, paired
// ─────────────────────────────────────────────────────────────────────────────

const HoverWord: React.FC<{
  text: string;
  word: WordGloss;
}> = ({ text, word }) => {
  const [open, setOpen] = useState(false);
  // The tooltip body: pronunciation + etymology + gloss in a compact stack.
  const tooltipText = [
    word.pronunciation ? `[${word.pronunciation}]` : '',
    word.etymology ?? '',
    word.gloss,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      className="relative inline-block cursor-help border-b border-dotted border-emerald-700/40 hover:border-emerald-300 hover:text-emerald-100 transition-colors"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {text}
      <AnimatePresence>
        {open && <Tooltip text={tooltipText} />}
      </AnimatePresence>
    </span>
  );
};

const PaliLine: React.FC<{
  text: string;
  words?: WordGloss[];
  large?: boolean;
}> = ({ text, words = [], large = false }) => {
  const idx = buildWordIndex(words);
  const tokens = tokenize(text);
  const sizeClass = large ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';

  return (
    <div
      className={`text-slate-100 leading-loose ${sizeClass}`}
      style={{ fontFamily: SERIF_STACK }}
    >
      {tokens.map((t, i) => {
        if (t.kind === 'gap') return <React.Fragment key={i}>{t.text}</React.Fragment>;
        const word = matchWord(t.text, idx);
        if (!word) return <React.Fragment key={i}>{t.text}</React.Fragment>;
        return <HoverWord key={i} text={t.text} word={word} />;
      })}
    </div>
  );
};

const SegmentRow: React.FC<{
  segment: TripleScriptWitnessSegment;
  script: 'roman' | 'deva';
  primaryWitness: string;
  large?: boolean;
}> = ({ segment, script, primaryWitness, large = false }) => {
  const witnessStart = Math.max(
    0,
    segment.witnesses.findIndex((w) => w.by === primaryWitness)
  );
  const [witnessIdx, setWitnessIdx] = useState(witnessStart);
  const currentWitness = segment.witnesses[witnessIdx];

  const cycleWitness = () => {
    if (segment.witnesses.length <= 1) return;
    setWitnessIdx((w) => (w + 1) % segment.witnesses.length);
  };

  return (
    <div className="mb-8" id={segment.id}>
      {/* Pali line */}
      <div className="text-center">
        {script === 'roman' ? (
          <PaliLine text={segment.pali} words={segment.words} large={large} />
        ) : segment.paliDeva ? (
          <div
            className={`text-slate-100 leading-loose ${large ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
            style={{ fontFamily: DEVA_STACK }}
            lang="pi-Deva"
          >
            {segment.paliDeva}
          </div>
        ) : (
          <PaliLine text={segment.pali} words={segment.words} large={large} />
        )}
      </div>

      {/* English line — clickable to cycle witnesses */}
      {currentWitness && (
        <button
          type="button"
          onClick={cycleWitness}
          disabled={segment.witnesses.length <= 1}
          className="group block w-full text-center cursor-pointer disabled:cursor-default mt-2 px-2 py-1 rounded hover:bg-slate-900/40 transition-colors"
          title={
            segment.witnesses.length > 1
              ? `Click to cycle witness (${witnessIdx + 1}/${segment.witnesses.length})`
              : undefined
          }
        >
          <div
            className="text-slate-300 italic leading-relaxed text-base md:text-lg"
            style={{ fontFamily: SERIF_STACK }}
          >
            {currentWitness.text}
          </div>
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section — wraps multiple segments + script cycle + repetitions
// ─────────────────────────────────────────────────────────────────────────────

const Dots: React.FC<{ active: number; total: number }> = ({ active, total }) => {
  if (total <= 1) return null;
  return (
    <span className="inline-flex gap-1 items-center align-middle">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block w-1 h-1 rounded-full ${
            i === active ? 'bg-emerald-400' : 'bg-slate-700'
          }`}
        />
      ))}
    </span>
  );
};

export const TripleScriptWitness: React.FC<{
  section: TripleScriptWitnessSection;
  primaryWitness: string;
  isOpening?: boolean;
}> = ({ section, primaryWitness, isOpening = false }) => {
  const hasDeva = section.segments.some((s) => s.paliDeva);
  const scripts: Array<'roman' | 'deva'> = hasDeva ? ['roman', 'deva'] : ['roman'];
  const [scriptIdx, setScriptIdx] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const currentScript = scripts[scriptIdx];

  const sectionClass = isOpening
    ? 'min-h-[80vh] flex flex-col items-center justify-center px-6 py-16'
    : 'pt-16 pb-16 px-6 border-t border-slate-900';

  return (
    <section className={sectionClass} id={section.id}>
      <div className="w-full max-w-3xl mx-auto">
        {/* Segments interleaved Pali + English */}
        <div className="space-y-2">
          {section.segments.map((seg) => (
            <SegmentRow
              key={seg.id}
              segment={seg}
              script={currentScript}
              primaryWitness={primaryWitness}
              large={isOpening}
            />
          ))}
        </div>

        {/* Three dots for repetition (3×) — visual rhythm, not parenthetical */}
        {section.repetitions && section.repetitions > 1 && (
          <div className="text-center text-slate-500 text-2xl tracking-[0.5em] mt-8 mb-4 select-none">
            {'•'.repeat(section.repetitions).split('').join(' ')}
          </div>
        )}

        {/* Section-level footer: script cycle hint + notes affordance */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
          {scripts.length > 1 && (
            <button
              type="button"
              onClick={() => setScriptIdx((s) => (s + 1) % scripts.length)}
              className="flex items-center gap-2 hover:text-emerald-300 transition-colors"
              title="Cycle script (Pāli ↔ Devanāgarī)"
            >
              <Dots active={scriptIdx} total={scripts.length} />
              <span className="uppercase tracking-widest">
                {currentScript === 'roman' ? 'Pāli roman' : 'Devanāgarī'}
              </span>
            </button>
          )}
          {section.commentary && (
            <>
              {scripts.length > 1 && <span className="text-slate-700">·</span>}
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className="uppercase tracking-widest hover:text-emerald-300 transition-colors"
              >
                {notesOpen ? '× notes' : 'notes'}
              </button>
            </>
          )}
        </div>

        {notesOpen && section.commentary && (
          <ProseBlock
            text={section.commentary}
            className="space-y-3 text-slate-400 text-sm leading-relaxed mt-6 max-w-2xl mx-auto pl-4 border-l border-slate-800"
          />
        )}
      </div>
    </section>
  );
};

export default TripleScriptWitness;
