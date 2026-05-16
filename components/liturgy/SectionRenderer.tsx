import React from 'react';
import type { LiturgySection } from '../../types/liturgy';
import { TripleScriptWitness } from './shapes/TripleScriptWitness';
import { SoundFormula } from './shapes/SoundFormula';
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
  /** Page-level current witness `by` name. Used by triple-script-witness sections. */
  preferredWitnessBy: string;
  /** Page-level witness cycler. Invoked when the user clicks an English line. */
  onCycleWitness: () => void;
  isOpening?: boolean;
}> = ({ section, preferredWitnessBy, onCycleWitness, isOpening }) => {
  switch (section.shape) {
    case 'triple-script-witness':
      return (
        <TripleScriptWitness
          section={section}
          preferredWitnessBy={preferredWitnessBy}
          onCycleWitness={onCycleWitness}
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
    case 'sound-formula':
      return <SoundFormula section={section} isOpening={isOpening} />;
    // Future shapes: comparative-translation, verse-decomposed,
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
