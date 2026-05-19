import React, { useState, useMemo } from 'react';
import type { SoundFormulaSection, ScriptVariant } from '../../../types/liturgy';
import { ProseBlock } from '../ProseBlock';
import { useLiturgySettings } from '../LiturgySettings';

/**
 * Shape: sound-formula — for dharanis and mantras where the *sound* is
 * the point, not the translation.
 *
 * Visual treatment is deliberately monumental: large centered phonemes
 * with generous letter-spacing, no inline English. The framing prose
 * names why this isn't translated; the scholarly reconstruction (if
 * present) is filed as a quiet aside below.
 *
 * If the section carries multiple script representations, the user can
 * click to cycle through them — same model as triple-script-witness.
 * Otherwise the single `native` field (if any) renders below the phonemes.
 */

const SERIF_STACK = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

const SCRIPT_FONT: Record<string, string> = {
  Latn: SERIF_STACK,
  Deva: "'Noto Serif Devanagari', 'Cardo', serif",
  Tibt: "'Noto Serif Tibetan', 'Cardo', serif",
  Hant: "'Noto Serif SC', serif",
  Hans: "'Noto Serif SC', serif",
  Jpan: "'Noto Serif JP', serif",
  Hang: "'Noto Serif KR', serif",
};

// Per-script size multipliers — same values used in TripleScriptWitness.
const SCRIPT_SIZE_MULTIPLIER: Record<string, number> = {
  Latn: 1.0,
  Deva: 1.05,
  Hant: 1.2,
  Hans: 1.2,
  Jpan: 1.2,
  Tibt: 1.1,
  Hang: 1.15,
};

function scriptSubtag(lang: string): string {
  const parts = lang.split('-');
  return parts.length >= 2 ? parts[1] : 'Latn';
}

function deriveScripts(section: SoundFormulaSection): ScriptVariant[] {
  if (section.scripts && section.scripts.length > 0) return section.scripts;
  const out: ScriptVariant[] = [
    { lang: 'sa-Latn', label: 'Phonemic', text: section.phonemes },
  ];
  if (section.native) {
    out.push({ lang: 'sa-Deva', label: 'Native', text: section.native });
  }
  return out;
}

const FormulaLine: React.FC<{ variant: ScriptVariant }> = ({ variant }) => {
  const { settings } = useLiturgySettings();
  const script = scriptSubtag(variant.lang);
  const fontFamily = SCRIPT_FONT[script] ?? SCRIPT_FONT.Latn;
  const showTranslit =
    settings.showTransliteration && script !== 'Latn' && Boolean(variant.transliteration);
  return (
    <>
      <div
        className="text-center leading-relaxed text-slate-100 tracking-wide select-text"
        style={{
          fontFamily,
          letterSpacing: script === 'Latn' ? '0.05em' : undefined,
          fontSize: `calc(${3 * (SCRIPT_SIZE_MULTIPLIER[script] ?? 1)}rem * var(--liturgy-scale, 1))`,
        }}
        lang={variant.lang}
      >
        {variant.text}
      </div>
      {showTranslit && (
        <div
          className="text-center text-slate-500 italic text-base mt-2 leading-relaxed select-text"
          style={{ fontFamily: SCRIPT_FONT.Latn }}
          aria-label={`Transliteration of ${variant.label}`}
        >
          {variant.transliteration}
        </div>
      )}
    </>
  );
};

const ScriptDots: React.FC<{
  variants: ScriptVariant[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}> = ({ variants, activeIdx, onSelect }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hovered = hoveredIdx !== null ? variants[hoveredIdx] : null;
  return (
    <div
      className="relative inline-flex gap-2 items-center"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {variants.map((v, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              active
                ? 'bg-emerald-400/70'
                : 'border border-slate-700 bg-transparent hover:border-emerald-400/60'
            }`}
            aria-label={`Show ${v.label}${active ? ' (active)' : ''}`}
          />
        );
      })}
      {hovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 px-2.5 py-1.5 rounded bg-slate-900/85 border border-slate-800 shadow-lg text-[11px] whitespace-nowrap pointer-events-none">
          <span className="text-slate-300">{hovered.label}</span>
        </div>
      )}
    </div>
  );
};

export const SoundFormula: React.FC<{
  section: SoundFormulaSection;
  isOpening?: boolean;
}> = ({ section, isOpening = false }) => {
  const variants = useMemo(() => deriveScripts(section), [section]);
  const [idx, setIdx] = useState(0);
  const active = variants[idx % variants.length] ?? variants[0];

  const sectionClass = isOpening
    ? 'min-h-[80vh] flex flex-col items-center justify-center px-6 py-16'
    : 'pt-16 pb-16 px-6 border-t border-slate-900';

  const cycle = () => {
    if (variants.length <= 1) return;
    setIdx((i) => (i + 1) % variants.length);
  };

  return (
    <section className={sectionClass} id={section.id}>
      <div className="w-full max-w-3xl mx-auto">
        {section.framing && (
          <ProseBlock
            text={section.framing}
            className="space-y-3 text-slate-400 text-sm italic leading-relaxed mb-12 max-w-xl mx-auto text-center"
          />
        )}

        <div
          className="cursor-pointer select-text"
          onClick={cycle}
          title={variants.length > 1 ? `Click to switch script (${active.label})` : undefined}
        >
          <FormulaLine variant={active} />
        </div>

        {variants.length > 1 && (
          <div className="mt-8 flex justify-center">
            <ScriptDots variants={variants} activeIdx={idx} onSelect={setIdx} />
          </div>
        )}

        {section.reconstruction && (
          <div className="mt-16 max-w-xl mx-auto">
            <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-2 text-center">
              Scholarly reconstruction
            </div>
            <ProseBlock
              text={section.reconstruction}
              className="space-y-3 text-slate-500 text-xs italic leading-relaxed text-center"
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default SoundFormula;
