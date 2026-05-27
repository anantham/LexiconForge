import { useEffect, useMemo, useState } from 'react';
import { fetchParallels, fetchParallelText } from '../../services/scraping/scParallels';
import type { ParallelInfo } from '../../types/suttaStudio';

type Props = { uid: string };

export function ParallelsPanel({ uid }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ParallelInfo[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [activeText, setActiveText] = useState<string>('');
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingList(true);
    fetchParallels(uid)
      .then((data) => {
        if (cancelled) return;
        setItems(data.filter((row) => row.uid !== uid));
      })
      .catch((error) => console.error('[ParallelsPanel] fetchParallels failed', { uid, error }))
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, [open, uid]);

  const grouped = useMemo(() => {
    return [...items].sort((a, b) => a.rootLang.localeCompare(b.rootLang) || a.uid.localeCompare(b.uid));
  }, [items]);

  const openParallel = async (parallelUid: string) => {
    setActiveUid(parallelUid);
    setLoadingText(true);
    try {
      setActiveText(await fetchParallelText(parallelUid));
    } catch (error) {
      console.error('[ParallelsPanel] fetchParallelText failed', { uid: parallelUid, error });
      setActiveText(error instanceof Error ? error.message : 'Unable to load parallel text right now.');
    } finally {
      setLoadingText(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 max-w-[32rem]">
      <button className="mb-2 rounded bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm" onClick={() => setOpen((v) => !v)}>
        Parallels ({items.length})
      </button>
      {open && (
        <div className="bg-slate-900 border border-slate-700 rounded p-3 text-sm shadow-2xl max-h-[70vh] overflow-y-auto w-[30rem]">
          <div className="font-semibold mb-2">Parallels for {uid.toUpperCase()}</div>
          {loadingList ? <div className="text-slate-400">Loading parallels…</div> : null}
          {!loadingList && grouped.length === 0 ? <div className="text-slate-400">No parallels available.</div> : null}
          <div className="space-y-1">
            {grouped.map((item) => (
              <div key={`${item.uid}-${item.type}`} className="flex items-center justify-between border-b border-slate-800 py-1">
                <div className="text-slate-200">{item.uid}{item.acronym ? ` (${item.acronym})` : ''} · {item.rootLang} · {item.type}</div>
                <button className="text-emerald-300 hover:text-emerald-200" onClick={() => openParallel(item.uid)}>Open</button>
              </div>
            ))}
          </div>
          {activeUid && (
            <div className="mt-3 border-t border-slate-700 pt-2">
              <div className="text-slate-300 font-medium mb-1">{activeUid}</div>
              {loadingText ? <div className="text-slate-400">Loading text…</div> : <pre className="whitespace-pre-wrap text-slate-200 font-serif" style={{ fontFamily: "'Noto Serif', 'Noto Serif CJK SC', 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', serif" }}>{activeText}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
