import type { ThreadData, ThreadMetadata } from '../../types/oscilloscope';

const THREAD_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
  '#a855f7', '#6366f1', '#0ea5e9', '#84cc16', '#f59e0b',
];

const CATEGORY_COLORS: Record<string, string> = {
  character: '#3b82f6',
  tone: '#ef4444',
  location: '#22c55e',
  faction: '#f97316',
  entity: '#8b5cf6',
  power: '#eab308',
  meta: '#6b7280',
  custom: '#ec4899',
};

export function pickThreadColor(threads: Map<string, ThreadData>, category: string): string {
  const existing = threads.size;
  return existing < THREAD_COLORS.length
    ? THREAD_COLORS[existing]
    : CATEGORY_COLORS[category] ?? THREAD_COLORS[existing % THREAD_COLORS.length];
}

export function toThreadMetadata(thread: ThreadData): ThreadMetadata {
  let peakValue = 0;
  let peakChapter = 1;
  thread.values.forEach((value, index) => {
    if (value > peakValue) {
      peakValue = value;
      peakChapter = index + 1;
    }
  });
  return {
    threadId: thread.threadId,
    category: thread.category,
    label: thread.label,
    chaptersCovered: thread.values.filter((value) => value !== 0).length,
    peakValue,
    peakChapter,
  };
}
