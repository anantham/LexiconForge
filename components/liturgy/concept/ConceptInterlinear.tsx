import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AlignSegment, AlignRelation, AlignRendering, AlignToken, AlignSegmentPiece } from '../../../types/liturgyAlign';
import { getConcept } from '../../../data/concepts/lookup';
import { conceptFacets } from '../../../data/concepts/tooltipFacets';

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
 * by default; the eye adds a language, with its sound shown for non-Latin. The
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

const Tooltip: React.FC<{ primary: string; secondary?: string; facetIndex?: number; facetTotal?: number }> = ({
  primary,
  secondary,
  facetIndex,
  facetTotal,
}) => (
  <motion.span
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 4 }}
    transition={{ duration: 0.12 }}
    className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-900/95 px-2.5 py-1 text-center shadow-lg pointer-events-none"
    style={{ fontFamily: FONT.Latn, fontStyle: 'normal', maxWidth: '22rem', whiteSpace: 'normal' }}
  >
    <span className="block text-[13px] text-slate-100">{primary}</span>
    {secondary && <span className="mt-0.5 block text-[11px] text-slate-500">{secondary}</span>}
    {!!facetTotal && facetTotal > 1 && (
      <span className="mt-1.5 flex items-center justify-center gap-1" aria-hidden>
        {Array.from({ length: facetTotal }).map((_, i) => (
          <span key={i} className="h-1 w-1 rounded-full" style={{ background: i === facetIndex ? C.match : '#475569' }} />
        ))}
      </span>
    )}
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

// How a token attests its concept — shown in the source card so the reader knows
// what KIND of claim a binding is (a direct sense vs a translator's choice).
const RELATION_LABEL: Record<string, string> = {
  semantic: 'direct meaning',
  interpretive: "translator's rendering",
  transliteration: 'sound borrowing',
  calque: 'loan-translation (built piece-by-piece)',
};
const shortUrl = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

type SourceEntry = {
  id: string;
  label: string;
  citations: { id: string; short: string; detail?: string; url?: string; excerpt?: string }[];
};

