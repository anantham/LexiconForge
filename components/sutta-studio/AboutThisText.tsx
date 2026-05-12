import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DeepLoomPacket } from '../../types/suttaStudio';

/**
 * "About this text" — Level 3 audit affordance per ADR SUTTA-008 §UI Vision.
 *
 * Answers the reader's deeper provenance question: *what textual object am
 * I reading?* — work, expression, edition, digital source, translator,
 * annotation layer. Crucially, makes UNKNOWNNESS VISIBLE rather than hiding
 * empty fields. For Pāli suttas there is rarely a satisfying "recovered
 * from manuscript X, copied by monk Y" answer; honest framing is the goal.
 *
 * Default: a compact one-line chip ("MN10 · Pāli · SuttaCentral / Sujato")
 * mounted at the top of the rendered content. Click expands the full
 * structured panel.
 */
export function AboutThisText({ packet }: { packet: DeepLoomPacket }) {
  const [open, setOpen] = useState(false);
  const provenance = packet.provenance;
  const workId = packet.source?.workId ?? 'unknown';

  // Compact chip text — the always-visible breadcrumb.
  const tradition = provenance?.oralLineage?.school;
  const language = provenance?.oralLineage?.transmissionLanguage;
  const editionShort = provenance?.edition?.council ?? provenance?.edition?.name;
  const translator = provenance?.translation?.translator;
  const chipParts: string[] = [workId.toUpperCase()];
  if (language) chipParts.push(language);
  if (tradition) chipParts.push(tradition);
  if (translator) chipParts.push(`tr. ${translator}`);

  return (
    <div className="max-w-3xl mx-auto px-6 pt-12 pb-4 text-slate-400">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 text-xs font-mono tracking-wide hover:text-slate-200 transition"
        aria-expanded={open}
        aria-label={open ? 'Collapse About This Text panel' : 'Expand About This Text panel'}
      >
        <span className="opacity-60 group-hover:opacity-100 transition">
          {open ? '▼' : '▶'}
        </span>
        <span>{chipParts.join(' · ')}</span>
        <span className="text-slate-600 group-hover:text-slate-500 transition">about</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-l-2 border-emerald-800/40 pl-5 py-2 space-y-5 text-sm text-slate-300 leading-relaxed">
              <h2 className="text-xs uppercase tracking-widest text-slate-500 font-mono">
                About this text
              </h2>

              <Section label="Work">
                {workId.toUpperCase()} — Satipaṭṭhāna Sutta (Foundations of Mindfulness).
              </Section>

              {provenance?.oralLineage && (
                <Section label="Expression">
                  {[
                    provenance.oralLineage.school,
                    provenance.oralLineage.transmissionLanguage && `${provenance.oralLineage.transmissionLanguage} recension`,
                  ].filter(Boolean).join(' · ')}
                  {provenance.oralLineage.estimatedPeriod && (
                    <span className="text-slate-500"> · oral period {provenance.oralLineage.estimatedPeriod}</span>
                  )}
                  {provenance.oralLineage.method && (
                    <span className="text-slate-500"> · {provenance.oralLineage.method}</span>
                  )}
                </Section>
              )}

              {provenance?.edition && (
                <Section label="Edition">
                  {provenance.edition.name}
                  {provenance.edition.year && <span className="text-slate-500"> ({provenance.edition.year})</span>}
                  {provenance.edition.council && <span className="text-slate-500"> · {provenance.edition.council}</span>}
                  {provenance.edition.digitalSource && (
                    <div className="text-slate-500 text-xs mt-1">
                      Digital source: {provenance.edition.digitalSource}
                    </div>
                  )}
                </Section>
              )}

              {provenance?.translation && (
                <Section label="Translation">
                  {provenance.translation.translator}
                  {provenance.translation.year && <span className="text-slate-500"> ({provenance.translation.year})</span>}
                  {provenance.translation.license && (
                    <span className="text-slate-500"> · {provenance.translation.license}</span>
                  )}
                  {provenance.translation.institution && (
                    <span className="text-slate-500"> · via {provenance.translation.institution}</span>
                  )}
                </Section>
              )}

              {provenance?.attribution && (
                <Section label="Traditional attribution">
                  <span>
                    {provenance.attribution.speaker ?? 'Speaker unknown'}
                    {provenance.attribution.audience && ` to ${provenance.attribution.audience}`}
                  </span>
                  {provenance.attribution.legendaryPlace && (
                    <span className="text-slate-500"> · at {provenance.attribution.legendaryPlace}</span>
                  )}
                  {provenance.attribution.legendaryDate && (
                    <span className="text-slate-500"> · {provenance.attribution.legendaryDate}</span>
                  )}
                  {provenance.attribution.confidence && (
                    <div className="text-slate-500 text-xs mt-1">
                      Certainty: {provenance.attribution.confidence}
                    </div>
                  )}
                </Section>
              )}

              <Section label="Annotation layer">
                LexiconForge curated packet. Lexical glosses backed by Digital Pāli
                Dictionary (DPD v0.4.20260501, CC BY-NC-SA 4.0) and SuttaCentral
                aggregated dictionary entries. Curator-inferred grammatical claims
                marked explicitly in tooltips.
              </Section>

              {provenance?.external && provenance.external.length > 0 && (
                <Section label="External references">
                  <ul className="list-disc list-outside ml-4 space-y-1">
                    {provenance.external.map((ref, i) => (
                      <li key={i}>
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-emerald-400 underline-offset-2 hover:underline"
                        >
                          {ref.type}: {new URL(ref.url).hostname}
                        </a>
                        {ref.note && <span className="text-slate-500"> — {ref.note}</span>}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section label="Unknowns" tone="muted">
                <ul className="list-disc list-outside ml-4 space-y-1 text-slate-500 text-xs">
                  {(!provenance?.manuscripts || provenance.manuscripts.length === 0) && (
                    <li>
                      No single manuscript witness is attached to this packet. The
                      digital text is edition-derived (modern critical edition
                      based on Pāli canonical recension), not a direct manuscript
                      facsimile.
                    </li>
                  )}
                  {!provenance?.firstWritten && (
                    <li>
                      First written attestation date and place are not recorded
                      for this packet. Pāli canonical material was transmitted
                      orally for centuries before being written down; later
                      attempts to attribute a single first-writing event to MN10
                      specifically should be treated as traditional, not attested.
                    </li>
                  )}
                  <li>
                    Per-segment variant readings (where witnesses disagree on the
                    Pāli wording) are available via SC bilara <code className="text-slate-400">variant-pli-ms</code>{' '}
                    files, but mn10:1.1 has no recorded variants — the opening
                    line "Evaṁ me sutaṁ" is stable across all witnesses.
                  </li>
                  <li>
                    Buddhaghosa's commentary (Papañcasūdanī) is not yet wired into
                    this packet; commentarial attestations cannot be surfaced for
                    these lines until that provider lands.
                  </li>
                </ul>
              </Section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  label,
  children,
  tone = 'normal',
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'normal' | 'muted';
}) {
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-widest font-mono mb-1 ${
        tone === 'muted' ? 'text-slate-600' : 'text-slate-500'
      }`}>
        {label}
      </div>
      <div className={tone === 'muted' ? 'text-slate-400 text-xs' : ''}>
        {children}
      </div>
    </div>
  );
}
