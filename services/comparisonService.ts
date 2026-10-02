import { AppSettings } from '../types';
import prompts from '../config/prompts.json';
import { debugLog } from '../utils/debug';
import { requestWithSelectedProvider } from './ai/selectedProvider';

const clog = (...args: any[]) => debugLog('comparison', 'summary', '[ComparisonService]', ...args);

interface FocusedComparisonArgs {
  chapterId: string;
  selectedTranslation: string;
  fullTranslation: string;
  fullFanTranslation: string;
  fullRawText?: string;
  settings: AppSettings;
}

export interface FocusedComparisonResult {
  fanExcerpt: string;
  fanContextBefore: string | null;
  fanContextAfter: string | null;
  rawExcerpt: string | null;
  rawContextBefore: string | null;
  rawContextAfter: string | null;
  confidence?: number;
}

const stripMarkdownFences = (text: string): string => {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
};

const extractJsonPayload = (text: string): string | null => {
  const sanitized = stripMarkdownFences(text);
  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    // Continue to substring extraction
  }

  const start = sanitized.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < sanitized.length; i++) {
    const ch = sanitized[i];
    if (ch === '"') {
      i++;
      while (i < sanitized.length) {
        if (sanitized[i] === '\\') {
          i += 2;
        } else if (sanitized[i] === '"') {
          break;
        } else {
          i++;
        }
      }
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return sanitized.slice(start, i + 1);
      }
    }
  }
  return null;
};

const applyTemplate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((acc, [key, value]) => acc.split(`{{${key}}}`).join(value), template);

const toOptionalString = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value == null) return null;
  if (Array.isArray(value)) return value.map((item) => toOptionalString(item) ?? '').join(' ').trim() || null;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

export class ComparisonService {
  static async requestFocusedComparison(args: FocusedComparisonArgs): Promise<FocusedComparisonResult> {
    const {
      chapterId,
      selectedTranslation,
      fullTranslation,
      fullFanTranslation,
      fullRawText = '',
      settings,
    } = args;

    if (!fullFanTranslation?.trim()) {
      throw new Error('Fan translation is required for comparison.');
    }

    const prompt = applyTemplate(prompts.comparisonPrompt, {
      selectedTranslation: selectedTranslation || '(empty selection)',
      fullTranslation: fullTranslation || '(no translation text available)',
      fanTranslation: fullFanTranslation || '(no fan translation available)',
      rawText: fullRawText || '(no raw text available)',
    });

    clog('Focused comparison request', {
      chapterId,
      selectionLength: selectedTranslation?.length ?? 0,
      translationLength: fullTranslation?.length ?? 0,
      fanLength: fullFanTranslation?.length ?? 0,
      rawLength: fullRawText?.length ?? 0,
      model: settings.model,
    });

    const maxOutput = Math.max(256, Math.min((settings.maxOutputTokens ?? 4096), 200000));
    const completion = await requestWithSelectedProvider({
      settings,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: maxOutput,
      temperature: 0,
      apiType: 'translation',
      chapterId,
    });

    const content = completion.text;
    const jsonPayload = extractJsonPayload(content);
    if (!jsonPayload) {
      console.warn('[ComparisonService] Unable to locate JSON payload in response', { content });
      throw new Error('Comparison response did not contain valid JSON.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonPayload);
    } catch (error) {
      console.warn('[ComparisonService] Failed to parse comparison JSON', { content, jsonPayload });
      throw error;
    }

  const result: FocusedComparisonResult = {
    fanExcerpt: (toOptionalString(parsed?.fanExcerpt) ?? '').trim(),
    fanContextBefore: toOptionalString(parsed?.fanContextBefore),
    fanContextAfter: toOptionalString(parsed?.fanContextAfter),
    rawExcerpt: toOptionalString(parsed?.rawExcerpt),
    rawContextBefore: toOptionalString(parsed?.rawContextBefore),
    rawContextAfter: toOptionalString(parsed?.rawContextAfter),
    confidence: toOptionalNumber(parsed?.confidence),
  };

    clog('Focused comparison response', {
      chapterId,
      fanExcerptLength: result.fanExcerpt.length,
      fanContextBeforeLength: result.fanContextBefore?.length ?? 0,
      fanContextAfterLength: result.fanContextAfter?.length ?? 0,
      hasRawExcerpt: Boolean(result.rawExcerpt),
      confidence: result.confidence,
    });

    return result;
  }
}
