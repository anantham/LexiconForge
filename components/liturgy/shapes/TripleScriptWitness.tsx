import React, { useState } from 'react';
import type { TripleScriptWitnessSection } from '../../../types/liturgy';
import { ProseBlock } from '../ProseBlock';

/**
 * Shape renderer: triple-script-witness.
 *
 * Default-visible: Pāli (IAST) + Devanāgarī + the curator's home institution's
 * English rendering. Word-by-word, alternative witnesses, and commentary live
 * behind disclosure toggles — the reader can sit with the chant as the sheet
 * shows it, or drill in.
 *
 * Pluralism: alternative renderings are surfaced equally, attributed, never
 * presented as "the" translation. The reader compares and decides.
 */

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs uppercase tracking-widest text-slate-500 mt-6 mb-2">{children}</div>
);

const Toggle: React.FC<{
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}> = ({ label, count, open, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className="text-xs uppercase tracking-widest text-emerald-300/80 hover:text-emerald-200 mt-6 mb-2 flex items-center gap-2"
  >
    <span>{open ? '▾' : '▸'}</span>
    <span>{label}</span>
    {typeof count === 'number' && <span className="text-slate-500">({count})</span>}
  </button>
);

export const TripleScriptWitness: React.FC<{ section: TripleScriptWitnessSection; primaryWitness: string }> = ({
  section,
  primaryWitness,
}) => {
  const [wordsOpen, setWordsOpen] = useState(false);
  const [witnessesOpen, setWitnessesOpen] = useState(false);
  const [commentaryOpen, setCommentaryOpen] = useState(false);

  const primary = section.witnesses.find((w) => w.by === primaryWitness) ?? section.witnesses[0];
  const others = section.witnesses.filter((w) => w !== primary);

  return (
    <section className="border-t border-slate-800 pt-8 mt-8" id={section.id}>
      {/* The chant text itself — Pāli + Devanāgarī side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <pre
          className="whitespace-pre-wrap font-serif text-slate-100 text-lg leading-loose"
          style={{ fontFamily: "'Noto Serif', 'Lora', serif" }}
        >
          {section.pali}
        </pre>
        {section.paliDeva && (
          <pre
            className="whitespace-pre-wrap font-serif text-slate-200 text-lg leading-loose"
            style={{ fontFamily: "'Noto Serif Devanagari', 'Noto Serif', serif" }}
            lang="pi-Deva"
          >
            {section.paliDeva}
          </pre>
        )}
      </div>

      {/* Repetition marker if applicable */}
      {section.repetitions && section.repetitions > 1 && (
        <div className="text-slate-500 text-sm italic mt-2">({section.repetitions}×)</div>
      )}

      {/* Primary English witness — visible by default */}
      <div className="mt-4 text-slate-300 italic leading-relaxed whitespace-pre-line">
        {primary.text}
        <span className="not-italic text-slate-500 text-xs ml-2">— {primary.by}</span>
      </div>

      {/* Disclosure: other witnesses */}
      {others.length > 0 && (
        <>
          <Toggle
            label="Other renderings"
            count={others.length}
            open={witnessesOpen}
            onToggle={() => setWitnessesOpen((v) => !v)}
          />
          {witnessesOpen && (
            <div className="space-y-3 mb-2">
              {others.map((w, i) => (
                <div key={i} className="text-slate-300 leading-relaxed whitespace-pre-line">
                  <div className="text-xs text-slate-500 mb-1">
                    {w.by}
                    {w.license && <span className="ml-2 text-slate-600">· {w.license}</span>}
                    {w.url && (
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-emerald-400/70 hover:text-emerald-300"
                      >
                        source ↗
                      </a>
                    )}
                  </div>
                  <div className="italic">{w.text}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Disclosure: word-by-word */}
      {section.words && section.words.length > 0 && (
        <>
          <Toggle
            label="Word by word"
            count={section.words.length}
            open={wordsOpen}
            onToggle={() => setWordsOpen((v) => !v)}
          />
          {wordsOpen && (
            <dl className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {section.words.map((w, i) => (
                <React.Fragment key={i}>
                  <dt className="text-emerald-200 font-mono whitespace-nowrap">
                    {w.form}
                    {w.scriptAlt && (
                      <span className="ml-2 text-slate-400 font-serif" lang="pi-Deva">
                        {w.scriptAlt}
                      </span>
                    )}
                    {w.root && <span className="ml-2 text-slate-500 italic">({w.root})</span>}
                  </dt>
                  <dd className="text-slate-300">
                    <ProseBlock text={w.gloss} className="" />
                    {w.note && <div className="text-slate-500 text-xs mt-1">{w.note}</div>}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </>
      )}

      {/* Disclosure: commentary */}
      {section.commentary && (
        <>
          <Toggle
            label="Commentary"
            open={commentaryOpen}
            onToggle={() => setCommentaryOpen((v) => !v)}
          />
          {commentaryOpen && (
            <ProseBlock
              text={section.commentary}
              className="space-y-3 text-slate-300 leading-relaxed bg-slate-900/40 border-l-2 border-emerald-700/40 pl-4 py-2 rounded-r"
            />
          )}
        </>
      )}
    </section>
  );
};

export default TripleScriptWitness;
