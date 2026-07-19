import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { renderItalian, type LensFacet } from '../../services/italian/lens/render';

/**
 * Source-grounded bilingual reader for Calvino's *Se una notte d'inverno un
 * viaggiatore*.
 *
 * The reading unit is the SENTENCE, not the word: Weaver's English maps
 * phrase-to-phrase but not word-to-word ("per … a" -> "about to"), so a sentence
 * pair can carry his real prose against the Italian instead of a pidgin gloss.
 * Pairs are aligned by a Gale-Church length model + a lexical anchor from the
 * Italian words' glosses (build_reader_payload.py) — deterministic, no LLM.
 *
 * A mode toggle swaps which language leads: the other slides beneath it, smaller
 * and dimmer. Every Italian word still carries the lens tooltip (meaning, who-acts,
 * cognate, false friend) — see services/italian/lens + docs/reader/LENSES.md.
 */

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const EASE = [0.4, 0, 0.2, 1] as const;

type Tok = { s: string; ws?: boolean; pbr?: boolean; l?: string; p?: string; m?: string; g?: string[] };
/** `conf` is the deterministic alignment confidence. Length + gloss-bag alignment has a
 *  real ceiling on literary translation, so a weakly-evidenced pairing is MARKED rather
 *  than silently presented as fact. See scripts/grounding/validate_alignment.py. */
type Pair = { it: Tok[]; en: string; conf?: 'low' | 'mid'; refined?: boolean };
type Block = { pairs: Pair[] };
type Unit = { n: number; id: string; title: string; blocks: Block[] };
type Payload = { work: string; witness: string; hasGlosses: boolean; units: Unit[] };
type Mode = 'it' | 'en';

const CONTENT_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'PROPN', 'AUX']);

const Word: React.FC<{ t: Tok; dim: boolean }> = ({ t, dim }) => {
  const facets: LensFacet[] = useMemo(
    () => renderItalian({ surface: t.s, lemma: t.l, upos: t.p, morph: t.m, senses: t.g }),
    [t],
  );
  const [i, setI] = useState(0);
  const [over, setOver] = useState(false);
  const trailing = t.ws === false ? '' : ' ';

  const fused = !!(t.l && t.l.includes(' '));
  const meaningful = facets.length > 1 || (facets[0] && facets[0].text.toLowerCase() !== t.s.toLowerCase());
  const hoverable = !!t.l && (CONTENT_POS.has(t.p || '') || fused) && meaningful;

  if (!hoverable) return <>{t.s}{trailing}</>;

  const cur = facets[i % facets.length];
  const warn = cur?.kind === 'warn';

  return (
    <>
      <span
        className="relative inline-block"
        style={{ cursor: facets.length > 1 ? 'pointer' : 'help' }}
        onMouseEnter={() => { setOver(true); setI(0); }}
        onMouseLeave={() => setOver(false)}
        onClick={(e) => { e.stopPropagation(); if (facets.length > 1) setI((n) => (n + 1) % facets.length); }}
      >
        <span
          style={{
            color: over ? (warn ? '#fbbf24' : '#6ee7b7') : 'inherit',
            borderBottom: over
              ? `1px solid ${warn ? '#fbbf24' : '#6ee7b7'}`
              : `1px dotted rgba(4,120,87,${dim ? 0.25 : 0.45})`,
            transition: 'color .12s',
          }}
        >
          {t.s}
        </span>
        {over && cur && (
          <span
            className="absolute left-1/2 bottom-full z-30"
            style={{
              transform: 'translateX(-50%)', marginBottom: 8, maxWidth: 280, width: 'max-content',
              background: 'rgba(15,23,42,0.98)',
              border: `1px solid ${warn ? 'rgba(251,191,36,0.5)' : '#1e293b'}`, borderRadius: 6,
              padding: '7px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.55)',
              fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center',
              fontStyle: 'normal', opacity: 1,
            }}
          >
            <span className="block" style={{ fontSize: 14.5, lineHeight: 1.35, color: warn ? '#fde68a' : '#f1f5f9' }}>
              {warn ? '⚠ ' : ''}{cur.text}
            </span>
            {cur.note && (
              <span className="block" style={{ fontSize: 11, marginTop: 2, color: '#64748b' }}>{cur.note}</span>
            )}
            {facets.length > 1 && (
              <span className="flex gap-1 mt-1.5 justify-center">
                {facets.map((_, k) => (
                  <span key={k} style={{ width: 5, height: 5, borderRadius: 9, background: k === i % facets.length ? '#6ee7b7' : '#334155' }} />
                ))}
              </span>
            )}
          </span>
        )}
      </span>
      {trailing}
    </>
  );
}

/** One aligned sentence pair. The lead language sits on top, full size; the other
 *  slides beneath it, smaller and dimmer. Toggling `mode` animates the swap. */