// Long-press a token → the scholarly source behind its binding: which dictionary /
// translator the concept rests on, the cited excerpt, and a link. Interactive
// (unlike the hover tooltip) so the citation links are clickable.
const SourceCard: React.FC<{ title: string; relation?: string; sources: SourceEntry[]; onClose: () => void }> = ({
  title,
  relation,
  sources,
  onClose,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
    style={{ fontFamily: FONT.Latn, fontStyle: 'normal' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 8, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-900/95 p-5 text-left shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <span className="text-[15px] text-slate-100">
          {title}
          {relation && RELATION_LABEL[relation] && (
            <span className="ml-2 text-[11px] text-slate-500">· {RELATION_LABEL[relation]}</span>
          )}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-300"
        >
          esc ✕
        </button>
      </div>
      {sources.map((s) => (
        <div key={s.id} className="mb-4 last:mb-0">
          {/* The card title already shows the gloss; only label per-concept when
              several concepts share the token (then the header disambiguates). */}
          {sources.length > 1 && (
            <div className="mb-1.5 text-[13px]" style={{ color: C.match }}>
              {s.label}
            </div>
          )}
          {s.citations.length === 0 ? (
            <div className="text-[12px] italic text-slate-500">No source recorded for this binding yet.</div>
          ) : (
            s.citations.map((c) => (
              <div key={c.id} className="mb-2.5 border-l border-slate-700 pl-3 last:mb-0">
                <div className="text-[12.5px] text-slate-200">{c.short}</div>
                {c.excerpt && <div className="mt-1 text-[12px] leading-snug text-slate-400">“{c.excerpt}”</div>}
                {c.detail && <div className="mt-1 text-[11px] text-slate-500">{c.detail}</div>}
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[11px] text-sky-400 hover:underline"
                  >
                    {shortUrl(c.url)} ↗
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </motion.div>
  </motion.div>
);

const PhraseBlock: React.FC<{
  segment: AlignSegment;
  shown: Record<string, boolean>;
  mode: Mode;
  /** Title segment — render the glyphs and English a step larger. */
  large?: boolean;
}> = ({ segment, shown, mode, large = false }) => {
  const [hot, setHot] = React.useState<string[] | null>(null); // matching unit ids (align mode)
  const [over, setOver] = React.useState<string | null>(null); // hovered piece key
  const [facetIdx, setFacetIdx] = React.useState(0); // click-to-cycle tooltip facet
  const [threads, setThreads] = React.useState<{ x: number; y: number }[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [source, setSource] = React.useState<{ title: string; relation?: string; sources: SourceEntry[] } | null>(null);
  const pressTimer = React.useRef<number | undefined>(undefined);
  const longPressed = React.useRef(false); // a long-press fired → suppress the click-cycle
  React.useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSource(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source]);

  const unitById = Object.fromEntries(segment.units.map((u) => [u.id, u]));
  const glossOf = (units: string[]) => units.map((u) => unitById[u]?.gloss).filter(Boolean).join(' · ');
  const sourcesFor = (units: string[]): SourceEntry[] =>
    units
      .map((u) => {
        const c = getConcept(u);
        return c ? { id: u, label: c.preferredLabel ?? u, citations: (c.citations ?? []) as SourceEntry['citations'] } : null;
      })
      .filter((x): x is SourceEntry => x !== null);
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

  // Threads are measured from live DOM rects, so re-measure while one is shown:
  // a window resize or an async web-font swap (Devanāgarī/Tibetan/CJK arrive
  // after first paint) reflows the tokens and would otherwise leave the curve
  // pointing at stale positions. Scroll needs no recompute — points are
  // container-relative and scroll with the content.
  React.useEffect(() => {
    if (mode !== 'align' || !hot) return;
    const recompute = () => computeThread(hot);
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', recompute);
    const fonts = typeof document !== 'undefined' ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
    fonts?.ready.then(recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hot, mode, shown]);

  const buildTip = (token: AlignToken, piece: AlignSegmentPiece | null, effUnits: string[]) => {
    const wordGloss = glossOf(effUnits);
    const node = effUnits.map((u) => unitById[u]?.conceptId).filter(Boolean).map((id) => getConcept(id!)).find(Boolean);
    const src = node ? parenOf(node.preferredLabel) : undefined;
    if (piece?.phonetic) {
      return { primary: `the sound “${piece.gloss}”`, secondary: `part of ${token.text} = ${wordGloss}${src ? ` (${src})` : ''}` };
    }
    if (piece?.akshara) {
      // The glyph is on screen and its sound is shown + highlighted beneath it, so
      // the tooltip carries only the MEANING. No "part of <glyph>" line — that just
      // names the word the reader is already looking at (and the highlight already
      // shows which slice this is). No gloss → no tooltip.
      if (!wordGloss) return { primary: '', secondary: '' };
      const extra = src && !wordGloss.toLowerCase().includes(src.toLowerCase()) ? ` (${src})` : '';
      return { primary: `${wordGloss}${extra}`, secondary: '' };
    }
    let primary = piece?.gloss ?? wordGloss;
    // No gloss and no concept = we have no meaning for this token. For sacred
    // text, show NO tooltip rather than the misleading "a grammar word".
    if (!primary) return { primary: '', secondary: '' };
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

  // Tooltip facets the reader can click through: meaning → sense (definition) →
  // how-to-say (the Sanskrit respelling). Facet 0 is the hover gloss; the rest
  // come from the concept registry. (No "grammar" facet — there's no per-token
  // grammatical data, and the curation protocol bans the jargon.)
  const facetsFor = (token: AlignToken, piece: AlignSegmentPiece | null, effUnits: string[]) => {
    const base = buildTip(token, piece, effUnits);
    const out = base.primary ? [base] : [];
    const cids = effUnits.map((u) => unitById[u]?.conceptId).filter((x): x is string => !!x);
    for (const f of conceptFacets(cids)) out.push({ primary: f, secondary: '' });
    for (const cid of cids) {
      const say = getConcept(cid)?.attestations?.find(
        (a: { language?: string; script?: string; pronunciation?: string }) =>
          a.language === 'sa' && a.script === 'Latn' && a.pronunciation,
      )?.pronunciation;
      if (say) out.push({ primary: `“${say}”`, secondary: 'how to say it (Sanskrit)' });
    }
    const seen = new Set<string>();
    const facets = out.filter((f) => (seen.has(f.primary) ? false : (seen.add(f.primary), true)));
    return facets.length ? facets : [{ primary: '', secondary: '' }];
  };

  // NOTE: a plain function, NOT a component rendered as <Line/>. Defining a
  // component inside render gives it a new identity each render, so React
  // remounts the whole line on every hover — the element under the cursor is
  // destroyed mid-hover, its mouseleave never fires, and the highlight/tooltip
  // stick. Calling renderLine(r) reconciles the same DOM in place instead.
  const renderLine = (r: AlignRendering) => {
    const english = isEnglish(r.lang);
    const showRom = !english; // romanization always shown for non-Latin scripts
    // Whole-line romanization fallback (e.g. Tibetan) when the tokens carry no
    // per-token sound — reliable, vs. mis-paired per-word sounds.
    // Whole-line romanization fallback: shown only when some pieces lack a
    // per-piece sound (e.g. Tibetan particles), so it fills the gaps without being
    // redundant where every syllable already shows its own sound.
    const tokenHasFullRom = (t: AlignToken) =>
      t.segments?.length ? t.segments.every((s) => s.pronunciation) : !!(t.pronunciation || t.readings);
    const allRom = r.tokens.length > 0 && r.tokens.every(tokenHasFullRom);
    const showTranslit = !english && scriptOf(r.lang) !== 'Latn' && !!r.transliteration && !allRom;
    return (
      <div key={r.lang}>
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
              const facets = over === key ? facetsFor(token, piece, effUnits) : null;
              const facet = facets ? facets[facetIdx % facets.length] : null;
              const multiFacet = !!facets && facets.length > 1;
              const romLines = piece.readings ? Object.entries(piece.readings) : piece.pronunciation ? [['', piece.pronunciation] as [string, string]] : [];
              return (
                <span
                  key={si}
                  id={pieceId(r.lang, ti, si)}
                  className={`relative inline-flex select-none flex-col items-center ${multiFacet ? 'cursor-pointer' : 'cursor-help'}`}
                  onMouseEnter={() => {
                    setOver(key);
                    setFacetIdx(0);
                    if (mode === 'align') { setHot(effUnits); computeThread(effUnits); } else { setHot(null); setThreads(null); }
                  }}
                  onMouseLeave={() => { window.clearTimeout(pressTimer.current); setOver(null); setHot(null); setThreads(null); }}
                  onPointerDown={(e) => {
                    if (e.button && e.button !== 0) return; // left / touch only
                    longPressed.current = false;
                    window.clearTimeout(pressTimer.current);
                    if (!effUnits.length) return; // nothing to cite
                    pressTimer.current = window.setTimeout(() => {
                      longPressed.current = true;
                      setSource({ title: glossOf(effUnits) || piece.text, relation: token.relation, sources: sourcesFor(effUnits) });
                    }, 450);
                  }}
                  onPointerUp={() => window.clearTimeout(pressTimer.current)}
                  onContextMenu={(e) => { if (effUnits.length) e.preventDefault(); }}
                  onClick={(e) => {
                    if (longPressed.current) { longPressed.current = false; e.preventDefault(); return; } // was a long-press
                    if (!facets || facets.length <= 1) return;
                    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
                    if (sel && !sel.isCollapsed) return; // don't fire mid drag-select
                    e.stopPropagation();
                    setFacetIdx((n) => (n + 1) % facets.length);
                  }}
                  title={multiFacet ? 'click to cycle · hold for source' : effUnits.length ? 'hold for source' : undefined}
                >
                  <span
                    className="transition-colors duration-200 motion-reduce:transition-none"
                    style={{
                      fontSize: large ? `calc(${sizeFor(r.lang)} * 1.7)` : sizeFor(r.lang),
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
                  <AnimatePresence>
                    {over === key && facet?.primary && (
                      <Tooltip primary={facet.primary} secondary={facet.secondary} facetIndex={facetIdx % facets!.length} facetTotal={facets!.length} />
                    )}
                  </AnimatePresence>
                </span>
              );
            })}
          </span>
        ))}
        </div>
        {showTranslit && (
          <div className="mt-2 text-center text-[0.82rem] italic" style={{ fontFamily: FONT.Latn, color: C.sub }}>
            {r.transliteration}
          </div>
        )}
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
        {segment.renderings.filter((r) => shown[r.lang]).map((r) => renderLine(r))}
      </div>
      <AnimatePresence>
        {source && (
          <SourceCard title={source.title} relation={source.relation} sources={source.sources} onClose={() => setSource(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export const ConceptInterlinear: React.FC<{ segments: AlignSegment[] }> = ({ segments }) => {
  const langs: { lang: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const seg of segments) for (const r of seg.renderings) if (!seen.has(r.lang)) { seen.add(r.lang); langs.push({ lang: r.lang, label: r.label }); }

  const [mode, setMode] = React.useState<Mode>('align');
  const [shown, setShown] = React.useState<Record<string, boolean>>(() => Object.fromEntries(langs.map((l, i) => [l.lang, i === 0 || isEnglish(l.lang)])));

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
            </span>
          );
        })}
      </div>

      <div className="space-y-16">
        {segments.map((seg) =>
          seg.title ? (
            <div key={seg.id} className="mb-10 border-b border-slate-800 pb-16">
              <PhraseBlock segment={seg} shown={shown} mode={mode} large />
            </div>
          ) : (
            <PhraseBlock key={seg.id} segment={seg} shown={shown} mode={mode} />
          )
        )}
      </div>
    </div>
  );
};

export default ConceptInterlinear;
