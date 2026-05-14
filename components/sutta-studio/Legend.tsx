import { AnimatePresence, motion } from 'framer-motion';
import { RELATION_COLORS, RELATION_GLYPHS, RELATION_HOOK } from './palette';

/**
 * Visual reference panel — explains the reader's color/symbol vocabulary
 * once, in one place, so individual tooltips don't have to. Toggle from
 * the settings gear ("Legend"). Per CURATION_PROTOCOL §3.4, this is the
 * register-replacement for "Colored differently because…" meta-commentary
 * that used to live in tooltip[0] of every function word.
 */
export function Legend({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-interactive="true"
          className="fixed right-4 bottom-4 w-[360px] max-w-[92vw] max-h-[80vh] z-[85] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
        >
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wide">Legend</div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-200 select-none text-sm"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-4 overflow-y-auto space-y-5 text-sm">
            {/* Word colors */}
            <section>
              <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Word colors</div>
              <div className="space-y-1.5 font-serif">
                <div className="flex items-baseline gap-3">
                  <span className="text-emerald-400 text-base w-20">bhagavā</span>
                  <span className="text-slate-500 font-sans text-xs">content word (noun, verb)</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-slate-200 text-base w-20">evaṁ</span>
                  <span className="text-slate-500 font-sans text-xs">function word (particle, pronoun)</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-yellow-400 text-base w-20">Bhikkhave</span>
                  <span className="text-slate-500 font-sans text-xs">vocative (calling out)</span>
                </div>
              </div>
            </section>

            {/* Emphasis */}
            <section>
              <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Emphasis</div>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-slate-200 font-medium border-b-2 border-amber-700/30 pb-0.5 w-20 inline-block">
                    visuddhi
                  </span>
                  <span className="text-slate-500 font-sans text-xs">anchor (semantic center of phase)</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-slate-200 border-b-2 border-cyan-700 pb-1 w-20 inline-block">
                    bhikkhū
                  </span>
                  <span className="text-slate-500 font-sans text-xs">refrain (recurs across phases)</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="italic font-serif text-slate-400 w-20 inline-block opacity-60">have</span>
                  <span className="text-slate-500 font-sans text-xs">ghost word (English scaffolding)</span>
                </div>
              </div>
            </section>

            {/* Diacritics */}
            <section>
              <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Diacritics</div>
              <div className="space-y-1.5 font-serif">
                <div className="flex items-baseline gap-3">
                  <span className="text-slate-200 w-20 text-base">ā ē ī ō ū</span>
                  <span className="text-slate-500 font-sans text-xs">long vowels — held about twice as long</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-slate-200 w-20 text-base">ṁ</span>
                  <span className="text-slate-500 font-sans text-xs">niggahīta — nasal close (like 'um' in 'hum')</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-slate-200 w-20 text-base">ṭ ḍ ṇ ḷ</span>
                  <span className="text-slate-500 font-sans text-xs">retroflex — tongue curled back</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-slate-200 w-20 text-base">ñ</span>
                  <span className="text-slate-500 font-sans text-xs">palatal n (like Spanish 'ñ')</span>
                </div>
              </div>
            </section>

            {/* Relations */}
            <section>
              <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Relation arrows</div>
              <div className="space-y-1.5">
                {(['ownership', 'direction', 'location', 'action'] as const).map((rel) => (
                  <div key={rel} className="flex items-baseline gap-3">
                    <span
                      className={`inline-block w-20 text-base ${RELATION_COLORS[rel].tailwind}`}
                    >
                      {RELATION_GLYPHS[rel]} {RELATION_HOOK[rel]}
                    </span>
                    <span className="text-slate-500 font-sans text-xs capitalize">{rel}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Cycle dots */}
            <section>
              <div className="text-slate-500 text-xs uppercase tracking-wide mb-2">Cycle dots</div>
              <div className="flex items-baseline gap-3">
                <span className="inline-flex items-center justify-center gap-1 w-20">
                  <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
                  <span className="inline-block w-1 h-1 rounded-full bg-slate-700" />
                  <span className="inline-block w-1 h-1 rounded-full bg-slate-700" />
                </span>
                <span className="text-slate-500 font-sans text-xs">
                  English word has alternative renderings — click to cycle
                </span>
              </div>
            </section>

            {/* Audit panel reminder */}
            <section className="pt-2 border-t border-slate-800/50">
              <div className="text-slate-500 text-xs leading-relaxed">
                Hover any Pāli word, then toggle <span className="text-slate-300">Audit panel</span> in
                Settings to see senses, scholarly notes, pronunciation, and citations.
              </div>
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