const SentencePair: React.FC<{ pair: Pair; mode: Mode }> = ({ pair, mode }) => {
  const itLead = mode === 'it';
  const lines: Mode[] = itLead ? ['it', 'en'] : ['en', 'it'];
  const tr = { layout: { duration: 0.5, ease: EASE } };
  // Weak alignment evidence -> a DOTTED rule instead of a solid one. Understated on
  // purpose: many low-evidence pairs are still correct (Weaver paraphrases freely), so
  // this informs without crying wolf.
  const weak = pair.conf === 'low';
  const rule = weak ? '2px dotted #713f12' : '2px solid #1e293b';
  const weakTitle = weak ? 'alignment evidence is weak here — this pairing may be off' : undefined;

  return (
    <div style={{ marginBottom: '0.85em' }}>
      {lines.map((which) =>
        which === 'it' ? (
          <motion.p
            key="it"
            layout
            transition={tr}
            style={{
              fontFamily: SERIF, margin: '0 0 .12em',
              fontSize: itLead ? 20 : 14,
              lineHeight: itLead ? 1.75 : 1.6,
              color: itLead ? '#e2e8f0' : '#64748b',
              opacity: itLead ? 1 : 0.75,
              paddingLeft: itLead ? 0 : 14,
              borderLeft: itLead ? 'none' : rule,
              transition: 'font-size .5s cubic-bezier(.4,0,.2,1), color .5s, opacity .5s, padding-left .5s',
            }}
          >
            {pair.it.map((t, k) => <Word key={k} t={t} dim={!itLead} />)}
          </motion.p>
        ) : (
          <motion.p
            key="en"
            layout
            title={weakTitle}
            transition={tr}
            style={{
              fontFamily: SERIF, margin: '0 0 .12em',
              fontSize: itLead ? 14 : 19,
              lineHeight: itLead ? 1.6 : 1.75,
              color: itLead ? '#64748b' : '#e2e8f0',
              opacity: itLead ? 0.75 : 1,
              fontStyle: itLead ? 'italic' : 'normal',
              paddingLeft: itLead ? 14 : 0,
              borderLeft: itLead ? rule : 'none',
              transition: 'font-size .5s cubic-bezier(.4,0,.2,1), color .5s, opacity .5s, padding-left .5s',
            }}
          >
            {pair.en}
          </motion.p>
        ),
      )}
    </div>
  );
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function CalvinoReader({ pathname }: { pathname: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [mode, setMode] = useState<Mode>('it');

  useEffect(() => {
    let live = true;
    // data/calvino/ is gitignored (generated grounding payload), so the module
    // only exists on the machine that ran the pipeline. A non-analyzable
    // specifier keeps vite/tsc from resolving it at build time; everywhere the
    // file is absent this rejects at runtime into the .catch below.
    const payloadHref = '../../data/calvino/reader-payload.json';
    import(/* @vite-ignore */ payloadHref)
      .then((m) => { if (live) setPayload(((m as any).default || m) as Payload); })
      .catch((e) => { console.error('[calvino] payload load failed', e); });
    return () => { live = false; };
  }, []);

  const match = pathname.match(/^\/calvino\/(\d+)/);
  const idx = match ? Math.max(1, Math.min(22, parseInt(match[1], 10))) : 1;
  const go = useCallback((n: number) => navigate(n <= 1 ? '/calvino' : `/calvino/${n}`), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && idx < 22) go(idx + 1);
      if (e.key === 'ArrowLeft' && idx > 1) go(idx - 1);
      if (e.key.toLowerCase() === 'm') setMode((v) => (v === 'it' ? 'en' : 'it'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, go]);

  const shell: React.CSSProperties = { minHeight: '100vh', background: '#020617', color: '#e2e8f0' };
  const col: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '40px 32px 96px' };
  const link: React.CSSProperties = { color: 'rgba(52,211,153,.75)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' };

  if (!payload) {
    return <div style={shell}><div style={{ ...col, fontFamily: SERIF, color: '#64748b' }}>Loading the grounded text…</div></div>;
  }

  const unit = payload.units[idx - 1];

  const seg = (m: Mode, label: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        background: mode === m ? 'rgba(52,211,153,.14)' : 'transparent',
        border: 'none', cursor: 'pointer', padding: '3px 12px', borderRadius: 4,
        fontSize: 12, letterSpacing: '.04em',
        color: mode === m ? '#6ee7b7' : '#64748b', transition: 'all .25s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={shell}>
      <div style={col}>
        <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
          <span style={{ ...link, color: '#475569' }}>{payload.work}</span>
          <a style={link} onClick={(e) => { e.preventDefault(); navigate('/'); }} href="/">← library</a>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8, color: '#475569', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Unit {unit.n} of 22 · sentence-aligned · {payload.witness}
        </div>
        <h1 style={{ fontFamily: SERIF, textAlign: 'center', fontSize: 26, color: '#f1f5f9', marginBottom: 14 }}>
          {unit.title}
        </h1>

        <div className="flex items-center justify-center" style={{ gap: 4, marginBottom: 6 }}>
          <div style={{ display: 'inline-flex', gap: 2, border: '1px solid #1e293b', borderRadius: 6, padding: 2 }}>
            {seg('it', 'Italiano')}
            {seg('en', 'English')}
          </div>
        </div>
        <div style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginBottom: 30 }}>
          press <b style={{ color: '#475569' }}>m</b> to swap · hover any Italian word
        </div>

        <LayoutGroup>
          <div>
            {unit.blocks.map((b, bi) => (
              <div key={bi} style={{ marginBottom: '1.5em' }}>
                {b.pairs.map((p, pi) => <SentencePair key={pi} pair={p} mode={mode} />)}
              </div>
            ))}
          </div>
        </LayoutGroup>

        <div className="flex items-center justify-between" style={{ borderTop: '1px solid #1e293b', paddingTop: 20, marginTop: 40 }}>
          <span style={idx > 1 ? link : { ...link, color: '#1e293b', cursor: 'default' }} onClick={() => idx > 1 && go(idx - 1)}>← previous</span>
          <span style={{ color: '#334155', fontSize: 12 }}>{unit.n} / 22</span>
          <span style={idx < 22 ? link : { ...link, color: '#1e293b', cursor: 'default' }} onClick={() => idx < 22 && go(idx + 1)}>next →</span>
        </div>
      </div>
    </div>
  );
}

export default CalvinoReader;
