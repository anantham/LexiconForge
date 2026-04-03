import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openAiCreateMock, supportsStructuredOutputsMock } = vi.hoisted(() => ({
  openAiCreateMock: vi.fn(),
  supportsStructuredOutputsMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: openAiCreateMock,
      },
    };
  },
}));

vi.mock('../../services/capabilityService', () => ({
  supportsStructuredOutputs: supportsStructuredOutputsMock,
}));

import {
  generateIllustrationFromSelection,
  generateImagePlanFromCaption,
} from '../../services/imagePlanPlanner';

const mockSettings = {
  contextDepth: 0,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.4,
  systemPrompt: '',
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  imageModel: 'openrouter/google/gemini-2.5-flash-image',
  temperature: 0.7,
  apiKeyOpenAI: 'test-openai-key',
} as const;

describe('imagePlanPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supportsStructuredOutputsMock.mockResolvedValue(true);
  });

  it('uses the few-shot caption planner prompt and parses structured JSON', async () => {
    openAiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              imagePrompt: 'Silver-haired swordswoman alone in a ruined shrine.',
              imagePlan: {
                subject: 'Silver-haired swordswoman alone in a ruined shrine.',
                characters: ['silver-haired swordswoman'],
                scene: 'Ruined shrine at night.',
                composition: 'Wide hero shot.',
                camera: 'Low angle.',
                lighting: 'Cold moonlight.',
                style: 'Dark fantasy illustration.',
                mood: 'Lonely and triumphant.',
                details: ['broken steps'],
                mustKeep: ['silver hair', 'moonlight'],
                avoid: ['daylight'],
                negativePrompt: ['watermark'],
              },
            }),
          },
        },
      ],
    });

    const result = await generateImagePlanFromCaption(
      'Silver-haired swordswoman alone in a ruined shrine',
      mockSettings as any,
      { context: '<p>dark fantasy, lonely victory</p>' }
    );

    expect(result.source).toBe('model');
    expect(result.imagePlan.subject).toContain('Silver-haired swordswoman');

    const requestBody = openAiCreateMock.mock.calls[0][0];
    expect(requestBody.messages[1].content).toContain('Example 1');
    expect(requestBody.messages[1].content).toContain('Caption: "Silver-haired swordswoman alone in a ruined shrine"');
    expect(requestBody.messages[1].content).toContain('Context: "dark fantasy, lonely victory"');
  });

  it('falls back to a caption-derived plan when planner calls fail', async () => {
    openAiCreateMock.mockRejectedValue(new Error('planner unavailable'));

    const result = await generateImagePlanFromCaption(
      'Grainy dorm-room selfie at 2 a.m.',
      mockSettings as any,
      { context: '<p>messy room and insomnia</p>' }
    );

    expect(result.source).toBe('fallback');
    expect(result.warning).toContain('planner unavailable');
    expect(result.imagePrompt).toBe('Grainy dorm-room selfie at 2 a.m.');
    expect(result.imagePlan.subject).toContain('Grainy dorm-room selfie');
  });

  it('builds structured prompts for selection-based illustration planning', async () => {
    openAiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              imagePrompt: 'The emperor nods slowly toward the young knight.',
              imagePlan: {
                subject: 'The emperor nodding toward the young knight.',
                characters: ['emperor', 'young knight'],
                scene: 'Audience hall.',
                composition: 'Medium two-shot.',
                camera: 'Eye-level cinematic framing.',
                lighting: 'Royal indoor light.',
                style: 'Historical fantasy.',
                mood: 'Measured approval.',
                details: ['formal robes'],
                mustKeep: ['emperor', 'young knight'],
                avoid: ['modern clothing'],
                negativePrompt: ['watermark'],
              },
            }),
          },
        },
      ],
    });

    const result = await generateIllustrationFromSelection(
      'The emperor nodded slowly',
      '<p>The emperor nodded slowly, his eyes fixed on the young knight before him.</p>',
      mockSettings as any
    );

    expect(result.imagePrompt).toContain('emperor');

    const requestBody = openAiCreateMock.mock.calls[0][0];
    expect(requestBody.messages[1].content).toContain('User\'s selected phrase');
    expect(requestBody.messages[1].content).toContain('The emperor nodded slowly');
  });
});
