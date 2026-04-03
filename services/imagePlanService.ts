import type { AppSettings, ImagePlan, ImagePlanMode, SuggestedIllustration } from '../types';

const cleanString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const cleanStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanString(entry))
    .filter((entry) => entry.length > 0);
};

const collectSentenceFragments = (caption: string): string[] =>
  caption
    .split(/[.;]/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);

export const buildImagePlanFromCaption = (caption: string): ImagePlan => {
  const fragments = collectSentenceFragments(caption);
  const [subject = caption.trim(), ...details] = fragments;

  return {
    subject: subject || 'Scene illustration',
    characters: [],
    scene: '',
    composition: '',
    camera: '',
    lighting: '',
    style: '',
    mood: '',
    details,
    mustKeep: [],
    avoid: [],
    negativePrompt: [],
  };
};

export const normalizeImagePlan = (
  value: unknown,
  fallbackCaption = ''
): ImagePlan => {
  const base = buildImagePlanFromCaption(fallbackCaption);
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    subject: cleanString(input.subject) || base.subject,
    characters: cleanStringArray(input.characters),
    scene: cleanString(input.scene),
    composition: cleanString(input.composition),
    camera: cleanString(input.camera),
    lighting: cleanString(input.lighting),
    style: cleanString(input.style),
    mood: cleanString(input.mood),
    details: cleanStringArray(input.details),
    mustKeep: cleanStringArray(input.mustKeep),
    avoid: cleanStringArray(input.avoid),
    negativePrompt: cleanStringArray(input.negativePrompt),
  };
};

export const serializeImagePlan = (plan: ImagePlan | null | undefined): string =>
  JSON.stringify(normalizeImagePlan(plan || {}, ''), null, 2);

export const parseImagePlanJson = (
  jsonText: string,
  fallbackCaption = ''
): ImagePlan => normalizeImagePlan(JSON.parse(jsonText), fallbackCaption);

export const ensureIllustrationPlan = (
  illustration: SuggestedIllustration
): SuggestedIllustration => {
  const mode: ImagePlanMode = illustration.imagePlanMode === 'manual' ? 'manual' : 'auto';
  const plan = normalizeImagePlan(illustration.imagePlan, illustration.imagePrompt);

  return {
    ...illustration,
    imagePlan: plan,
    imagePlanMode: mode,
    imagePlanSourceCaption:
      mode === 'manual'
        ? illustration.imagePlanSourceCaption ?? illustration.imagePrompt
        : illustration.imagePrompt,
  };
};

const joinListLine = (label: string, values: string[]): string | null =>
  values.length > 0 ? `${label}: ${values.join(', ')}` : null;

const buildPlanSummaryLines = (plan: ImagePlan): string[] => [
  plan.subject ? `Subject: ${plan.subject}` : '',
  plan.characters.length > 0 ? `Characters: ${plan.characters.join(', ')}` : '',
  plan.scene ? `Scene: ${plan.scene}` : '',
  plan.composition ? `Composition: ${plan.composition}` : '',
  plan.camera ? `Camera: ${plan.camera}` : '',
  plan.lighting ? `Lighting: ${plan.lighting}` : '',
  plan.style ? `Style: ${plan.style}` : '',
  plan.mood ? `Mood: ${plan.mood}` : '',
  joinListLine('Details', plan.details),
  joinListLine('Must keep', plan.mustKeep),
  joinListLine('Avoid', plan.avoid),
  joinListLine('Negative prompt hints', plan.negativePrompt),
].filter((line): line is string => Boolean(line));

const buildImageModelFamily = (imageModel: string): 'json-heavy' | 'hybrid' => {
  if (imageModel.startsWith('openrouter/') || imageModel.startsWith('Qubico/')) {
    return 'json-heavy';
  }
  return 'hybrid';
};

export const compileIllustrationPrompt = (
  illustration: SuggestedIllustration,
  settings: Pick<AppSettings, 'imageModel' | 'provider'>
): {
  compiledPrompt: string;
  imagePlan: ImagePlan;
  imagePlanMode: ImagePlanMode;
  imagePlanSourceCaption: string | null;
} => {
  const prepared = ensureIllustrationPlan(illustration);
  const plan = prepared.imagePlan!;
  const summaryLines = buildPlanSummaryLines(plan);
  const planJson = JSON.stringify(plan, null, 2);
  const family = buildImageModelFamily(settings.imageModel || '');

  const compiledPrompt = family === 'json-heavy'
    ? [
        'Generate a single image from this caption and structured plan.',
        `Caption: ${prepared.imagePrompt}`,
        'Treat the JSON as the primary specification. Respect mustKeep and avoid strictly.',
        'ImagePlan JSON:',
        planJson,
      ].join('\n\n')
    : [
        prepared.imagePrompt,
        summaryLines.length > 0 ? summaryLines.join('\n') : '',
        'Structured reference:',
        planJson,
      ].filter(Boolean).join('\n\n');

  return {
    compiledPrompt,
    imagePlan: plan,
    imagePlanMode: prepared.imagePlanMode || 'auto',
    imagePlanSourceCaption: prepared.imagePlanSourceCaption ?? prepared.imagePrompt,
  };
};
