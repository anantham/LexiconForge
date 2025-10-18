import { describe, it, expect } from 'vitest';
import { buildImageCaption } from '../../../store/slices/exportSlice';

const baseMetadata = {
  version: 2,
  prompt: 'Hero stands atop the battlements',
  negativePrompt: 'blurry, low quality',
  guidanceScale: 6.5,
  loraModel: 'medieval-style',
  loraStrength: 0.85,
  steeringImage: 'castle-dawn.png',
  provider: 'Imagen',
  model: 'imagen-3.0',
  generatedAt: '2025-10-15T10:00:00.000Z'
} as const;

describe('buildImageCaption', () => {
  it('falls back to prompt when metadata missing', () => {
    const caption = buildImageCaption(1, undefined, 'Fallback prompt');
    expect(caption).toBe('Version 1: Fallback prompt');
  });

  it('formats caption with metadata details', () => {
    const caption = buildImageCaption(2, { ...baseMetadata }, 'Ignored');
    expect(caption).toContain('Version 2: Hero stands atop the battlements');
    expect(caption).toContain('Negative: blurry, low quality');
    expect(caption).toContain('Guidance 6.5');
    expect(caption).toContain('LoRA medieval-style (0.85)');
    expect(caption).toContain('Steering castle-dawn.png');
    expect(caption).toContain('Model Imagen imagen-3.0');
    expect(caption).toContain('Generated');
  });

  it('omits optional fields when absent', () => {
    const caption = buildImageCaption(3, {
      version: 3,
      prompt: 'Defender holds the line',
      generatedAt: '2025-10-15T11:30:00.000Z'
    }, 'Ignored');

    expect(caption.startsWith('Version 3: Defender holds the line')).toBe(true);
    expect(caption).not.toContain('Negative');
    expect(caption).not.toContain('Guidance');
    expect(caption).not.toContain('LoRA');
    expect(caption).not.toContain('Steering');
  });
});
