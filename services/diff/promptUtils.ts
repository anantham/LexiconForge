import basePrompts from '../../config/prompts.json';
import colorExamplesRaw from '../../Features/Diff/colorExamples.md?raw';

export const COLOR_EXAMPLES = colorExamplesRaw.trim();

export const diffPromptTemplate = basePrompts.diffAnalysisPrompt;

export const applyDiffPromptVariables = (template: string): string => {
  return template.replace('{{colorExamples}}', COLOR_EXAMPLES);
};

export const getDefaultDiffPrompt = (): string => applyDiffPromptVariables(diffPromptTemplate);
