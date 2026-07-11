import React, { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Source-grounded bilingual reader for Calvino's *Se una notte d'inverno un
 * viaggiatore*: the Italian original foregrounded, every content word hover-to-
 * reveal / click-to-cycle its facets (lemma · part of speech · morphology ·
 * gloss), with William Weaver's English as the aligned witness. One unit at a
 * time (22 units: 12 frame chapters + 10 incipits).
 *
 * Data: data/calvino/reader-payload.json, produced by scripts/grounding/
 * build_reader_payload.py (spaCy fact layer + optional Wiktionary glosses).
 */

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

type Tok = { s: string; ws?: boolean; pbr?: boolean; l?: string; p?: string; m?: string; g?: string[] };
type Unit = { n: number; id: string; title: string; italian: Tok[]; english: string };
type Payload = { work: string; witness: string; hasGlosses: boolean; units: Unit[] };

const UPOS: Record<string, string> = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb', PROPN: 'proper noun',
  PRON: 'pronoun', DET: 'determiner', ADP: 'preposition', AUX: 'auxiliary',
  NUM: 'numeral', SCONJ: 'conjunction', CCONJ: 'conjunction',
};

type Facet = { label: string; val: string };
function facetsFor(t: Tok): Facet[] {
  const f: Facet[] = [];
  if (t.l && t.l.toLowerCase() !== t.s.toLowerCase()) f.push({ label: 'lemma', val: t.l });
  if (t.p) f.push({ label: 'part of speech', val: UPOS[t.p] || t.p.toLowerCase() });
  if (t.m) f.push({ label: 'morphology', val: t.m.replace(/\|/g, ' · ') });
  (t.g || []).forEach((g) => f.push({ label: 'gloss', val: g }));
  return f;
}

function Word({ t }: { t: Tok }) {
  const facets = useMemo(() => facetsFor(t), [t]);
  const [i, setI] = useState(0);
  const [over, setOver] = useState(false);
  const trailing = t.ws === false ? '' : ' ';

  if (facets.length === 0) return <>{t.s}{trailing}</>;

  return (
    <>
      <span
        className="relative inline-block"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => { setOver(true); setI(0); }}
        onMouseLeave={() => setOver(false)}
        onClick={() => setI((n) => (n + 1) % facets.length)}
      >
        <span
          style={{
            color: over ? '#6ee7b7' : 'inherit',
            borderBottom: over ? '1px solid #6ee7b7' : '1px dotted rgba(4,120,87,0.45)',
            transition: 'color .12s',
          }}
        >
          {t.s}
        </span>
        {over && facets[i] && (
          <span
            className="absolute left-1/2 bottom-full z-30"
            style={{
              transform: 'translateX(-50%)', marginBottom: 8, whiteSpace: 'nowrap',
              background: 'rgba(15,23,42,0.97)', border: '1px solid #1e293b', borderRadius: 6,
              padding: '6px 11px', boxShadow: '0 10px 30px rgba(0,0,0,.55)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <span className="block" style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
              {facets[i].label}
            </span>
            <span className="block" style={{ fontSize: 14, color: '#f1f5f9' }}>{facets[i].val}</span>
            {facets.length > 1 && (
              <span className="flex gap-1 mt-1 justify-center">
                {facets.map((_, k) => (
                  <span key={k} style={{ width: 5, height: 5, borderRadius: 9, background: k === i ? '#6ee7b7' : '#334155' }} />
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

  // group the flat token stream into paragraphs on the pbr flag
  const paragraphs: Tok[][] = [[]];
  for (const t of unit.italian) {
    paragraphs[paragraphs.length - 1].push(t);
    if (t.pbr) paragraphs.push([]);
  }
  const paras = paragraphs.filter((p) => p.length);

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
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginBottom: 32 }}>
          hover a word for its lemma & grammar · click to cycle facets{payload.hasGlosses ? ' · glosses on' : ' · glosses building…'}
        </div>

        <div style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.9, color: '#e2e8f0', marginBottom: 40 }}>
          {paras.map((p, pi) => (
            <p key={pi} style={{ margin: '0 0 1.1em' }}>
              {p.map((t, k) => <Word key={k} t={t} />)}
            </p>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20, marginBottom: 40 }}>
          <button
            onClick={() => setShowEn((v) => !v)}
            style={{ ...link, background: 'none', border: 'none', padding: 0, marginBottom: 12 }}
          >
            {showEn ? '▾' : '▸'} Weaver’s English ({payload.witness})
          </button>
          {showEn && (
            <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.8, fontStyle: 'italic', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
              {unit.english}
            </div>
          )}
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
