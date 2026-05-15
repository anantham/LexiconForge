import React from 'react';
import { LiturgyIndex } from './LiturgyIndex';
import { LiturgyChantPage } from './LiturgyChantPage';
import { getLiturgyDoc } from '../../data/liturgy';

/**
 * Liturgy reader top-level router.
 *
 *  /liturgy            → index
 *  /liturgy/<slug>     → one chant
 *
 * No client-side framework — just pathname inspection, matching the existing
 * App.tsx routing pattern. Keeps the new surface narrow.
 */

export const LiturgyApp: React.FC<{ pathname: string }> = ({ pathname }) => {
  const trimmed = pathname.replace(/\/$/, '');
  const slug = trimmed === '/liturgy' || trimmed === '' ? null : trimmed.split('/').pop() ?? null;

  if (!slug) {
    return <LiturgyIndex />;
  }

  const doc = getLiturgyDoc(slug);
  if (!doc) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <a href="/liturgy" className="text-emerald-400/80 hover:text-emerald-300 text-sm">
            ← Liturgy
          </a>
          <h1 className="text-2xl text-slate-100 font-serif mt-8 mb-4">Not found</h1>
          <p className="text-slate-400">
            No chant named "<code className="text-emerald-300">{slug}</code>" in the registry.
          </p>
        </div>
      </div>
    );
  }

  return <LiturgyChantPage doc={doc} />;
};

export default LiturgyApp;
