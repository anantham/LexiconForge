// services/diff/DiffAnalysisService.ts
import type { DiffAnalysisRequest, DiffResult, DiffMarker } from './types';
import { DIFF_ALGO_VERSION, DIFF_DEFAULT_MODEL, DIFF_DEFAULT_PROVIDER, DIFF_TEMPERATURE } from './constants';
import { computeDiffHash } from './hash';
import { debugLog, debugWarn } from '../../utils/debug';
import { applyDiffPromptVariables, getDefaultDiffPrompt } from './promptUtils';

export class DiffAnalysisJsonParseError extends Error {
  constructor(message: string, public readonly model?: string) {
    super(message);
    this.name = 'DiffAnalysisJsonParseError';
  }
}

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
  // Allow injection for testing
  private translator?: SimpleLLMProvider;

  /**
   * Provide a gated diagnostic preview of large payloads without flooding the console.
   */
  private logPayloadPreview(
    label: string,
    value: string,
    pipeline: 'diff' = 'diff',
    slice = 2000
  ): void {
    const length = value.length;
    if (length === 0) {
      debugLog(pipeline, 'full', `${label} (empty payload)`);
      return;
    }

    const startPreview = value.slice(0, slice);
    const endPreview = length > slice ? value.slice(-slice) : '';

    debugLog(pipeline, 'full', `${label} length: ${length}`, {
      startPreview,
      endPreview,
    });
  }

  /**
   * Emit chunk coverage diagnostics so we can validate LLM output against the prompt inputs.
   */
  private logCoverageDiagnostics(
    chunks: Array<{ id: string; position: number }>,
    markers: DiffMarker[]
  ): { missingChunkIds: string[] } {
    const chunkIds = new Set(chunks.map((chunk) => chunk.id));
    const markerIds = new Set(markers.map((marker) => marker.chunkId));
    const missingChunkIds = chunks
      .filter((chunk) => !markerIds.has(chunk.id))
      .map((chunk) => chunk.id);
    const orphanMarkerIds = markers
      .filter((marker) => !chunkIds.has(marker.chunkId))
      .map((marker) => marker.chunkId);

    const maxMarkerPosition = markers.reduce(
      (max, marker) => Math.max(max, marker.position ?? -1),
      -1
    );
    const highestChunkPosition = chunks.length ? chunks[chunks.length - 1].position : -1;

    const perColorCounts = markers.reduce<Record<string, number>>((acc, marker) => {
      for (const color of marker.colors || []) {
        acc[color] = (acc[color] || 0) + 1;
      }
      return acc;
    }, {});

    debugLog('diff', 'full', '[DiffAnalysis] Marker coverage', {
      chunkCount: chunks.length,
      markerCount: markers.length,
      perColorCounts,
      missingChunkIdsSample: missingChunkIds.slice(0, 10),
      orphanMarkerIdsSample: orphanMarkerIds.slice(0, 10),
      maxMarkerPosition,
      highestChunkPosition,
    });

    if (missingChunkIds.length > 0) {
      debugWarn(
        'diff',
        'summary',
        '[DiffAnalysis] Some chunks were not referenced by markers',
        {
          totalMissing: missingChunkIds.length,
          sample: missingChunkIds.slice(0, 5),
        }
      );
    }

    if (orphanMarkerIds.length > 0) {
      debugWarn(
        'diff',
        'summary',
        '[DiffAnalysis] Markers reference unknown chunk IDs',
        {
          totalOrphaned: orphanMarkerIds.length,
          sample: orphanMarkerIds.slice(0, 5),
        }
      );
    }

    if (maxMarkerPosition >= chunks.length) {
      debugWarn(
        'diff',
        'summary',
        '[DiffAnalysis] Marker position exceeds available chunk count',
        {
          maxMarkerPosition,
          chunkCount: chunks.length,
        }
      );
    }

    return { missingChunkIds };
  }

  private normalizeReason(raw: unknown): DiffReason | null {
    if (typeof raw !== 'string') return null;
    const normalized = raw.trim().toLowerCase();
    switch (normalized) {
      case 'missing-context':
        return 'missing-context';
      case 'plot-omission':
        return 'plot-omission';
      case 'added-detail':
        return 'added-detail';
      case 'hallucination':
        return 'hallucination';
      case 'fan-divergence':
        return 'fan-divergence';
      case 'sensitivity-filter':
        return 'sensitivity-filter';
      case 'raw-divergence':
        return 'raw-divergence';
      case 'stylistic-choice':
        return 'stylistic-choice';
      case 'no-change':
        return 'no-change';
      default:
        debugWarn('diff', 'summary', '[DiffAnalysis] Unknown diff reason from LLM', { reason: raw });
        return null;
    }
  }

  private reasonToColor(reason: DiffReason): DiffColor {
    switch (reason) {
      case 'missing-context':
      case 'plot-omission':
        return 'red';
      case 'added-detail':
      case 'hallucination':
      case 'raw-divergence':
        return 'orange';
      case 'fan-divergence':
        return 'blue';
      case 'sensitivity-filter':
        return 'purple';
      case 'stylistic-choice':
      case 'no-change':
        return 'grey';
      default:
        return 'grey';
    }
  }

  private fallbackReasonForColor(color: string): DiffReason {
    switch (color.toLowerCase()) {
      case 'red':
        return 'missing-context';
      case 'orange':
      case 'green':
        return 'added-detail';
      case 'blue':
        return 'fan-divergence';
      case 'purple':
        return 'sensitivity-filter';
      case 'grey':
      default:
        return 'no-change';
    }
  }

  private normalizeMarkerForChunk(
    rawMarker: any,
    chunk: { id: string; start: number; end: number; position: number }
  ): DiffMarker | null {
    const rawReasons = Array.isArray(rawMarker?.reasons) ? rawMarker.reasons : [];
    const rawReasonStrings = rawReasons.map((reason: unknown) =>
      typeof reason === 'string' ? reason.trim() : ''
    );
    const normalizedReasons: DiffReason[] = [];

    for (const reason of rawReasons) {
      const normalized = this.normalizeReason(reason);
      if (normalized) normalizedReasons.push(normalized);
    }

    // Fallback to colors if reasons missing
    if (normalizedReasons.length === 0) {
      const rawColors = Array.isArray(rawMarker?.colors) ? rawMarker.colors : [];
      for (const color of rawColors) {
        normalizedReasons.push(this.fallbackReasonForColor(String(color)));
      }
    }

    if (normalizedReasons.length === 0) {
      // No actionable information from the model.
      return null;
    }

    const colors = normalizedReasons.map((reason) => this.reasonToColor(reason));
    const rawExplanations = Array.isArray(rawMarker?.explanations) ? rawMarker.explanations : [];
    const singleExplanation =
      typeof rawMarker?.explanation === 'string' ? rawMarker.explanation.trim() : '';
    const explanations: string[] = normalizedReasons.map((_, index) => {
      const candidates: Array<unknown> = [
        rawExplanations[index],
        rawExplanations.length === 1 ? rawExplanations[0] : undefined,
        singleExplanation,
        rawReasonStrings[index],
      ];

      for (const candidate of candidates) {
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (trimmed.length > 0 && !this.normalizeReason(trimmed)) {
            return trimmed;
          }
        }
      }

      return '';
    });
    const confidence =
      typeof rawMarker?.confidence === 'number'
        ? Math.min(Math.max(rawMarker.confidence, 0), 1)
        : undefined;

    return {
      chunkId: chunk.id,
      colors,
      reasons: normalizedReasons,
      explanations,
      confidence,
      aiRange: { start: chunk.start, end: chunk.end },
      position: chunk.position,
    };
  }

  private applyFallbackMarkers(
    chunks: Array<{ id: string; start: number; end: number; position: number }>,
    markers: DiffMarker[]
  ): DiffMarker[] {
    const map = new Map<string, DiffMarker>();
    for (const marker of markers) {
      map.set(marker.chunkId, marker);
    }

    for (const chunk of chunks) {
      if (!map.has(chunk.id)) {
        map.set(chunk.id, {
          chunkId: chunk.id,
          colors: ['grey'],
          reasons: ['no-change'],
          aiRange: { start: chunk.start, end: chunk.end },
          position: chunk.position,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.position - b.position);
  }

  /**
   * Set the translator instance for making LLM API calls
   */
  setTranslator(translator: SimpleLLMProvider): void {
    this.translator = translator;
    console.log(`✅ [DiffAnalysisService] Translator instance injected`);
  }

  /**
   * Analyze semantic differences between AI translation and reference texts
   */
  async analyzeDiff(request: DiffAnalysisRequest): Promise<DiffResult> {
    const {
      chapterId,
      aiTranslation,
      aiTranslationId,
      aiHash: providedAiHash,
      fanTranslation,
      fanTranslationId,
      fanHash: providedFanHash,
      rawText,
      rawHash: providedRawHash,
      previousVersionFeedback,
      llmModel,
      llmProvider,
      llmTemperature,
    } = request;

    console.log(`🔍 [DiffAnalysis] Starting analysis for chapter: ${chapterId}`);
    console.log(`🔍 [DiffAnalysis] Input lengths:`, {
      aiTranslation: aiTranslation.length,
      fanTranslation: fanTranslation?.length || 0,
      rawText: rawText.length,
      hasFanTranslation: !!fanTranslation,
      hasRawText: !!rawText,
      hasPreviousFeedback: !!previousVersionFeedback
    });

    // Generate chunks from AI translation
    const chunks = this.chunkAiTranslation(aiTranslation);
    console.log(`📝 [DiffAnalysis] Created ${chunks.length} chunks from AI translation`);
    if (chunks.length > 0) {
      console.log(`📝 [DiffAnalysis] First chunk sample:`, {
        id: chunks[0].id,
        textPreview: chunks[0].text.substring(0, 100),
        start: chunks[0].start,
        end: chunks[0].end
      });
    }

    // Build LLM prompt
    const promptTemplate = request.promptOverride ?? getDefaultDiffPrompt();
    const prompt = this.buildPrompt(promptTemplate, chunks, fanTranslation, rawText, previousVersionFeedback);
    console.log(`📤 [DiffAnalysis] Built LLM prompt (length: ${prompt.length} chars)`);
    console.log(`📤 [DiffAnalysis] Prompt preview (first 500 chars):`, prompt.substring(0, 500));
    this.logPayloadPreview('[DiffAnalysis] Prompt preview', prompt);

    // Call LLM (if translator is available, otherwise return empty markers)
    let markers: DiffMarker[] = [];
    let costUsd = 0;
    const providerToUse = llmProvider ?? DIFF_DEFAULT_PROVIDER;
    const modelToUse = llmModel ?? DIFF_DEFAULT_MODEL;
    const temperatureToUse = llmTemperature ?? DIFF_TEMPERATURE;
    let modelUsed = modelToUse;

    if (!this.translator) {
      console.warn(`⚠️ [DiffAnalysis] No translator instance available! Returning empty markers.`);
      console.warn(`⚠️ [DiffAnalysis] This means DiffAnalysisService was instantiated without translator injection.`);
    }

    if (this.translator) {
      console.log(`🤖 [DiffAnalysis] Calling LLM with model: ${modelToUse}, temperature: ${temperatureToUse}`);

      let response: SimpleLLMResponse;
      try {
        response = await this.translator.translate({
          text: prompt,
          systemPrompt: '',
          provider: providerToUse,
          model: modelToUse,
          temperature: temperatureToUse
        });
      } catch (translatorError) {
        console.error(`🚨 [DiffAnalysis] Translator request failed for model ${modelToUse}:`, translatorError);
        throw translatorError;
      }

      console.log(`📥 [DiffAnalysis] LLM response received (length: ${response.translatedText.length} chars)`);
      console.log(`📥 [DiffAnalysis] LLM cost: $${response.cost || 0}`);
      console.log(`📥 [DiffAnalysis] LLM response preview:`, response.translatedText.substring(0, 500));
      this.logPayloadPreview('[DiffAnalysis] Raw LLM response', response.translatedText);

      // Parse response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response.translatedText);
        console.log(`✅ [DiffAnalysis] Successfully parsed JSON response`);
        console.log(`✅ [DiffAnalysis] Parsed response structure:`, {
          hasMarkers: !!parsedResponse.markers,
          markerCount: Array.isArray(parsedResponse.markers) ? parsedResponse.markers.length : 'not array',
          keys: Object.keys(parsedResponse)
        });

        if (Array.isArray(parsedResponse.markers) && parsedResponse.markers.length > 0) {
          console.log(`📊 [DiffAnalysis] First marker sample:`, parsedResponse.markers[0]);
        }
      } catch (parseError) {
        console.error(`🚨 [DiffAnalysis] Failed to parse LLM response as JSON:`, parseError);
        console.error(`🚨 [DiffAnalysis] Raw response:`, response.translatedText);
        throw new DiffAnalysisJsonParseError('Failed to parse diff analysis response as JSON', modelToUse);
      }

      const rawMarkers: any[] = Array.isArray(parsedResponse.markers) ? parsedResponse.markers : [];
      const normalizedMarkers: DiffMarker[] = [];

      for (const marker of rawMarkers) {
        const chunk = chunks.find(c => c.id === marker.chunkId);
        if (!chunk) {
          console.warn(`⚠️ [DiffAnalysis] Marker references unknown chunk: ${marker?.chunkId}`);
          continue;
        }
        const normalised = this.normalizeMarkerForChunk(marker, chunk);
        if (normalised) {
          normalizedMarkers.push(normalised);
        }
      }

      console.log(`✅ [DiffAnalysis] Normalized ${normalizedMarkers.length} markers with position data`);
      const coverage = this.logCoverageDiagnostics(
        chunks.map(({ id, position }) => ({ id, position })),
        normalizedMarkers
      );
      if (coverage.missingChunkIds.length > 0) {
        debugLog('diff', 'summary', '[DiffAnalysis] Applying grey fallback markers for uncovered chunks', {
          missingCount: coverage.missingChunkIds.length,
        });
      }

      markers = this.applyFallbackMarkers(
        chunks.map(({ id, start, end, position }) => ({ id, start, end, position })),
        normalizedMarkers
      );

      costUsd = response.cost || 0;
      modelUsed = response.model || modelToUse;
    }

    const aiHash = providedAiHash || computeDiffHash(aiTranslation);
    const fanHash = providedFanHash || (fanTranslation ? computeDiffHash(fanTranslation) : null);
    const rawHash = providedRawHash || computeDiffHash(rawText);
    if (markers.length === 0) {
      markers = this.applyFallbackMarkers(
        chunks.map(({ id, start, end, position }) => ({ id, start, end, position })),
        []
      );
    }

    const result: DiffResult = {
      chapterId,
      aiVersionId: aiTranslationId || Date.now().toString(),
      fanVersionId: fanTranslationId ?? null,
      rawVersionId: rawHash,
      algoVersion: DIFF_ALGO_VERSION,
      aiHash,
      fanHash,
      rawHash,
      markers,
      analyzedAt: Date.now(),
      costUsd,
      model: modelUsed
    };

    console.log(`✅ [DiffAnalysis] Analysis complete for ${chapterId}:`, {
      markerCount: markers.length,
      costUsd,
      model: modelUsed,
      algoVersion: DIFF_ALGO_VERSION,
      hasTranslator: !!this.translator
    });

    const markersMissingExplanations = markers.filter((marker) => {
      if (!Array.isArray(marker.reasons) || marker.reasons.length === 0) return false;
      return marker.reasons.some((reason, index) => {
        if (reason === 'no-change') return false;
        const explanation = marker.explanations?.[index];
        return typeof explanation !== 'string' || explanation.trim().length === 0;
      });
    });

    if (markersMissingExplanations.length > 0) {
      debugWarn('diff', 'summary', '[DiffAnalysis] Markers missing explanations', {
        count: markersMissingExplanations.length,
        sample: markersMissingExplanations.slice(0, 5).map((marker) => ({
          chunkId: marker.chunkId,
          reasons: marker.reasons,
          explanations: marker.explanations,
        })),
      });
    }

    if (markers.length === 0) {
      console.log(`ℹ️ [DiffAnalysis] Zero markers generated. Possible reasons:`);
      console.log(`   1. No translator instance (check hasTranslator above)`);
      console.log(`   2. LLM found no semantic differences`);
      console.log(`   3. LLM response parsing failed`);
      console.log(`   4. All markers referenced invalid chunks`);
    }

    return result;
  }

  private buildPrompt(
    template: string,
    chunks: Array<{ id: string; text: string }>,
    fanTranslation: string | null,
    rawText: string,
    previousFeedback?: string
  ): string {
    const resolvedTemplate = applyDiffPromptVariables(template);
    const chunksFormatted = chunks.map(c => `[${c.id}]: ${c.text}`).join('\n\n');
    const fanText = fanTranslation || '(No fan translation available)';
    const feedbackText = previousFeedback || '(No previous feedback)';

    return resolvedTemplate
      .replace('{{chunks}}', chunksFormatted)
      .replace('{{fanTranslation}}', fanText)
      .replace('{{rawText}}', rawText)
      .replace('{{previousFeedback}}', feedbackText);
  }

  /**
   * Convert HTML-like chapter text into paragraph chunks.
   * Normalises <br>, <hr>, and <p> tags so each chunk represents a paragraph.
   */
  private chunkAiTranslation(text: string): Array<{ id: string; text: string; start: number; end: number; position: number }> {
    const segments = this.splitIntoParagraphSegments(text);
    const chunks: Array<{ id: string; text: string; start: number; end: number; position: number }> = [];
    let cumulativeLength = 0;

    for (const segment of segments) {
      const normalised = this.normaliseChunkText(segment.raw);
      if (!normalised.trim()) {
        cumulativeLength += normalised.length;
        continue;
      }

      const position = chunks.length;
      const start = cumulativeLength;
      const end = start + normalised.length;
      const id = `para-${position}-${computeDiffHash(normalised).substring(0, 4)}`;

      chunks.push({
        id,
        text: normalised,
        start,
        end,
        position,
      });

      // Add two characters to mimic the removed double break.
      cumulativeLength = end + 2;
    }

    // Fallback: if no chunks identified, treat the entire text as one chunk.
    if (chunks.length === 0) {
      const trimmed = this.normaliseChunkText(text);
      const fallback = trimmed || text;
      return [{
        id: `para-0-${computeDiffHash(fallback).substring(0, 4)}`,
        text: fallback,
        start: 0,
        end: fallback.length,
        position: 0,
      }];
    }

    return chunks;
  }

  private splitIntoParagraphSegments(text: string): Array<{ raw: string; start: number; end: number }> {
    const segments: Array<{ raw: string; start: number; end: number }> = [];
    const boundaryRegex = /(?:<br\s*\/?>\s*){2,}|<hr\s*\/?>|<\/p>\s*<p[^>]*>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boundaryRegex.exec(text)) !== null) {
      const rawSegment = text.slice(lastIndex, match.index);
      segments.push({ raw: rawSegment, start: lastIndex, end: match.index });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({ raw: text.slice(lastIndex), start: lastIndex, end: text.length });
    }

    return segments;
  }

  private normaliseChunkText(html: string): string {
    let output = html;

    // Replace <br> sequences with line breaks.
    output = output.replace(/(<br\s*\/?>\s*){2,}/gi, '\n\n');
    output = output.replace(/<br\s*\/?>/gi, '\n');

    // Replace horizontal rules with paragraph break.
    output = output.replace(/<hr\s*\/?>/gi, '\n\n');

    // Handle paragraph tags.
    output = output.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    output = output.replace(/<\/?p[^>]*>/gi, '');

    // Strip remaining HTML tags.
    output = output.replace(/<\/?[^>]+>/g, '');

    // Decode minimal HTML entities.
    output = output.replace(/&nbsp;/gi, ' ');

    // Normalise whitespace.
    output = output.replace(/\r\n/g, '\n');
    output = output.replace(/\n{3,}/g, '\n\n');
    output = output.replace(/[ \t]+\n/g, '\n');

    return output;
  }
}
