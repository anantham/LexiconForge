import { ChapterForEpub } from '../types';
import {
  sanitizeHtmlAllowlist,
  toStrictXhtml,
  convertNewlinesToBrInElement,
  htmlFragmentToXhtml
} from '../sanitizers/xhtmlSanitizer';
import { ILLUSTRATION_MARKER_INNER } from '../../ai/illustrationMarkers';

/**
 * Build chapter XHTML using DOM nodes (footnotes visible inline and at end)
 */
export const buildChapterXhtml = (chapter: ChapterForEpub): string => {
  const root = document.createElement('div');
  // Title
  const h1 = document.createElement('h1');
  h1.textContent = chapter.translatedTitle || chapter.title;
  root.appendChild(h1);

  // Use translated content if available, fallback to original content
  const contentToProcess = chapter.translatedContent || chapter.content;

  // 1) Inject placeholders for markers (including surrounding brackets) —
  // marker grammar comes from the canonical module, not a private copy.
  const withIllu = contentToProcess.replace(
    new RegExp(String.raw`\[(${ILLUSTRATION_MARKER_INNER})\]`, 'g'),
    (_m, marker) => `<span data-illu="${marker}"></span>`
  );
  // Match footnote markers in [1], [2], [3] format as specified in prompts
  const withPlaceholders = withIllu.replace(/\[(\d+)\]/g, (_m, n) => `<span data-fn="${n}"></span>`);

  // 2) Sanitize with tight allowlist to preserve inline tags safely
  const sanitized = sanitizeHtmlAllowlist(withPlaceholders);

  // 3) Materialize into a working container and normalize newlines to <br>
  const container = document.createElement('div');
  container.innerHTML = sanitized;
  convertNewlinesToBrInElement(container);

  // 4) Replace placeholders with generated illustration blocks and footnote refs
  const imagesByMarker = new Map<string, typeof chapter.images[number]>(
    chapter.images.map(i => [i.marker, i])
  );
  for (const span of Array.from(container.querySelectorAll('span[data-illu]'))) {
    const marker = (span as HTMLElement).getAttribute('data-illu') || '';
    const img = imagesByMarker.get(`[${marker}]`) || imagesByMarker.get(marker);
    if (img) {
      const wrap = document.createElement('div');
      wrap.setAttribute('class', 'illustration');
      const im = document.createElement('img');
      im.setAttribute('src', img.imageData);
      im.setAttribute('alt', img.prompt);
      im.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 1em auto;');
      const cap = document.createElement('p');
      cap.setAttribute('class', 'illustration-caption');
      cap.setAttribute('style', 'text-align: center; font-style: italic; color: #666; font-size: 0.9em; margin-top: 0.5em;');
      cap.textContent = img.prompt;
      wrap.appendChild(im);
      wrap.appendChild(cap);
      span.replaceWith(wrap);
    } else {
      // If missing, remove placeholder
      span.remove();
    }
  }
  for (const span of Array.from(container.querySelectorAll('span[data-fn]'))) {
    const num = (span as HTMLElement).getAttribute('data-fn') || '';
    const sup = document.createElement('sup');
    const a = document.createElement('a');
    a.setAttribute('href', `#fn${num}`);
    a.setAttribute('class', 'footnote-ref');
    a.setAttribute('id', `fnref${num}`);
    a.setAttribute('epub:type', 'noteref');
    a.textContent = `[${num}]`;
    sup.appendChild(a);
    span.replaceWith(sup);
  }

  // 5) Wrap content in a section and append under title
  const section = document.createElement('section');
  section.setAttribute('class', 'chapter-content');
  while (container.firstChild) section.appendChild(container.firstChild);
  root.appendChild(section);

  // 6) Footnotes section at end
  if (chapter.footnotes && chapter.footnotes.length > 0) {
    const div = document.createElement('div');
    div.setAttribute('class', 'footnotes');
    const h3 = document.createElement('h3');
    h3.textContent = 'Footnotes';
    const ol = document.createElement('ol');
    div.appendChild(h3);
    div.appendChild(ol);
    for (const fn of chapter.footnotes) {
      // Strip surrounding brackets from canonical '[1]'-style markers so the
      // li id ('fn1') matches the inline noteref href ('#fn1') generated above.
      const num = String(fn.marker).replace(/^\[|\]$/g, '');
      const li = document.createElement('li');
      li.setAttribute('id', `fn${num}`);
      li.setAttribute('epub:type', 'footnote');

      // Allow limited inline HTML inside footnotes (e.g., <i>, <b>, <br>)
      try {
        const safeHtml = sanitizeHtmlAllowlist(fn.text || '');
        if (safeHtml) {
          const temp = document.createElement('div');
          temp.innerHTML = safeHtml;
          while (temp.firstChild) li.appendChild(temp.firstChild);
          li.appendChild(document.createTextNode(' '));
        } else {
          li.appendChild(document.createTextNode((fn.text || '') + ' '));
        }
      } catch {
        li.appendChild(document.createTextNode((fn.text || '') + ' '));
      }

      const back = document.createElement('a');
      back.setAttribute('href', `#fnref${num}`);
      back.setAttribute('class', 'footnote-backref');
      back.setAttribute('epub:type', 'backlink');
      back.textContent = '↩';
      li.appendChild(back);
      ol.appendChild(li);
    }
    root.appendChild(div);
  }

  // 7) XHTML serialization
  return htmlFragmentToXhtml(toStrictXhtml(root.innerHTML));
};
