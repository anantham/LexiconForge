import { AlignmentResult, AppSettings } from '../types';
import { indexedDBService } from './indexeddb';
import prompts from '../config/prompts.json';
import { OpenAI } from 'openai';
import { debugLog } from '../utils/debug';

interface ComparisonResponse {
  alignments: Array<{
    translationChunkId: string;
    matches: Array<{
      fanChunkId: string;
      text: string;
      confidence: number;
    }>;
  }>;
}

const clog = (...args: any[]) => debugLog('comparison', 'summary', '[ComparisonService]', ...args);

const extractJsonPayload = (text: string): string | null => {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
        } else if (text[i] === '"') {
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
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
};

export class ComparisonService {
  private static cache = new Map<string, AlignmentResult>();

  static async getAlignmentCached(
    chapterId: string,
    translationVersionId: string
  ): Promise<AlignmentResult | null> {
    const key = `${chapterId}:${translationVersionId}`;
    if (this.cache.has(key)) {
      clog('Cache hit for alignment', key);
      return this.cache.get(key)!;
    }

    const versions = await indexedDBService.getTranslationVersionsByStableId(chapterId).catch(() => []);
    const match = Array.isArray(versions)
      ? versions.find((v: any) => v.id === translationVersionId)
      : null;
    if (match?.fanAlignment) {
      clog('Loaded alignment from IndexedDB', key);
      this.cache.set(key, match.fanAlignment);
      return match.fanAlignment;
    }

    return null;
  }

  static async requestAlignment(
    translationChunks: Array<{ id: string; text: string }>,
    fanChunks: Array<{ id: string; text: string }>,
    chapterId: string,
    translationVersionId: string,
    settings: AppSettings
  ): Promise<AlignmentResult> {
    const translationText = translationChunks
      .map((chunk, idx) => `Chunk ${idx + 1}\nID: ${chunk.id}\nTEXT: ${chunk.text}`)
      .join('\n\n');
    const fanText = fanChunks
      .map((chunk, idx) => `Fan Chunk ${idx + 1}\nID: ${chunk.id}\nTEXT: ${chunk.text}`)
      .join('\n\n');

    clog('Comparison request sizes', {
      translationChunkCount: translationChunks.length,
      fanChunkCount: fanChunks.length,
      translationChars: translationText.length,
      fanChars: fanText.length,
    });

    let prompt = prompts.comparisonPrompt;
    prompt = prompt.replace('{{translationChunks}}', translationText || '(none)');
    prompt = prompt.replace('{{fanChunks}}', fanText || '(none)');

    const { apiKey, baseURL } = resolveApiConfig(settings);
    if (!apiKey) {
      throw new Error(`API key for ${settings.provider} is missing.`);
    }

    const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
    const maxOutput = Math.max(1, Math.min((settings.maxOutputTokens ?? 16384), 200000));

    clog('Comparison request -> model', settings.model);

    const completion = await client.chat.completions.create({
      model: settings.model,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutput,
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const jsonPayload = extractJsonPayload(content) || content.trim();
    let parsed: ComparisonResponse | null = null;
    try {
      parsed = JSON.parse(jsonPayload);
    } catch (error) {
      console.warn('[ComparisonService] Failed to parse comparison JSON', { content });
      throw error;
    }

    const response = parsed;

    const alignment: AlignmentResult = {
      versionId: translationVersionId,
      generatedAt: new Date().toISOString(),
      entries: response.alignments.map((entry) => ({
        translationChunkId: entry.translationChunkId,
        matches: entry.matches.map((m) => ({
          fanChunkId: m.fanChunkId,
          fanText: m.text,
          confidence: m.confidence,
        })),
      })),
    };

    const key = `${chapterId}:${translationVersionId}`;
    this.cache.set(key, alignment);
    return alignment;
  }
}

function resolveApiConfig(settings: AppSettings): { apiKey?: string; baseURL?: string } {
  switch (settings.provider) {
    case 'OpenAI':
      return {
        apiKey: settings.apiKeyOpenAI || (process.env.OPENAI_API_KEY as string | undefined),
        baseURL: 'https://api.openai.com/v1',
      };
    case 'DeepSeek':
      return {
        apiKey: settings.apiKeyDeepSeek || (process.env.DEEPSEEK_API_KEY as string | undefined),
        baseURL: 'https://api.deepseek.com/v1',
      };
    case 'OpenRouter':
      return {
        apiKey: (settings as any).apiKeyOpenRouter || (process.env.OPENROUTER_API_KEY as string | undefined),
        baseURL: 'https://openrouter.ai/api/v1',
      };
    case 'Gemini':
    case 'Claude':
      console.warn('[ComparisonService] Provider not directly supported, defaulting to OpenRouter.');
      return {
        apiKey: (settings as any).apiKeyOpenRouter || (process.env.OPENROUTER_API_KEY as string | undefined),
        baseURL: 'https://openrouter.ai/api/v1',
      };
    default:
      console.warn('[ComparisonService] Unknown provider, defaulting to OpenRouter.');
      return {
        apiKey: (settings as any).apiKeyOpenRouter || (process.env.OPENROUTER_API_KEY as string | undefined),
        baseURL: 'https://openrouter.ai/api/v1',
      };
  }
}
