import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AlignSegment, AlignRelation, AlignRendering, AlignToken, AlignSegmentPiece } from '../../../types/liturgyAlign';
import { getConcept } from '../../../data/concepts/lookup';

/**
 * Concept-aligned phrase reader (DESIGN.md). Centered classical serif, words in
 * open space, each syllable stacked with its sound. Two hover modes:
 *
 *  • Alignment — reach OUTWARD: a hovered word draws an undirected thread to its
 *    counterpart in every other shown language (matched by meaning). No
 *    arrowheads — no language is the canonical pivot.
 *  • Etymology — reach INWARD: a hovered syllable lights up only itself (glyph +
 *    its sound), everything else dims. Sound ↔ script, one piece at a time.
 *
 * Granularity follows what you grab. Progressive disclosure: one source + English
 * by default; the eye adds a language, ɑ its sound (on for non-Latin). The
 * shipped liturgy reader is the reference.
 */

type Mode = 'align' | 'etym';

const FONT: Record<string, string> = {
  Latn: "'Cardo', 'Gentium Plus', 'Noto Serif', serif",
  Deva: "'Noto Serif Devanagari', 'Cardo', serif",
  Tibt: "'Noto Serif Tibetan', 'Cardo', serif",
  Hant: "'Noto Serif SC', 'Cardo', serif",
  Jpan: "'Noto Serif JP', 'Cardo', serif",
};
const SIZE: Record<string, string> = { Latn: '1.7rem', Deva: '1.85rem', Tibt: '2rem', Hant: '2.05rem', Jpan: '2.05rem' };

const isEnglish = (lang: string) => lang.split('-')[0] === 'en';
const scriptOf = (lang: string) => lang.split('-')[1] ?? 'Latn';
const fontFor = (lang: string) => (isEnglish(lang) ? FONT.Latn : FONT[scriptOf(lang)] ?? FONT.Latn);
const sizeFor = (lang: string) => (isEnglish(lang) ? '1.45rem' : SIZE[scriptOf(lang)] ?? SIZE.Latn);
const parenOf = (s?: string) => s?.match(/\(([^)]+)\)/)?.[1];
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '-');

const C = { ink: '#e2e8f0', match: '#6ee7b7', faint: '#64748b', english: '#94a3b8', sub: '#94a3b8' };
const READING_LABEL: Record<string, string> = { zh: '中', ja: '日', ko: '한', vi: 'vi' };

const Tooltip: React.FC<{ primary: string; secondary?: string }> = ({ primary, secondary }) => (
  <motion.span
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 4 }}
    transition={{ duration: 0.12 }}
    className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-900/95 px-2.5 py-1 text-center shadow-lg pointer-events-none"
    style={{ fontFamily: FONT.Latn, fontStyle: 'normal' }}
  >
    <span className="block text-[13px] text-slate-100">{primary}</span>
    {secondary && <span className="mt-0.5 block text-[11px] text-slate-500">{secondary}</span>}
  </motion.span>
);

/** Smooth path through points, top-to-bottom — an undirected connecting thread. */
function threadPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  return d;
}

