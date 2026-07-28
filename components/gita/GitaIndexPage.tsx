import React from 'react';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const DEVA = "'Noto Serif Devanagari', 'Devanagari MT', 'Kohinoor Devanagari', serif";

/**
 * `/gita` — the Gītā studio's public face (the Malayalam Studio pattern):
 * the book, what the reader does, and the passage list. Status chips are
 * honest about which layers exist; the English witness and glosses are
 * labeled as the unreviewed AI draft they are.
 */
export const GitaIndexPage: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="max-w-4xl mx-auto px-8 py-12">
      <a href="/" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
        ← LexiconForge
      </a>

      <h1 className="mt-10 text-center text-2xl text-slate-300" style={{ fontFamily: SERIF }}>
        Bhagavad Gītā
      </h1>
      <p className="mt-2 mb-12 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
        the Song read with the language open — every syllable sounded, every word explained
      </p>

      <div className="flex flex-col items-center gap-10 md:flex-row md:items-start">
        {/* Cover: typographic, not an image — the verse the passage is named for. */}
        <div
          className="w-64 shrink-0 rounded-md shadow-2xl ring-1 ring-amber-900/40 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-10 text-center"
          aria-hidden
        >
          <div className="text-4xl leading-snug text-amber-100/90" style={{ fontFamily: DEVA }}>
            भगवद्गीता
          </div>
          <div className="mt-6 text-[13px] italic text-slate-500" style={{ fontFamily: SERIF }}>
            bhagavad-gītā
          </div>
          <div className="mt-10 text-2xl leading-relaxed text-slate-300" style={{ fontFamily: DEVA }}>
            स्थितप्रज्ञः
          </div>
          <div className="mt-1 text-[12px] italic text-slate-500" style={{ fontFamily: SERIF }}>
            sthita-prajña — “wisdom, standing”
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-4xl text-slate-100" style={{ fontFamily: DEVA }}>
            श्रीमद्भगवद्गीता
          </h2>
          <p className="mt-1 text-lg text-slate-400 italic" style={{ fontFamily: SERIF }}>
            The Song of the Lord
          </p>
          <p className="mt-1 text-sm text-slate-500" style={{ fontFamily: SERIF }}>
            Sanskrit · mūla from sa.wikisource.org · public domain
          </p>

          <p className="mt-6 text-[15px] leading-relaxed text-slate-300" style={{ fontFamily: SERIF }}>
            Seven hundred verses spoken on a battlefield — Arjuna's collapse, and Krishna's
            answer: on action without grasping its fruit, on the self that is not slain,
            on a wisdom that stands still while everything moves.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400" style={{ fontFamily: SERIF }}>
            Read it with the language open: large Devanāgarī with the sound of every
            syllable beneath it, meanings on hover, sandhi-welded words taken apart in the
            sound layer, and alignment threads to an English draft. Switch to etymology
            mode and each syllable answers for itself. English rides along as a labeled
            draft witness, never the main text.
          </p>

          <h3 className="mt-10 mb-3 text-xs uppercase tracking-widest text-slate-500" style={{ fontFamily: SERIF }}>
            Passages
          </h3>

          <a
            href="/gita/sthitaprajna"
            className="block rounded-lg border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-emerald-700/60 hover:bg-slate-900"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xl text-slate-100" style={{ fontFamily: DEVA }}>
                स्थितप्रज्ञः
              </span>
              <span className="shrink-0 text-xs text-slate-500" style={{ fontFamily: SERIF }}>
                2.50–2.72
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400 italic" style={{ fontFamily: SERIF }}>
              The one of steady wisdom — Arjuna asks how such a person speaks, sits, walks;
              Krishna's answer closes chapter 2: the tortoise, the two nights, the sea.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]" style={{ fontFamily: SERIF }}>
              <span className="rounded-full border border-emerald-800/70 px-2 py-0.5 text-emerald-400">◆ all 23 verses deep-curated</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">sandhi split &amp; glossed</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">every syllable sounded</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">English draft witness</span>
            </div>
          </a>

          <p className="mt-4 text-xs text-slate-600" style={{ fontFamily: SERIF }}>
            Other passages join as they are curated — the mūla source and the pipeline are
            in place; each is one careful pass away.
          </p>
        </div>
      </div>

      <p className="mt-16 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
        Sanskrit text: sa.wikisource.org (public domain) · padaccheda, glosses &amp; English:
        Fable draft (2026), Sanskrit review pending
      </p>
    </div>
  </div>
);

export default GitaIndexPage;
