import type { TranslationWitness, TranslationWitnessSet } from '../../types/suttaStudioWitness';

export function TranslationControls({ catalog, selected, onSelect, onLanguage }: {
  catalog: TranslationWitnessSet;
  selected: TranslationWitness;
  onSelect: (_id: string) => void;
  onLanguage: (_language: string) => void;
}) {
  const languages = [...new Map(catalog.witnesses.map(w => [w.language, w.languageName])).entries()];
  const witnesses = catalog.witnesses.filter(w => w.language === selected.language);
  const nextWitness = witnesses[(witnesses.findIndex(w => w.id === selected.id) + 1) % witnesses.length];
  const nextLanguage = languages[(languages.findIndex(([code]) => code === selected.language) + 1) % languages.length][0];
  const a = selected.attribution;
  return (
    <details data-witness-controls className="max-w-3xl mx-auto px-4 text-sm text-slate-400">
      <summary className="cursor-pointer text-center py-2 focus-visible:outline focus-visible:outline-emerald-700">
        Reading: {selected.languageName} · {selected.label}
      </summary>
      <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 min-w-0 flex-1">Language
            <select aria-label="Translation language" value={selected.language} onChange={e => onLanguage(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 w-full">
              {languages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-0 flex-1">Translation witness
            <select aria-label="Translation witness" value={selected.id} onChange={e => onSelect(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-2 w-full">
              {witnesses.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          <button type="button" disabled={witnesses.length < 2} onClick={() => onSelect(nextWitness.id)} className="underline disabled:opacity-40">Next translation</button>
          <button type="button" disabled={languages.length < 2} onClick={() => onLanguage(nextLanguage)} className="underline disabled:opacity-40">Next language</button>
        </div>
        <p>{a.translator ? `Translator: ${a.translator}. ` : ''}{a.publisher ? `Publisher: ${a.publisher}. ` : ''}{a.edition} · {a.revision}</p>
        <p>Translated from {a.source.language}: {a.source.witness}.</p>
        <p>{a.license} {a.licenseUrl && <a href={a.licenseUrl} target="_blank" rel="noreferrer" className="underline">License terms</a>}</p>
        <p>{a.normalization} {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="underline">Witness source</a>}</p>
        <p>One witness is selected for the whole reading. Missing coverage stays visible. Language and translation choices are separate from lexical senses and commentary.</p>
        {selected.content.kind === 'legacy-interlinear'
          ? <p>Click a draft gloss to cycle its lexical senses and supplied grammar. These are alternatives within this draft, not other translators.</p>
          : <p>Translation wording stays fixed. Open a phrase for its mapping and evidence. Word notes and the audit panel retain the packet’s separately attributed study commentary.</p>}
        {catalog.witnesses.length === 1 && <p>Only this witness is loaded. Additional translations and languages await source selection and alignment.</p>}
        {selected.content.kind === 'translation' && <details>
          <summary className="cursor-pointer">Read witness in its original order</summary>
          <div lang={selected.language} dir={selected.direction ?? 'auto'} className="space-y-3 pt-3">
            {selected.content.passages.map(p => <p key={p.id}><span className="text-xs">{p.label} </span><span className="whitespace-pre-wrap">{p.text}</span></p>)}
          </div>
        </details>}
      </div>
    </details>
  );
}
