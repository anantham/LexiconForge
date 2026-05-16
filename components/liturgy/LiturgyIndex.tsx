import React from 'react';
import type { Sangha, LiturgyDoc, ScheduleEvent } from '../../types/liturgy';
import { liturgyDocsForSangha } from '../../data/liturgy';

/**
 * Per-sangha chant index — lists every chant belonging to one community.
 *
 *  /liturgy/<sangha-slug> → this page
 *
 * Renders the sangha's daily rhythm as a small bell-icon timeline at the
 * top, then groups the chants by frequency (daily in order, then weekly,
 * then occasional). Each card links to `/liturgy/<sangha-slug>/<chant>`.
 */

const SERIF_STACK = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

const BELL_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const CUSHION_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="8" rx="2" />
    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
  </svg>
);

const REST_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MEAL_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const WALK_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13" cy="4" r="2" />
    <path d="m13 8-2 4 3 3 1 6" />
    <path d="m8 14 3-3" />
    <path d="m9 12-3 4" />
  </svg>
);

const WORK_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

function ScheduleIcon({ kind }: { kind?: ScheduleEvent['icon'] }) {
  switch (kind) {
    case 'bell':
      return BELL_SVG;
    case 'cushion':
      return CUSHION_SVG;
    case 'rest':
      return REST_SVG;
    case 'meal':
      return MEAL_SVG;
    case 'walk':
      return WALK_SVG;
    case 'work':
      return WORK_SVG;
    default:
      return null;
  }
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily — in chanting order',
  weekly: 'Weekly',
  occasional: 'Occasional',
};

const FREQUENCY_ORDER: Array<'daily' | 'weekly' | 'occasional'> = ['daily', 'weekly', 'occasional'];

function frequencyKey(doc: LiturgyDoc): 'daily' | 'weekly' | 'occasional' {
  return doc.frequency ?? 'daily';
}

const ChantCard: React.FC<{ doc: LiturgyDoc; sanghaSlug: string }> = ({ doc, sanghaSlug }) => {
  return (
    <a
      href={`/liturgy/${sanghaSlug}/${doc.slug}`}
      className="block p-6 border border-slate-800 rounded-lg hover:border-emerald-700/50 hover:bg-slate-900/40 transition-colors"
    >
      <div className="flex items-baseline gap-4 mb-2 flex-wrap">
        <h2 className="text-xl text-slate-100" style={{ fontFamily: SERIF_STACK }}>
          {doc.title}
        </h2>
        <span className="text-xs uppercase tracking-widest text-slate-500">{doc.tradition}</span>
        {doc.time && (
          <span className="text-xs text-emerald-400/70 ml-auto">{doc.time}</span>
        )}
      </div>
      {doc.subtitle && <div className="text-slate-400 italic mb-1">{doc.subtitle}</div>}
      {doc.context && <p className="text-slate-500 text-sm">{doc.context}</p>}
    </a>
  );
};

export const LiturgyIndex: React.FC<{ sangha: Sangha }> = ({ sangha }) => {
  const docs = liturgyDocsForSangha(sangha.slug);
  const byFreq = new Map<string, LiturgyDoc[]>();
  for (const doc of docs) {
    const k = frequencyKey(doc);
    if (!byFreq.has(k)) byFreq.set(k, []);
    byFreq.get(k)!.push(doc);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="absolute top-4 left-6 text-xs z-10">
        <a href="/liturgy" className="text-emerald-400/80 hover:text-emerald-300 uppercase tracking-widest">
          ← All sanghas
        </a>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          <h1 className="text-4xl text-slate-100 mb-2" style={{ fontFamily: SERIF_STACK }}>
            {sangha.name}
          </h1>
          {sangha.fullName && sangha.fullName !== sangha.name && (
            <p className="text-slate-400 italic mb-3">{sangha.fullName}</p>
          )}
          {sangha.description && (
            <p className="text-slate-500 text-sm leading-relaxed">{sangha.description}</p>
          )}
          <div className="text-xs text-slate-600 mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {sangha.location && <span>📍 {sangha.location}</span>}
            {sangha.founded && <span>est. {sangha.founded}</span>}
            {sangha.url && (
              <a
                href={sangha.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400/60 hover:text-emerald-300"
              >
                {sangha.url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </header>

        {/* Daily rhythm — bell-icon timeline, with chant events clickable */}
        {sangha.schedule && sangha.schedule.length > 0 && (
          <div className="mb-12 p-5 rounded-lg border border-slate-800 bg-slate-900/30">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
              Daily rhythm
            </div>
            <div className="space-y-1.5">
              {sangha.schedule.map((ev, i) => {
                const isChantLink = Boolean(ev.chantSlug);
                const label = isChantLink ? (
                  <a
                    href={`/liturgy/${sangha.slug}/${ev.chantSlug}`}
                    className="text-sm text-slate-200 hover:text-emerald-300 transition-colors"
                  >
                    {ev.event}
                  </a>
                ) : (
                  <span className="text-sm text-slate-300">{ev.event}</span>
                );
                return (
                  <div key={i} className="flex items-baseline gap-3">
                    <span className="text-emerald-400/70 w-5 flex-shrink-0 self-center">
                      <ScheduleIcon kind={ev.icon} />
                    </span>
                    <span className="text-xs uppercase tracking-widest text-slate-500 w-24 flex-shrink-0">
                      {ev.time}
                    </span>
                    {isChantLink && !ev.icon ? (
                      <span className="flex items-baseline gap-2">
                        <span className="text-slate-700 text-xs">→</span>
                        {label}
                      </span>
                    ) : (
                      label
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {FREQUENCY_ORDER.map((freq) => {
          const group = byFreq.get(freq);
          if (!group || group.length === 0) return null;
          return (
            <section key={freq} className="mb-12">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                {FREQUENCY_LABEL[freq]}
              </div>
              <div className="space-y-6">
                {group.map((doc) => (
                  <ChantCard key={doc.slug} doc={doc} sanghaSlug={sangha.slug} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default LiturgyIndex;
