import type {
  AlignmentJudgment,
  AlignmentVerifier,
  ChapterProbe,
} from './chapter-alignment-types';

const DEFAULT_ALIGNMENT_MODEL = process.env.OPENROUTER_ALIGNMENT_MODEL || 'openrouter/free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const shouldRetryStatus = (status: number): boolean => status === 429 || (status >= 500 && status < 600);
const isFreeModel = (model: string): boolean => model === 'openrouter/free' || model.endsWith(':free');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const excerpt = (probe: ChapterProbe): string => [
  `Chapter Number: ${probe.chapterNumber}`,
  `Title: ${probe.title}`,
  `Excerpt: ${probe.excerpt}`,
].join('\n');

const parseJsonObject = (content: string): Record<string, unknown> => {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
    throw new Error(`OpenRouter alignment verifier returned invalid JSON: ${content}`);
  }
};

export class OpenRouterAlignmentVerifier implements AlignmentVerifier {
  kind = 'openrouter-bilingual';
  model: string;
  private apiKey: string;

  constructor(model: string = DEFAULT_ALIGNMENT_MODEL, apiKey?: string) {
    this.model = model;
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY for chapter alignment verification.');
    }

    if (!isFreeModel(this.model)) {
      throw new Error(
        `Refusing to run chapter alignment with non-free model "${this.model}". Use "openrouter/free" or a model id ending with ":free".`
      );
    }
  }

  async verify(raw: ChapterProbe, english: ChapterProbe): Promise<AlignmentJudgment> {
    const requestBody = {
      model: this.model,
      temperature: 0,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: [
            'You are a strict bilingual chapter-alignment judge for Chinese raws and English fan translations of the same web novel.',
            'Decide whether the Chinese raw chapter and the English chapter correspond to the same chapter content.',
            'Return "same" when the English candidate clearly covers the same opening/content as the raw chapter, even if the English candidate is a merged chapter spanning adjacent raw chapters.',
            'Be strict. Similar themes are not enough; the opening scene, title semantics, and major named entities should line up.',
            'Return ONLY a compact JSON object with keys: relation ("same" or "different"), confidence (0 to 1), rationale (short string). No markdown or extra commentary.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            'Chinese raw chapter:',
            excerpt(raw),
            '',
            'English chapter candidate:',
            excerpt(english),
            '',
            'Are these the same chapter content?',
          ].join('\n'),
        },
      ],
    };

    let attempt = 0;
    while (true) {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'LexiconForge Chapter Alignment',
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (shouldRetryStatus(response.status) && attempt < 2) {
          attempt += 1;
          await sleep(1000 * attempt);
          continue;
        }
        throw new Error(payload?.error?.message || `OpenRouter alignment request failed with HTTP ${response.status}`);
      }

      const text = payload?.choices?.[0]?.message?.content;
      if (!text || typeof text !== 'string') {
        throw new Error('OpenRouter alignment verifier returned an empty response.');
      }

      const parsed = parseJsonObject(text);
      const relationText = typeof parsed?.relation === 'string'
        ? parsed.relation.toLowerCase()
        : '';
      const rationale = typeof parsed?.rationale === 'string'
        ? parsed.rationale
        : typeof parsed?.rationalize === 'string'
          ? parsed.rationalize
          : 'No rationale provided.';

      return {
        relation: relationText.includes('same') ? 'same' : 'different',
        confidence: typeof parsed?.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
        rationale,
      };
    }
  }
}

export class FakeAlignmentVerifier implements AlignmentVerifier {
  kind = 'fake';
  model = 'fake';
  private readonly delegate: (raw: ChapterProbe, english: ChapterProbe) => AlignmentJudgment | Promise<AlignmentJudgment>;

  constructor(delegate: (raw: ChapterProbe, english: ChapterProbe) => AlignmentJudgment | Promise<AlignmentJudgment>) {
    this.delegate = delegate;
  }

  async verify(raw: ChapterProbe, english: ChapterProbe): Promise<AlignmentJudgment> {
    return this.delegate(raw, english);
  }
}
