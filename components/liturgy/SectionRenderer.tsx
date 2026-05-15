import React from 'react';
import type { LiturgySection } from '../../types/liturgy';
import { TripleScriptWitness } from './shapes/TripleScriptWitness';
import { ProseBlock } from './ProseBlock';

/**
 * Shape dispatcher. Each `shape` value maps to its own renderer.
 *
 * Per the design philosophy (Pluralism, Live Machinery): we don't force every
 * chant into one template. New shapes get new renderers; old shapes stay
 * unchanged. The discriminated union in types/liturgy.ts is the contract.
 */

export const SectionRenderer: React.FC<{
  section: LiturgySection;
  primaryWitness: string;
  isOpening?: boolean;
}> = ({ section, primaryWitness, isOpening }) => {
  switch (section.shape) {
    case 'triple-script-witness':
      return (
        <TripleScriptWitness
          section={section}
          primaryWitness={primaryWitness}
          isOpening={isOpening}
        />
      );
    case 'prose-commentary':
      return (
        <section className="border-t border-slate-800 pt-8 mt-8" id={section.id}>
          {section.heading && <h2 className="text-slate-200 text-xl mb-4">{section.heading}</h2>}
          <ProseBlock text={section.body} />
        </section>
      );
    // Future shapes: comparative-translation, verse-decomposed, sound-formula,
    // dedication-formula. Each gets its own component when authored.
    default: {
      const sectionAny = section as { shape: string; id: string };
      return (
        <section className="border-t border-slate-800 pt-8 mt-8 text-slate-500 italic">
          <em>[Renderer for shape "{sectionAny.shape}" not yet implemented — see types/liturgy.ts]</em>
        </section>
      );
    }
  }
};

export default SectionRenderer;
