/**
 * Utility functions for prompt manipulation
 */

/**
 * Strips the "Part A" amendment protocol section from a system prompt.
 * The translation call always strips Part A, unconditionally — amendment
 * proposals are generated in a separate pass, not by this prompt.
 *
 * Part A starts with "Part A:". When a "Part B:" header follows, only the
 * span up to it is removed; when there is no "Part B:", everything from
 * "Part A:" to the end of the string is removed.
 */
export function stripAmendmentProtocol(systemPrompt: string): string {
  // Match from "Part A:" until "Part B:" (exclusive)
  const partAPattern = /Part A:.*?(?=Part B:)/s;

  if (partAPattern.test(systemPrompt)) {
    return systemPrompt.replace(partAPattern, '').trim();
  }

  // No "Part B:" anchor for the lookahead — without this fallback, a prompt
  // containing Part A but no Part B would keep the whole amendment protocol.
  const partAIndex = systemPrompt.indexOf('Part A:');
  if (partAIndex !== -1) {
    return systemPrompt.slice(0, partAIndex).trim();
  }

  return systemPrompt.trim();
}

/**
 * Gets the translation instructions to use for chapter translation.
 * Translation and amendment review now run as separate passes, so the
 * translation call should always exclude the Part A amendment protocol.
 */
export function getTranslationSystemPrompt(systemPrompt: string): string {
  return stripAmendmentProtocol(systemPrompt);
}
