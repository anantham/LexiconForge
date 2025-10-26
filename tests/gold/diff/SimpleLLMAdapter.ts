/**
 * SimpleLLMAdapter - OpenRouter API wrapper for golden tests
 *
 * Purpose: Enable diff golden tests to make real LLM calls without
 * pulling in the full translationService dependency tree.
 *
 * VCR-ready: Designed to work with cassette recording/replay.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

interface SimpleLLMResponse {
  translatedText: string;
  cost?: number;
  model?: string;
}

export interface SimpleLLMProvider {
  translate(options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }): Promise<SimpleLLMResponse>;
}

/**
 * Minimal cost calculator based on OpenRouter pricing
 * (Simplified - doesn't query model catalog)
 */
function estimateCost(modelId: string, totalTokens: number): number {
  // Rough estimates for common models (cost per million tokens)
  const costPerMillion: Record<string, number> = {
    'anthropic/claude-3.5-sonnet': 3.0,
    'google/gemini-2.0-flash-exp:free': 0, // Free tier
    'openai/gpt-4o': 5.0,
    'openai/gpt-4o-mini': 0.15,
  };

  const rate = costPerMillion[modelId] || 1.0; // Default fallback
  return (totalTokens / 1_000_000) * rate;
}

const CASSETTE_DIR = path.resolve(process.cwd(), 'tests/gold/diff/cassettes');

const isLiveRecording = (): boolean => {
  const flag = process.env.LIVE_API_TEST;
  return flag === '1' || flag === 'true';
};

const ensureCassetteDir = () => {
  if (!fs.existsSync(CASSETTE_DIR)) {
    fs.mkdirSync(CASSETTE_DIR, { recursive: true });
  }
};

export class SimpleLLMAdapter implements SimpleLLMProvider {
  constructor(private apiKey: string) {}

  async translate(options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }): Promise<SimpleLLMResponse> {
    const cassettePayload = {
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
      text: options.text,
    };

    const cassetteHash = createHash('sha256')
      .update(JSON.stringify(cassettePayload))
      .digest('hex')
      .slice(0, 16);
    const cassettePath = path.join(CASSETTE_DIR, `${cassetteHash}.json`);
    const liveMode = isLiveRecording();

    if (!liveMode && fs.existsSync(cassettePath)) {
      const cassette = JSON.parse(fs.readFileSync(cassettePath, 'utf8'));
      if (cassette?.meta?.requestHash !== cassetteHash) {
        throw new Error(
          `Cassette hash mismatch for ${cassettePath}. ` +
          `Expected ${cassetteHash}, found ${cassette?.meta?.requestHash}. ` +
          `Re-run with LIVE_API_TEST=1 to regenerate.`
        );
      }
      const { translatedText, cost, model } = cassette.response ?? {};
      return { translatedText, cost, model };
    }

    if (!liveMode && !fs.existsSync(cassettePath)) {
      throw new Error(
        `Cassette not found for ${options.model} (${cassetteHash}). ` +
        `Run tests with LIVE_API_TEST=1 to record a fresh cassette.`
      );
    }

    if (liveMode && !this.apiKey) {
      throw new Error('LIVE_API_TEST=1 requires OPENROUTER_API_KEY to be set for recording cassettes.');
    }

    // Build OpenRouter API request
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lexiconforge.app',
        'X-Title': 'LexiconForge Golden Tests'
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.text }
        ],
        temperature: options.temperature
      })
    });

    // Parse response
    const raw = await response.text();
    if (!response.ok) {
      let msg = `OpenRouter error ${response.status}`;
      try {
        const j = JSON.parse(raw);
        msg = j?.error?.message || j?.message || msg;
      } catch {}
      throw new Error(msg);
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Failed to parse OpenRouter response');
    }

    // Extract translation
    const choice = parsed?.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenRouter response');
    }

    if (choice?.error) {
      const errorMsg = choice.error.message || 'Unknown error from provider';
      const errorCode = choice.error.code || 'UNKNOWN';
      throw new Error(`OpenRouter provider error (${errorCode}): ${errorMsg}`);
    }

    const translatedText = choice?.message?.content || '';
    if (!translatedText) {
      throw new Error('Empty translation from OpenRouter');
    }

    // Extract cost from usage data
    const usage = parsed?.usage;
    const totalTokens = usage?.total_tokens || 0;
    const modelUsed = parsed?.model || options.model;
    const cost = totalTokens > 0 ? estimateCost(modelUsed, totalTokens) : 0;

    const normalizedResponse: SimpleLLMResponse = {
      translatedText,
      cost,
      model: modelUsed
    };

    if (liveMode) {
      ensureCassetteDir();
      const cassetteContent = {
        meta: {
          requestHash: cassetteHash,
          recordedAt: new Date().toISOString(),
        },
        request: cassettePayload,
        response: {
          ...normalizedResponse,
          usage: usage ?? null,
        }
      };
      fs.writeFileSync(cassettePath, JSON.stringify(cassetteContent, null, 2));
    }

    return normalizedResponse;
  }
}
