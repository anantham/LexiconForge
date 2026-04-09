import prompts from '../config/prompts.json';
import { HistoricalChapter, FeedbackItem } from '../types';

export const buildFanTranslationContext = (fanTranslation: string | null): string => {
  if (!fanTranslation) return '';
  return `
${prompts.fanRefHeader}

${prompts.fanRefBullets}

${prompts.fanRefImportant}

FAN TRANSLATION REFERENCE:
${fanTranslation}

${prompts.fanRefEnd}
`;
};

export const formatHistory = (history: HistoricalChapter[]): string => {
  if (history.length === 0) {
    return prompts.historyNoRecent;
  }
  return history.map((h, index) => {
    // Derive structured-output hints from the previous translated text
    const illuCount = (h.translatedContent.match(/\\[ILLUSTRATION-\\d+\\]/g) || []).length;
    const footMarkerCount = (h.footnotes || []).length;
    const feedbackCount = h.feedback?.length || 0;
    const feedbackStr = h.feedback.length > 0
        ? "Feedback on this chapter:\n" + h.feedback.map((f: FeedbackItem) => {
            const commentStr = f.comment ? ` (User comment: ${f.comment})` : '';
            return `- ${f.type} on: \"${f.selection}\"${commentStr}`;
        }).join('\n')
        : "No feedback was given on this chapter.";
    
    return `${prompts.historyHeaderTemplate.replace('{index}', String(index + 1))}\n\n` +
           `${prompts.historyOriginalHeader}\n` +
           `TITLE: ${h.originalTitle}\n` +
           `CONTENT:\n${h.originalContent}\n\n` +
           `${h.fanTranslationReference ? `FAN TRANSLATION REFERENCE FOR THIS PREVIOUS CHAPTER:\n${h.fanTranslationReference}\n\n` : ''}` +
           `${prompts.historyPreviousHeader}\n` +
           `TITLE: ${h.translatedTitle}\n` +
           `CONTENT:
${h.translatedContent}

` +
           `${(h.footnotes && h.footnotes.length > 0) ? "FOOTNOTES:\n" + h.footnotes.map(f => `${f.marker}: ${f.text}`).join('\n') + "\n\n" : ""}` +
           `${prompts.historyStructuredHeader}
` +
           `${prompts.historyIllustrationMarkersLabel} ${illuCount}\n` +
           `${prompts.historyFootnoteMarkersLabel} ${footMarkerCount}\n` +
           `${prompts.historyFeedbackCountLabel} ${feedbackCount}\n\n` +
           `${prompts.historyUserFeedbackHeader}\n` +
           `${feedbackStr}\n\n` +
           `--- END OF CONTEXT FOR PREVIOUS CHAPTER ${index + 1} ---`;
  }).join('\n\n');
};

export interface AmendmentReviewPromptOptions {
  sourceTitle: string;
  sourceContent: string;
  translatedTitle: string;
  translatedContent: string;
  fanTranslation?: string | null;
}

export const buildAmendmentReviewSystemPrompt = (currentSystemPrompt: string): string => {
  return [
    'You are in prompt-amendment review mode.',
    'Treat the user prompt below as the document under review, not as instructions to retranslate the chapter.',
    'Do not produce a new translation. Only decide whether a surgical prompt amendment or glossary amendment is warranted for future chapters.',
    'Return proposal.kind as either "prompt" or "glossary".',
    'When proposing a glossary change, also return proposal.glossaryEntry with { source, target, note? } and set proposal.glossaryOperation to "add" or "replace".',
    'When proposing a prompt change, leave glossary-specific fields null or omitted.',
    'Return proposal as null when no specific, high-value amendment is justified.',
    '',
    'CURRENT SYSTEM PROMPT UNDER REVIEW:',
    currentSystemPrompt,
  ].join('\n');
};

export const buildAmendmentReviewUserPrompt = ({
  sourceTitle,
  sourceContent,
  translatedTitle,
  translatedContent,
  fanTranslation,
}: AmendmentReviewPromptOptions): string => {
  const sections = [
    'Review the completed chapter translation below and decide whether to propose a surgical amendment to the system prompt or glossary for future chapters.',
    'Focus on durable issues such as recurring terminology guidance, glossary consistency, stable style rules, or translation-policy clarifications.',
    'If the best fix is a glossary update, return kind="glossary" and include a structured glossaryEntry object.',
    'Do not suggest edits that only matter for this one sentence unless they clearly generalize.',
    '',
    'SOURCE TITLE:',
    sourceTitle,
    '',
    'SOURCE CONTENT:',
    sourceContent,
    '',
    'AI TRANSLATED TITLE:',
    translatedTitle,
    '',
    'AI TRANSLATED CONTENT:',
    translatedContent,
  ];

  if (fanTranslation) {
    sections.push(
      '',
      'FAN TRANSLATION REFERENCE FOR AMENDMENT REVIEW ONLY:',
      fanTranslation,
      '',
      'Use the fan translation only as optional inspiration for identifying durable prompt or glossary improvements. Do not rewrite the AI translation from it.'
    );
  }

  return sections.join('\n');
};
