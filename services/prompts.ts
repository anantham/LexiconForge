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
