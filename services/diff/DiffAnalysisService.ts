// services/diff/DiffAnalysisService.ts
import prompts from '../../config/prompts.json';
import type { DiffAnalysisRequest, DiffResult, DiffMarker } from './types';

// Simple interface for LLM calls (to avoid complex Translator dependencies)
interface SimpleLLMResponse {
  translatedText: string;
  cost?: number;
  model?: string;
}

interface SimpleLLMProvider {
  translate(options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }): Promise<SimpleLLMResponse>;
}

export class DiffAnalysisService {
  private static readonly ALGO_VERSION = '1.0.0';
  private static readonly DEFAULT_MODEL = 'gpt-4o-mini';
  private static readonly TEMPERATURE = 0; // Deterministic results

  // Allow injection for testing
  private translator?: SimpleLLMProvider;

  /**
   * Analyze semantic differences between AI translation and reference texts
   */
  async analyzeDiff(request: DiffAnalysisRequest): Promise<DiffResult> {
    const { chapterId, aiTranslation, fanTranslation, rawText, previousVersionFeedback } = request;

    // Generate chunks from AI translation
    const chunks = this.chunkAiTranslation(aiTranslation);

    // Build LLM prompt
    const prompt = this.buildPrompt(chunks, fanTranslation, rawText, previousVersionFeedback);

    // Call LLM (if translator is available, otherwise return empty markers)
    let markers: DiffMarker[] = [];
    let costUsd = 0;
    let model = DiffAnalysisService.DEFAULT_MODEL;

    if (this.translator) {
      const response = await this.translator.translate({
        text: prompt,
        systemPrompt: '',
        provider: 'OpenRouter', // Use OpenRouter for gpt-4o-mini access
        model: DiffAnalysisService.DEFAULT_MODEL,
        temperature: DiffAnalysisService.TEMPERATURE
      });

      // Parse response
      const parsedResponse = JSON.parse(response.translatedText);

      // Enrich markers with position and range data
      markers = parsedResponse.markers.map((m: any) => {
        const chunk = chunks.find(c => c.id === m.chunkId);
        if (!chunk) return null;

        return {
          ...m,
          aiRange: { start: chunk.start, end: chunk.end },
          position: chunk.position
        };
      }).filter(Boolean);

      costUsd = response.cost || 0;
      model = response.model || DiffAnalysisService.DEFAULT_MODEL;
    }

    const result: DiffResult = {
      chapterId,
      aiVersionId: Date.now().toString(),
      fanVersionId: fanTranslation ? Date.now().toString() : null,
      rawVersionId: this.hashText(rawText),
      algoVersion: DiffAnalysisService.ALGO_VERSION,
      markers,
      analyzedAt: Date.now(),
      costUsd,
      model
    };

    return result;
  }

  private buildPrompt(
    chunks: Array<{ id: string; text: string }>,
    fanTranslation: string | null,
    rawText: string,
    previousFeedback?: string
  ): string {
    const template = prompts.diffAnalysisPrompt;

    const chunksFormatted = chunks.map(c => `[${c.id}]: ${c.text}`).join('\n\n');
    const fanText = fanTranslation || '(No fan translation available)';
    const feedbackText = previousFeedback || '(No previous feedback)';

    return template
      .replace('{{chunks}}', chunksFormatted)
      .replace('{{fanTranslation}}', fanText)
      .replace('{{rawText}}', rawText)
      .replace('{{previousFeedback}}', feedbackText);
  }

  /**
   * Split AI translation into paragraph chunks with stable IDs
   */
  private chunkAiTranslation(text: string): Array<{ id: string; text: string; start: number; end: number; position: number }> {
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    let currentOffset = 0;

    return paragraphs.map((para, index) => {
      const start = currentOffset;
      const end = start + para.length;
      const hash = this.hashText(para).substring(0, 4);
      const id = `para-${index}-${hash}`;

      currentOffset = end + 2; // Account for \n\n separator

      return { id, text: para, start, end, position: index };
    });
  }

  /**
   * Generate stable 8-char hash of text content
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