const PhraseBlock: React.FC<{
  segment: AlignSegment;
  shown: Record<string, boolean>;
  pron: Record<string, boolean>;
  mode: Mode;
}> = ({ segment, shown, pron, mode }) => {
  const [hot, setHot] = React.useState<string[] | null>(null); // matching unit ids (align mode)
  const [over, setOver] = React.useState<string | null>(null); // hovered piece key
  const [threads, setThreads] = React.useState<{ x: number; y: number }[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const unitById = Object.fromEntries(segment.units.map((u) => [u.id, u]));
  const glossOf = (units: string[]) => units.map((u) => unitById[u]?.gloss).filter(Boolean).join(' · ');
  const piecesOf = (token: AlignToken): AlignSegmentPiece[] =>
    token.segments ?? [{ text: token.text, pronunciation: token.pronunciation, readings: token.readings, gloss: token.gloss, faint: token.relation === 'ghost' }];
  const pieceId = (lang: string, ti: number, si: number) => `pc-${safeId(segment.id)}-${lang}-${ti}-${si}`;

  // Align mode: one centroid per shown row that has a matching piece → an N-point thread.
  const computeThread = (units: string[]) => {
    const container = containerRef.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const pts: { x: number; y: number }[] = [];
    for (const r of segment.renderings) {
      if (!shown[r.lang]) continue;
      const xs: number[] = [], ys: number[] = [];
      r.tokens.forEach((token, ti) => {
        piecesOf(token).forEach((piece, si) => {
          const eu = piece.units ?? token.units;
          if (eu.some((u) => units.includes(u))) {
            const el = document.getElementById(pieceId(r.lang, ti, si));
            if (el) {
              const rc = el.getBoundingClientRect();
              xs.push(rc.left + rc.width / 2 - origin.left);
              ys.push(rc.top + rc.height / 2 - origin.top);
            }
          }
        });
      });
      if (xs.length) pts.push({ x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length });
    }
    setThreads(pts.length >= 2 ? pts : null);
  };

  const buildTip = (token: AlignToken, piece: AlignSegmentPiece | null, effUnits: string[]) => {
    const wordGloss = glossOf(effUnits);
    const node = effUnits.map((u) => unitById[u]?.conceptId).filter(Boolean).map((id) => getConcept(id!)).find(Boolean);
    const src = node ? parenOf(node.preferredLabel) : undefined;
    if (piece?.phonetic) {
      return { primary: `the sound “${piece.gloss}”`, secondary: `part of ${token.text} = ${wordGloss}${src ? ` (${src})` : ''}` };
    }
    let primary = piece?.gloss ?? wordGloss;
    if (!primary) primary = 'a grammar word';
    const chips: string[] = [];
    if (piece?.gloss && wordGloss && piece.gloss.toLowerCase() !== wordGloss.toLowerCase() && !piece.faint) chips.push(`within “${wordGloss}”`);
    switch (token.relation) {
      case 'transliteration': chips.push(src ? `sounds like ${src}` : 'a sound, not a meaning'); break;
      case 'calque': chips.push('built piece-by-piece'); if (src) chips.push(src); break;
      case 'ghost': chips.push('grammar this language adds'); break;
      default: if (src) chips.push(src);
    }
    const seen = new Set<string>();
    const secondary = chips.filter((c) => {
      const k = c.toLowerCase();
      if (seen.has(k) || primary.toLowerCase().includes(k)) return false;
      seen.add(k);
      return true;
    }).join(' · ');
    return { primary, secondary };
  };

  const Line: React.FC<{ r: AlignRendering }> = ({ r }) => {
    const english = isEnglish(r.lang);
    const showRom = !english && pron[r.lang];
    return (
      <div className="flex flex-wrap items-start justify-center" lang={r.lang} style={{ fontFamily: fontFor(r.lang), columnGap: '0.5em', rowGap: '0.5rem' }}>
        {r.tokens.map((token, ti) => (
          <span key={ti} className="inline-flex items-start" style={{ columnGap: '0.12em' }}>
            {piecesOf(token).map((piece, si) => {
              const effUnits = piece.units ?? token.units;
              const key = `${r.lang}:${ti}:${si}`;
              const match = mode === 'etym' ? over === key : !!hot && effUnits.some((u) => hot.includes(u));
              const muted = over !== null && !match;
              const ghost = piece.faint || token.relation === 'ghost';
              const phonetic = !!piece.phonetic;
              const tip = buildTip(token, piece, effUnits);
              const romLines = piece.readings ? Object.entries(piece.readings) : piece.pronunciation ? [['', piece.pronunciation] as [string, string]] : [];
              return (
                <span
                  key={si}
                  id={pieceId(r.lang, ti, si)}
                  className="relative inline-flex cursor-help flex-col items-center"
                  onMouseEnter={() => {
                    setOver(key);
                    if (mode === 'align') { setHot(effUnits); computeThread(effUnits); } else { setHot(null); setThreads(null); }
                  }}
                  onMouseLeave={() => { setOver(null); setHot(null); setThreads(null); }}
                >
                  <span
                    className="transition-colors duration-200 motion-reduce:transition-none"
                    style={{
                      fontSize: sizeFor(r.lang),
                      fontStyle: english ? 'italic' : 'normal',
                      color: match ? C.match : ghost ? C.faint : english ? C.english : C.ink,
                      opacity: muted ? 0.4 : 1,
                      lineHeight: 1.15,
                      borderBottom: english ? 'none' : `1px ${ghost || phonetic ? 'dotted' : 'solid'} ${match ? '#34d399' : ghost ? 'transparent' : 'rgba(52,211,153,0.16)'}`,
                      paddingBottom: '2px',
                    }}
                  >
                    {piece.text}
                  </span>
                  {showRom && romLines.map(([rid, val], k) => (
                    <span key={k} className="text-[0.74rem] italic leading-tight transition-colors duration-200 motion-reduce:transition-none"
                      style={{ fontFamily: FONT.Latn, color: match ? '#5eead4' : C.sub, opacity: muted ? 0.4 : 1, marginTop: k === 0 ? '0.28rem' : '0.05rem' }}>
                      {rid && <span style={{ opacity: 0.5, marginRight: '0.3em' }}>{READING_LABEL[rid] ?? rid}</span>}
                      {val}
                    </span>
                  ))}
                  <AnimatePresence>{over === key && <Tooltip primary={tip.primary} secondary={tip.secondary} />}</AnimatePresence>
                </span>
              );
            })}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {mode === 'align' && threads && (
        <svg className="pointer-events-none absolute inset-0 z-0" width="100%" height="100%">
          <path d={threadPath(threads)} fill="none" stroke="#34d399" strokeOpacity={0.45} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div className="relative z-10 space-y-10">
        {segment.renderings.filter((r) => shown[r.lang]).map((r) => <Line key={r.lang} r={r} />)}
      </div>
    </div>
  );
};

export const ConceptInterlinear: React.FC<{ segments: AlignSegment[] }> = ({ segments }) => {
  const langs: { lang: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const seg of segments) for (const r of seg.renderings) if (!seen.has(r.lang)) { seen.add(r.lang); langs.push({ lang: r.lang, label: r.label }); }

  const [mode, setMode] = React.useState<Mode>('align');
  const [shown, setShown] = React.useState<Record<string, boolean>>(() => Object.fromEntries(langs.map((l, i) => [l.lang, i === 0 || isEnglish(l.lang)])));
  const [pron, setPron] = React.useState<Record<string, boolean>>(() => Object.fromEntries(langs.map((l) => [l.lang, !isEnglish(l.lang)])));

  const modeBtn = (m: Mode, label: string, hint: string) => (
    <button type="button" title={hint} onClick={() => setMode(m)}
      className={`px-2 py-0.5 rounded transition-colors motion-reduce:transition-none ${mode === m ? 'text-emerald-300' : 'text-slate-600 hover:text-slate-400'}`}
      style={{ fontVariant: 'small-caps', letterSpacing: '0.06em' }}>
      {label}
    </button>
  );

  return (
    <div className="text-center">
      {/* mode toggle */}
      <div className="mb-8 flex items-center justify-center gap-1 text-[11px]">
        {modeBtn('align', 'alignment', 'Alignment — which word means which, across languages')}
        <span className="text-slate-700">·</span>
        {modeBtn('etym', 'etymology', 'Etymology — sound ↔ script, within a word')}
      </div>

      {/* shared language rail */}
      <div className="mb-16 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
        {langs.map(({ lang, label }) => {
          const on = shown[lang];
          return (
            <span key={lang} className="inline-flex items-center gap-1.5">
              <button type="button" aria-label={`${on ? 'Hide' : 'Show'} ${label}`} onClick={() => setShown((s) => ({ ...s, [lang]: !s[lang] }))}
                className={`inline-flex items-center gap-1.5 transition-colors motion-reduce:transition-none ${on ? 'text-slate-400 hover:text-emerald-300' : 'text-slate-700 hover:text-slate-400'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {on ? (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.5" /></>)
                      : (<><path d="M3 3l18 18" /><path d="M10.6 6.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.3 4.1M6.2 7.4A18 18 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4-.8" /></>)}
                </svg>
                <span style={{ fontVariant: 'small-caps', letterSpacing: '0.04em' }}>{label}</span>
              </button>
              {on && !isEnglish(lang) && (
                <button type="button" aria-label={`${pron[lang] ? 'Hide' : 'Show'} pronunciation for ${label}`} title="Pronunciation" onClick={() => setPron((p) => ({ ...p, [lang]: !p[lang] }))}
                  className={`leading-none transition-colors motion-reduce:transition-none ${pron[lang] ? 'text-emerald-400/80' : 'text-slate-700 hover:text-slate-400'}`}>
                  ɑ
                </button>
              )}
            </span>
          );
        })}
      </div>

      <div className="space-y-16">
        {segments.map((seg) => <PhraseBlock key={seg.id} segment={seg} shown={shown} pron={pron} mode={mode} />)}
      </div>
    </div>
  );
};

export default ConceptInterlinear;
