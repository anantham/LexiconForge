import React from 'react';
import type { AppSettings } from '../../types';

interface Props {
  value: string;
  onChange: (value: string) => void;
  settings: AppSettings;
}

const TranslationEditor: React.FC<Props> = ({ value, onChange, settings }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full min-h-[400px] p-4 border border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/20 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
    style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
    placeholder="Edit the translation..."
    autoFocus
  />
);

export default TranslationEditor;
