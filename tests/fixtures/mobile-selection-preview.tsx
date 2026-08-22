import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import MobileSelectionHint from '../../components/chapter/MobileSelectionHint';
import { MobileSelectionSheet } from '../../components/chapter/MobileSelectionSheet';

const selectedText = 'Myth was being reborn before their eyes. Not mere rain, but cannons of magic crashed across the battlefield.';

const Preview: React.FC = () => {
  const state = new URLSearchParams(window.location.search).get('state') ?? 'sheet';

  return (
    <main className="px-5 py-12 text-slate-100" style={{ minHeight: '140vh', backgroundColor: '#020617' }}>
      <article className="mx-auto max-w-xl space-y-8 font-serif text-xl leading-9">
        <h1 className="text-3xl font-bold">A Tender Deception</h1>
        <p>Brilliant magic hammered the ground as the gathered forces fell speechless.</p>
        <p>{selectedText}</p>
        <p>But how in hell were they supposed to stop that?</p>
      </article>

      {state === 'hint' ? (
        <MobileSelectionHint isTouch viewMode="english" selectionActive={false} />
      ) : (
        <MobileSelectionSheet
          selectedText={selectedText}
          canCompare
          isComparing={false}
          onReact={() => {}}
          onCopy={() => {}}
          onClose={() => {}}
        />
      )}
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Preview />);
