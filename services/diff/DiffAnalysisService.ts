// services/diff/DiffAnalysisService.ts
import type { DiffAnalysisRequest, DiffResult, DiffMarker } from './types';

export class DiffAnalysisService {
  private static readonly ALGO_VERSION = '1.0.0';
  private static readonly DEFAULT_MODEL = 'gpt-4o-mini';

  /**
   * Analyze semantic differences between AI translation and reference texts
   */
  async analyzeDiff(request: DiffAnalysisRequest): Promise<DiffResult> {
    const { chapterId, aiTranslation, fanTranslation, rawText } = request;

    // Generate chunk IDs from AI translation paragraphs
    const chunks = this.chunkAiTranslation(aiTranslation);

    // For now, return empty markers (will implement LLM call next)
    const result: DiffResult = {
      chapterId,
      aiVersionId: Date.now().toString(),
      fanVersionId: fanTranslation ? Date.now().toString() : null,
      rawVersionId: this.hashText(rawText),
      algoVersion: DiffAnalysisService.ALGO_VERSION,
      markers: [], // TODO: Implement LLM-based analysis
      analyzedAt: Date.now(),
      costUsd: 0,
      model: DiffAnalysisService.DEFAULT_MODEL
    };

    return result;
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
