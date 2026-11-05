import { Fragment, useState } from 'react';
import { sanskritReading } from './sanskritReading';
import { Tooltip } from './Tooltip';

/** Contextual reading aid: never changes the word's selected English sense. */
export function SanskritReadingTooltip({ iast, note, pinned, onClose }: {
  iast: string;
  note: string;
  pinned: boolean;
  onClose: () => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const reading = sanskritReading(iast);
  return (
    <Tooltip text={`${iast}:${pinned}:${showNote ? note : reading?.devanagari ?? ''}`} interactive={pinned}>
      <div data-sanskrit-reading="true" role={pinned ? 'dialog' : 'tooltip'} aria-label={`Reading ${iast}`}>
        <div className="flex justify-between gap-4 text-[10px] text-slate-500 mb-1">
          <span>{showNote ? 'Draft word note' : 'Devanāgarī · from the IAST text'}</span>
          {pinned && <button type="button" aria-label="Close Sanskrit reading" onClick={e => { e.stopPropagation(); onClose(); }} className="text-slate-300">×</button>}
        </div>
        {showNote ? <p className="max-w-xs">{note}</p> : reading ? <>
          <div lang="sa-Deva" className="text-2xl leading-relaxed text-slate-100" style={{ fontFamily: "'Noto Serif Devanagari', 'Kohinoor Devanagari', 'Devanagari MT', serif" }}>
            {reading.units.map((u, i) => <Fragment key={i}><span className="whitespace-nowrap">{u.text}</span><wbr /></Fragment>)}
          </div>
          <div lang="sa-Latn" className="mt-1 text-sm text-emerald-300 max-w-xs break-words">{reading.units.map(u => u.rom).join(' · ')}</div>
          <p className="mt-1 text-[10px] text-slate-500 max-w-xs">Written sound units (akṣaras), not morphemes or metrical beats. IAST guide, no audio.{iast.includes("'") ? ' ऽ marks an elided a; it is not sounded.' : ''}</p>
        </> : <p>IAST: {iast}. Script conversion unavailable for this spelling.</p>}
        {pinned && <button type="button" className="mt-2 text-[10px] text-slate-400 underline decoration-slate-700 underline-offset-2" onClick={e => { e.stopPropagation(); setShowNote(v => !v); }}>{showNote ? 'Reading' : 'Word note'}</button>}
      </div>
    </Tooltip>
  );
}
