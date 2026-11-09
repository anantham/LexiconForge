/** Deterministic local assembly. Run: node --import tsx scripts/build-trimsika.ts */
import { writeFileSync } from 'node:fs';
import source from '../data/trimsika/source.json';
import annotations from '../data/trimsika/annotations.json';
import provenance from '../data/trimsika/provenance.json';
import { buildTrimsika, type VerseDraft } from '../data/trimsika/build';
import type { Provenance } from '../types/suttaStudio';

const packet = buildTrimsika(source, annotations as VerseDraft[], provenance as Provenance);
writeFileSync(new URL('../content/references/sutta/trimsika.json', import.meta.url), `${JSON.stringify(packet, null, 2)}\n`);
console.log(`Triṃśikā: ${packet.phases.length} verses, ${packet.phases.reduce((n, p) => n + p.paliWords.length, 0)} words, ${packet.citations.length} citations; offline assembly.`);
