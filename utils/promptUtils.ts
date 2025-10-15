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
 * Gets the system prompt to use for translation, conditionally
 * removing the amendment protocol based on settings.
 */
export function getEffectiveSystemPrompt(
  systemPrompt: string,
  enableAmendments: boolean = false
): string {
  if (!enableAmendments) {
    return stripAmendmentProtocol(systemPrompt);
  }
  return systemPrompt;
}
