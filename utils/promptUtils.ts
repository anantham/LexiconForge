/**
 * Utility functions for prompt manipulation
 */

/**
 * Strips the "Part A" amendment protocol section from a system prompt
 * when amendments are disabled in settings.
 *
 * Part A starts with "Part A: Meta-Prompt" and ends before "Part B:"
 */
export function stripAmendmentProtocol(systemPrompt: string): string {
  // Match from "Part A: Meta-Prompt" until "Part B:" (exclusive)
  const partAPattern = /Part A:.*?(?=Part B:)/s;

  return systemPrompt.replace(partAPattern, '').trim();
}

/**
 * Gets the translation instructions to use for chapter translation.
 * Translation and amendment review now run as separate passes, so the
 * translation call should always exclude the Part A amendment protocol.
 */
export function getTranslationSystemPrompt(systemPrompt: string): string {
  return stripAmendmentProtocol(systemPrompt);
}
