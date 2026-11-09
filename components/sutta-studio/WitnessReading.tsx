import Xarrow from 'react-xarrows';
import type { TranslationWitness, WitnessAlignment } from '../../types/suttaStudioWitness';
import { alignmentTouches, witnessSpanText } from '../../services/sutta-studio/witnesses';
import { wordDomId } from './utils';

const readingId = (witnessId: string, alignmentId: string) => `witness-${encodeURIComponent(witnessId)}-${encodeURIComponent(alignmentId)}`;

export function WitnessReading({ witness, phaseId, words, activeId, onActive, hoveredSource, showArrows }: {
  witness: TranslationWitness;
  phaseId: string;
  words: string[];
  activeId: string | null;
  onActive: (_id: string | null) => void;
  hoveredSource: { phaseId: string; wordId: string } | null;
  showArrows: boolean;
}) {
  if (witness.content.kind !== 'translation') return null;
  const { alignments, passages } = witness.content;
  const anchored = (edge: WitnessAlignment) => edge.displayAt.phaseId === phaseId && words.includes(edge.displayAt.wordId);
  const readings = alignments.filter(anchored);
  const elsewhere = alignments.filter(e => !anchored(e) && e.sourceSpans.some(s => s.phaseId === phaseId && s.wordIds.some(w => words.includes(w))));
  const unmapped = words.filter(word => !alignments.some(edge => alignmentTouches(edge, phaseId, word))).length;
  return (
    <div data-witness-reading data-witness-id={witness.id} className="w-full max-w-3xl pb-8 border-b border-slate-900/50 text-center">
      {readings.map(edge => {
        const focused = activeId === edge.id || (hoveredSource && alignmentTouches(edge, hoveredSource.phaseId, hoveredSource.wordId));
        const definite = edge.status === 'aligned';
        const domId = readingId(witness.id, edge.id);
        return <details key={edge.id} id={domId}
          onMouseEnter={() => onActive(edge.id)} onMouseLeave={() => onActive(null)}
          onFocus={() => onActive(edge.id)} onBlur={() => onActive(null)}
          className={`rounded p-2 ${focused && definite ? 'bg-emerald-950/40 text-emerald-300' : 'text-slate-400'}`}>
          <summary className="cursor-pointer list-none">
            <span lang={witness.language} dir={witness.direction ?? 'auto'} className="block text-xl md:text-2xl whitespace-pre-wrap break-words">
              {edge.targetSpans.map((span, i) => <span key={i}>{i > 0 ? ' … ' : ''}{witnessSpanText(witness, span)}</span>)}
              {edge.relation === 'omitted' && <span className="text-sm italic">Passage omitted by this witness</span>}
            </span>
            <span className="block text-xs mt-2 opacity-70">
              {edge.targetSpans.map(s => passages.find(p => p.id === s.passageId)?.label).filter((s, i, all) => all.indexOf(s) === i).join(' · ')}
              {edge.status !== 'aligned' ? ` · ${edge.status}` : ' · phrase mapping'}
              {edge.review.status === 'unreviewed' ? ' · unreviewed' : ''}
            </span>
          </summary>
          <div className="text-xs text-slate-400 text-left space-y-2 pt-3">
            <p>{witness.label} · {edge.relation} · {edge.review.status}{edge.review.by ? ` by ${edge.review.by}, ${edge.review.date}` : ''}</p>
            <p>{edge.evidence}</p>
            {edge.sourceSpans.length > 0 && <p>{edge.status === 'uncertain' ? 'Candidate source spans: ' : 'Source spans: '}{edge.sourceSpans.map((span, i) => <span key={i}>
              {i > 0 ? '; ' : ''}<a href={`#${wordDomId(span.phaseId, span.wordIds[0])}`} className="underline">{span.phaseId}: {span.wordIds.join(', ')}</a>
            </span>)}</p>}
            <p>Placement does not assert word-for-word equivalence. This mapping relates whole source spans to the quoted phrase spans.</p>
          </div>
          {showArrows && focused && definite && edge.sourceSpans.flatMap(span => span.wordIds.map(wordId =>
            <Xarrow key={`${span.phaseId}-${wordId}`} start={wordDomId(span.phaseId, wordId)} end={domId}
              color="#34d399" strokeWidth={1} showHead={false} startAnchor="bottom" endAnchor="top"
              dashness={edge.review.status === 'unreviewed'} />
          ))}
        </details>;
      })}
      {elsewhere.map(edge => <p key={edge.id} className="text-xs text-slate-500 py-1">
        {edge.status === 'uncertain' ? 'Possible correspondence' : 'Phrase spans other groups'} · <a href={`#${readingId(witness.id, edge.id)}`} className="underline">See {witness.label} passage</a>
      </p>)}
      {readings.length === 0 && elsewhere.length === 0
        ? <p className="text-xs text-slate-500">No mapped passage for this group in {witness.label}.</p>
        : unmapped > 0 && <p className="text-xs text-slate-500">{unmapped} source {unmapped === 1 ? 'word has' : 'words have'} no asserted correspondence in this group.</p>}
    </div>
  );
}
