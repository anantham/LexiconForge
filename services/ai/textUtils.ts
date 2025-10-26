import type { AppSettings } from '../../types';

export function replacePlaceholders(input: string, settings: AppSettings): string {
  const lang = settings.targetLanguage || 'English';
  let s = input || '';
  s = s.replaceAll('{{targetLanguage}}', lang);
  s = s.replaceAll('{{targetLanguageVariant}}', lang);
  return s;
}

export function extractBalancedJson(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no_json: No opening brace found.');

  let depth = 0;
  let i = start;
  let end = -1;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    i++;
  }

  if (end === -1) throw new Error('unbalanced_json: Truncated JSON payload.');
  return text.slice(start, end + 1);
}
