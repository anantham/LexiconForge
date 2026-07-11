import React from 'react';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const MLYM = "'Noto Serif Malayalam', 'Manjari', serif";

/**
 * `/malayalam` — the Malayalam studio's public face: the book (Aithihyamala,
 * PD 1909) with its cover, what the reader does, and the legend list. Each
 * legend links to its reader route as it is built; status chips are honest
 * about which layers exist (curated / full text / draft English / alignment).
 */
export const MalayalamLibraryPage: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="max-w-4xl mx-auto px-8 py-12">
      <a href="/" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
        ← LexiconForge
      </a>

      <h1 className="mt-10 text-center text-2xl text-slate-300" style={{ fontFamily: SERIF }}>
        Malayalam Studio
      </h1>
      <p className="mt-2 mb-12 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
        classics read with the language open — every word sounded, every symbol explained
      </p>

      <div className="flex flex-col items-center gap-10 md:flex-row md:items-start">
        <img
          src="/malayalam/aithihyamala-cover.svg"
          alt="Aithihyamala — The Garland of Legends"
          className="w-64 shrink-0 rounded-md shadow-2xl ring-1 ring-amber-900/40"
        />

        <div className="flex-1">
          <h2 className="text-4xl text-slate-100" style={{ fontFamily: MLYM }}>
            ഐതിഹ്യമാല
          </h2>
          <p className="mt-1 text-lg text-slate-400 italic" style={{ fontFamily: SERIF }}>
            Aithihyamala — The Garland of Legends
          </p>
          <p className="mt-1 text-sm text-slate-500" style={{ fontFamily: SERIF }}>
            Kottarathil Sankunni · 1909–1934 · public domain
          </p>

          <p className="mt-6 text-[15px] leading-relaxed text-slate-300" style={{ fontFamily: SERIF }}>
            One hundred and twenty-six legends of Kerala — temple deities acquiring their
            territories, yakshis and sorcerers, rajas and namboothiris — collected a century
            ago from the mouths of people who still remembered them. The source database of
            Kerala's story-world.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400" style={{ fontFamily: SERIF }}>
            Read it with the language open: large Malayalam script with the sound of every
            word beneath it, meanings on hover, and an etymology mode that takes any
            letter-cluster apart — welds, chillus, the vanishing chandrakkala. English rides
            along as a labeled draft witness, never the main text.
          </p>

          <h3 className="mt-10 mb-3 text-xs uppercase tracking-widest text-slate-500" style={{ fontFamily: SERIF }}>
            Legends
          </h3>

          <a
            href="/malayalam/urakam-ammathiruvadi"
            className="block rounded-lg border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-emerald-700/60 hover:bg-slate-900"
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-xl text-slate-100" style={{ fontFamily: MLYM }}>
                ഊരകത്ത് അമ്മതിരുവടി
              </span>
              <span className="shrink-0 text-xs text-slate-500" style={{ fontFamily: SERIF }}>
                ch. 64
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400 italic" style={{ fontFamily: SERIF }}>
              The Ammathiruvadi of Urakam — how a goddess rode a palm-leaf umbrella from
              Kanchipuram and acquired her territory in the Peruvanam pooram country.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]" style={{ fontFamily: SERIF }}>
              <span className="rounded-full border border-emerald-800/70 px-2 py-0.5 text-emerald-400">◆ opening deep-curated</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">full text · 31 paragraphs</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">English draft witness</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">alignment in progress</span>
            </div>
          </a>

          <p className="mt-4 text-xs text-slate-600" style={{ fontFamily: SERIF }}>
            125 more legends join as they are built — the pipeline is ready; each new legend
            is one fetch and one translation pass away.
          </p>
        </div>
      </div>

      <p className="mt-16 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
        Malayalam text: ml.wikisource.org (public domain) · English &amp; glosses: Opus draft,
        native review pending · cover: original artwork
      </p>
    </div>
  </div>
);

export default MalayalamLibraryPage;
