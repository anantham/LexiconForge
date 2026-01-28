type StudioProgressProps = {
  label: string;
  show: boolean;
  overdue?: boolean;
};

export function StudioProgress({ label, show, overdue }: StudioProgressProps) {
  if (!show) return null;
  return (
    <div
      className={`text-xs border rounded-full px-3 py-1 flex items-center gap-2 ${
        overdue ? 'text-rose-400 border-rose-500/60' : 'text-slate-400 border-slate-800'
      }`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full animate-pulse ${
          overdue ? 'bg-rose-400' : 'bg-emerald-400'
        }`}
      />
      {label}
    </div>
  );
}
