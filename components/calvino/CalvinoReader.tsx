import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { renderItalian, type LensFacet } from '../../services/italian/lens/render';

/**
 * Source-grounded bilingual reader for Calvino's *Se una notte d'inverno un
 * viaggiatore*: the Italian original foregrounded; every content word hover-to-
 * reveal / click-to-cycle its lens copy — MEANING, who-acts, cognate anchor,
 * false-friend warning, word-building — with Weaver's English as the witness.
 *
 * The tooltip copy comes from services/italian/lens (the render(facts,lens)
 * layer), NOT the raw spaCy/Wiktionary facts. See docs/reader/LENSES.md.
 */

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

type Tok = { s: string; ws?: boolean; pbr?: boolean; l?: string; p?: string; m?: string; g?: string[] };
type Block = { it: Tok[][]; en: string[] };
type Unit = { n: number; id: string; title: string; blocks: Block[] };
type Payload = { work: string; witness: string; hasGlosses: boolean; units: Unit[] };

const CONTENT_POS = new Set(['NOUN', 'VERB', 'ADJ', 'ADV', 'PROPN', 'AUX']);

function Word({ t }: { t: Tok }) {
  const facets: LensFacet[] = useMemo(
    () => renderItalian({ surface: t.s, lemma: t.l, upos: t.p, morph: t.m, senses: t.g }),
    [t],
  );
  const [i, setI] = useState(0);
  const [over, setOver] = useState(false);
  const trailing = t.ws === false ? '' : ' ';

  // A word earns a tooltip only if it's a content word (or a fused preposition)
  // AND the lens produced something beyond the surface itself.
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
        onClick={() => facets.length > 1 && setI((n) => (n + 1) % facets.length)}
      >
        <span
          style={{
            color: over ? (warn ? '#fbbf24' : '#6ee7b7') : 'inherit',
            borderBottom: over
              ? `1px solid ${warn ? '#fbbf24' : '#6ee7b7'}`
              : '1px dotted rgba(4,120,87,0.45)',
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
            }}
          >
            <span className="block" style={{ fontSize: 14.5, lineHeight: 1.35, color: warn ? '#fde68a' : '#f1f5f9' }}>
              {warn ? '⚠ ' : ''}{cur.text}
            </span>
            {cur.note && (
              <span className="block" style={{ fontSize: 11, marginTop: 2, letterSpacing: '.02em', color: '#64748b' }}>
                {cur.note}
              </span>
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

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function CalvinoReader({ pathname }: { pathname: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [showEn, setShowEn] = useState(true);

  useEffect(() => {
    let live = true;
    import('../../data/calvino/reader-payload.json')
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

  return (
    <div style={shell}>
      <div style={col}>
        <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
          <span style={{ ...link, color: '#475569' }}>{payload.work}</span>
          <a style={link} onClick={(e) => { e.preventDefault(); navigate('/'); }} href="/">← library</a>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8, color: '#475569', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Unit {unit.n} of 22 · Italian source · Weaver English
        </div>
        <h1 style={{ fontFamily: SERIF, textAlign: 'center', fontSize: 26, color: '#f1f5f9', marginBottom: 6 }}>
          {unit.title}
        </h1>
        <div className="flex items-center justify-center" style={{ gap: 16, marginBottom: 34 }}>
          <span style={{ color: '#475569', fontSize: 12 }}>hover a word · click to cycle facets</span>
          <button
            onClick={() => setShowEn((v) => !v)}
            style={{ ...link, background: 'none', border: `1px solid ${showEn ? 'rgba(52,211,153,.4)' : '#334155'}`, borderRadius: 5, padding: '2px 9px', fontSize: 12, color: showEn ? 'rgba(52,211,153,.85)' : '#64748b' }}
          >
            {showEn ? '✓ ' : ''}Weaver English
          </button>
        </div>

        <div style={{ marginBottom: 40 }}>
          {unit.blocks.map((b, bi) => (
            <div key={bi} style={{ marginBottom: '1.5em' }}>
              {b.it.map((para, pi) => (
                <p key={pi} style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.85, color: '#e2e8f0', margin: '0 0 .25em' }}>
                  {para.map((t, k) => <Word key={k} t={t} />)}
                </p>
              ))}
              {showEn && b.en.map((para, pi) => (
                <p key={pi} style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.65, fontStyle: 'italic', color: '#64748b', margin: '.2em 0 0', paddingLeft: 14, borderLeft: '2px solid #1e293b' }}>
                  {para}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between" style={{ borderTop: '1px solid #1e293b', paddingTop: 20 }}>
          <span style={idx > 1 ? link : { ...link, color: '#1e293b', cursor: 'default' }} onClick={() => idx > 1 && go(idx - 1)}>← previous</span>
          <span style={{ color: '#334155', fontSize: 12 }}>{unit.n} / 22</span>
          <span style={idx < 22 ? link : { ...link, color: '#1e293b', cursor: 'default' }} onClick={() => idx < 22 && go(idx + 1)}>next →</span>
        </div>
      </div>
    </div>
  );
}

export default CalvinoReader;
