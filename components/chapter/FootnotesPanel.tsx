import React from 'react';
import type { Footnote } from '../../types';
import { tokenizeTranslation } from './translationTokens';

interface FootnotesPanelProps {
  chapterId?: string | null;
  footnotes?: Footnote[];
}

const FootnotesPanel: React.FC<FootnotesPanelProps> = ({ chapterId, footnotes }) => {
  if (!footnotes || footnotes.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-6 border-t border-gray-300 dark:border-gray-600" aria-label="Chapter footnotes">
      <h3 className="text-lg font-bold mb-4 font-sans">Notes</h3>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        {footnotes.map((note) => {
          const rawMarker = String(note.marker ?? '');
          const normalizedMarker = rawMarker.replace(/^[\[]|[\]]$/g, '');
          const baseId = `${chapterId ?? 'chapter'}-footnote-${normalizedMarker}`;
          const rendered = tokenizeTranslation(note.text || '', baseId);

          return (
            <li
              key={rawMarker}
              id={`footnote-def-${normalizedMarker}`}
              className="text-gray-600 dark:text-gray-400"
            >
              {rendered.nodes.map((node, idx) => {
                if (React.isValidElement(node)) {
                  const props: Record<string, any> = {
                    key: node.key ?? `${baseId}-node-${idx}`,
                  };
                  if (node.props['data-lf-chunk']) props['data-lf-chunk'] = undefined;
                  if (node.props['data-lf-type'] === 'text') props['data-lf-type'] = 'static';
                  return React.cloneElement(node, props);
                }
                return node;
              })}{' '}
              <a href={`#footnote-ref-${normalizedMarker}`} className="text-blue-500 hover:underline">
                ↑
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default FootnotesPanel;
