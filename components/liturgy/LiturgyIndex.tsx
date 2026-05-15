import React from 'react';
import { LITURGY_INDEX } from '../../data/liturgy';

/**
 * Liturgy index page. Lists all available chants with a brief framing.
 *
 * Deliberately honest about what this is: a hand-curated, multi-witness
 * reader, not an authoritative version. The "About" section names that.
 */

export const LiturgyIndex: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-3xl font-serif text-slate-100 mb-2">Liturgy</h1>
          <p className="text-slate-400 italic">
            Buddhist chants, hand-curated, with the machinery left exposed.
          </p>
        </header>

        <section className="mb-12 text-slate-400 leading-relaxed space-y-4 text-sm">
          <p>
            Each page below shows one chant with the original (Pāli, Devanāgarī, Japanese,
            Chinese characters, dharani phonemes — whichever the chant lives in), multiple
            institutional English renderings side-by-side, word-by-word with verbal roots
            where useful, and commentary in a curator's voice.
          </p>
          <p>
            <strong className="text-slate-300">No version here is canonical.</strong> MAPLE
            chants this way; other institutions chant differently. The point is to make
            the contrast visible so you can compare, listen, and decide for yourself.
          </p>
          <p>
            Each chant has its own shape — a dharani is not a sutta is not a refuge
            formula. The reader adapts.
          </p>
        </section>

        <div className="space-y-6">
          {LITURGY_INDEX.map((item) => (
            <a
              key={item.slug}
              href={`/liturgy/${item.slug}`}
              className="block p-6 border border-slate-800 rounded-lg hover:border-emerald-700/50 hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex items-baseline gap-4 mb-2">
                <h2 className="text-xl text-slate-100 font-serif">{item.title}</h2>
                <span className="text-xs uppercase tracking-widest text-slate-500">
                  {item.tradition}
                </span>
              </div>
              {item.subtitle && (
                <div className="text-slate-400 italic mb-1">{item.subtitle}</div>
              )}
              {item.context && <p className="text-slate-500 text-sm">{item.context}</p>}
            </a>
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-slate-800 text-xs text-slate-600">
          <p>
            Hand-curated. Translations cited with attribution and license where known.
            Pāli canonical text is public domain. Sujato's renderings are CC0 via SuttaCentral.
            Thanissaro Bhikkhu's are CC BY-NC via Access to Insight. Other quotations are
            short fair-use excerpts linked to their sources.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default LiturgyIndex;
