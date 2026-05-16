import React from 'react';
import { SanghaIndex } from './SanghaIndex';
import { LiturgyIndex } from './LiturgyIndex';
import { LiturgyChantPage } from './LiturgyChantPage';
import { getLiturgyDoc } from '../../data/liturgy';
import { getSangha } from '../../data/liturgy/sanghas';

/**
 * Liturgy reader top-level router.
 *
 *  /liturgy                            → SanghaIndex (pick a sangha)
 *  /liturgy/<sangha>                   → LiturgyIndex (that sangha's chants)
 *  /liturgy/<sangha>/<chant-slug>      → LiturgyChantPage (the chant)
 *
 * No client-side framework — just pathname inspection, matching the existing
 * App.tsx routing pattern.
 */

const NotFound: React.FC<{ what: string; back: string; backLabel: string }> = ({
  what,
  back,
  backLabel,
}) => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="max-w-3xl mx-auto px-6 py-12">
      <a href={back} className="text-emerald-400/80 hover:text-emerald-300 text-sm">
        ← {backLabel}
      </a>
      <h1 className="text-2xl text-slate-100 font-serif mt-8 mb-4">Not found</h1>
      <p className="text-slate-400">{what}</p>
    </div>
  </div>
);

export const LiturgyApp: React.FC<{ pathname: string }> = ({ pathname }) => {
  const trimmed = pathname.replace(/\/$/, '');
  // /liturgy → []; /liturgy/maple → ['maple']; /liturgy/maple/heart-sutra → ['maple', 'heart-sutra']
  const parts = trimmed.replace(/^\/liturgy\/?/, '').split('/').filter(Boolean);

  // /liturgy → top-level sangha picker
  if (parts.length === 0) {
    return <SanghaIndex />;
  }

  const [sanghaSlug, chantSlug] = parts;
  const sangha = getSangha(sanghaSlug);
  if (!sangha) {
    return (
      <NotFound
        what={`No sangha named "${sanghaSlug}" in the registry.`}
        back="/liturgy"
        backLabel="All sanghas"
      />
    );
  }

  // /liturgy/<sangha> → that sangha's chants
  if (!chantSlug) {
    return <LiturgyIndex sangha={sangha} />;
  }

  // /liturgy/<sangha>/<chant> → the chant page
  const doc = getLiturgyDoc(sanghaSlug, chantSlug);
  if (!doc) {
    return (
      <NotFound
        what={`No chant "${chantSlug}" in the ${sangha.name} registry.`}
        back={`/liturgy/${sanghaSlug}`}
        backLabel={sangha.name}
      />
    );
  }

  return <LiturgyChantPage doc={doc} sangha={sangha} />;
};

export default LiturgyApp;
