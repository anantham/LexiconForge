import { describe, expect, it } from 'vitest';

import {
  buildImagePlanFromCaption,
  compileIllustrationPrompt,
  ensureIllustrationPlan,
  parseImagePlanJson,
} from '../../services/imagePlanService';

describe('imagePlanService', () => {
  it('builds a seed image plan from a caption', () => {
    const plan = buildImagePlanFromCaption('Silver-haired mage standing in moonlit ruins. Blue fire in her palm.');

    expect(plan.subject).toBe('Silver-haired mage standing in moonlit ruins');
    expect(plan.details).toEqual(['Blue fire in her palm']);
    expect(plan.mustKeep).toEqual([]);
  });

  it('normalizes missing illustration plans into auto plans', () => {
    const prepared = ensureIllustrationPlan({
      placementMarker: '[ILLUSTRATION-1]',
      imagePrompt: 'A lone swordsman beneath a storm',
    });

    expect(prepared.imagePlanMode).toBe('auto');
    expect(prepared.imagePlanSourceCaption).toBe('A lone swordsman beneath a storm');
    expect(prepared.imagePlan?.subject).toBe('A lone swordsman beneath a storm');
  });

  it('parses editable JSON plans and compiles JSON-heavy prompts for OpenRouter/PiAPI image models', () => {
    const imagePlan = parseImagePlanJson(
      JSON.stringify({
        subject: 'Young woman in a dark bedroom',
        characters: ['young woman'],
        scene: 'Nighttime bedroom selfie',
        composition: 'Medium close-up',
        camera: 'Smartphone front camera, slightly high angle',
        lighting: 'Dim screen light and soft shadows',
        style: 'Lo-fi amateur realism',
        mood: 'Melancholic and intimate',
        details: ['Messy black hair', 'pink lingerie'],
        mustKeep: ['hand over mouth', 'abdomen tattoo'],
        avoid: ['studio lighting'],
        negativePrompt: ['watermark', 'perfect skin'],
      }),
      'Young woman in a dark bedroom'
    );

    const compiled = compileIllustrationPrompt(
      {
        placementMarker: '[ILLUSTRATION-1]',
        imagePrompt: 'Young woman in a dark bedroom',
        imagePlan,
        imagePlanMode: 'manual',
        imagePlanSourceCaption: 'Young woman in a dark bedroom',
      },
      { provider: 'OpenRouter', imageModel: 'openrouter/sourceful/riverflow-v2-fast' } as any
    );

    expect(compiled.imagePlanMode).toBe('manual');
    expect(compiled.compiledPrompt).toContain('ImagePlan JSON:');
    expect(compiled.compiledPrompt).toContain('"mustKeep"');
    expect(compiled.compiledPrompt).toContain('Caption: Young woman in a dark bedroom');
  });

  it('compiles hybrid prompts for Gemini/Imagen style models', () => {
    const compiled = compileIllustrationPrompt(
      {
        placementMarker: '[ILLUSTRATION-1]',
        imagePrompt: 'A monk crossing a bridge at sunrise',
      },
      { provider: 'Gemini', imageModel: 'imagen-4.0-generate-preview-06-06' } as any
    );

    expect(compiled.compiledPrompt).toContain('A monk crossing a bridge at sunrise');
    expect(compiled.compiledPrompt).toContain('Structured reference:');
    expect(compiled.compiledPrompt).toContain('"subject"');
  });
});
