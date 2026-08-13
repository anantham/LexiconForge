import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openAiCreateMock, capabilityMetadataMock } = vi.hoisted(() => ({
  openAiCreateMock: vi.fn(),
  capabilityMetadataMock: vi.fn(() => Promise.reject(
    new Error('ordinary planning must not await capability metadata')
  )),
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
  supportsStructuredOutputs: capabilityMetadataMock,
}));

const geminiPlannerMocks = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: (...args: any[]) => geminiPlannerMocks.generateContent(...args) };
    constructor(_opts: any) {}
  },
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY: 'ARRAY',
  },
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
    expect(requestBody.temperature).toBe(0.4);
    expect(requestBody.response_format?.type).toBe('json_schema');
    expect(capabilityMetadataMock).not.toHaveBeenCalled();
  });

  it('uses json_object locally for the known non-schema DeepSeek transport', async () => {
    openAiCreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            imagePrompt: 'A quiet mountain path.',
            imagePlan: {
              subject: 'A quiet mountain path.',
              characters: [],
              scene: 'Mountain path at dawn.',
              composition: 'Wide shot.',
              camera: 'Eye level.',
              lighting: 'Soft dawn light.',
              style: 'Painterly.',
              mood: 'Still.',
              details: ['mist'],
              mustKeep: ['path'],
              avoid: ['city'],
              negativePrompt: ['watermark'],
            },
          }),
        },
      }],
    });

    await generateImagePlanFromCaption(
      'A quiet mountain path.',
      {
        ...mockSettings,
        provider: 'DeepSeek',
        model: 'deepseek-chat',
        apiKeyDeepSeek: 'test-deepseek-key',
      } as any
    );

    expect(openAiCreateMock.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
    expect(openAiCreateMock.mock.calls[0][0].messages[0].content).toContain('matching this schema');
    expect(capabilityMetadataMock).not.toHaveBeenCalled();
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

  it('uses the GPT-5 completion-token field for both OpenAI-compatible attempts', async () => {
    const payload = {
      imagePrompt: 'Lanterns over a quiet river.',
      imagePlan: {
        subject: 'Lanterns over a quiet river.',
        characters: [],
        scene: 'River at night.',
        composition: 'Wide shot.',
        camera: 'Eye level.',
        lighting: 'Warm lantern light.',
        style: 'Painterly fantasy.',
        mood: 'Quiet.',
        details: ['reflections'],
        mustKeep: ['lanterns'],
        avoid: ['daylight'],
        negativePrompt: ['watermark'],
      },
    };
    openAiCreateMock
      .mockRejectedValueOnce(new Error('schema rejected'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      });

    const result = await generateImagePlanFromCaption(
      payload.imagePrompt,
      { ...mockSettings, model: 'gpt-5-mini' } as any
    );

    expect(result.source).toBe('model');
    expect(openAiCreateMock).toHaveBeenCalledTimes(2);
    for (const [request] of openAiCreateMock.mock.calls) {
      expect(request.max_completion_tokens).toBe(2048);
      expect(request).not.toHaveProperty('max_tokens');
      expect(request).not.toHaveProperty('temperature');
    }
    expect(openAiCreateMock.mock.calls[1][0].messages[0].content).toContain('matching this schema');
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

  it('falls back to a caption-derived plan when selection-based planning fails', async () => {
    openAiCreateMock.mockRejectedValue(new Error('selection planner unavailable'));

    const result = await generateIllustrationFromSelection(
      'The emperor nodded slowly',
      '<p>The emperor nodded slowly, his eyes fixed on the young knight before him.</p>',
      mockSettings as any
    );

    expect(result.source).toBe('fallback');
    expect(result.warning).toContain('selection planner unavailable');
    expect(result.imagePrompt).toBe('The emperor nodded slowly');
    expect(result.imagePlan.subject).toContain('The emperor nodded slowly');
  });
});

describe('imagePlanPlanner — Gemini request shape (integrity item 7)', () => {
  // The @google/genai SDK wants { model, contents, config: {...} }. The planner used to pass
  // systemInstruction + generationConfig at the TOP level behind an (ai as any) cast — the SDK
  // silently ignored both, so the planner ran with no system prompt, default temperature, and
  // no schema. These tests pin the CORRECT shape.
  const geminiSettings = {
    ...mockSettings,
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    apiKeyGemini: 'test-gemini-key',
  };

  const validPlannerPayload = JSON.stringify({
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
  });

  beforeEach(() => {
    geminiPlannerMocks.generateContent.mockReset();
  });

  it('sends systemInstruction, schema and generation params inside config — not top-level', async () => {
    geminiPlannerMocks.generateContent.mockResolvedValue({ text: validPlannerPayload });

    const result = await generateImagePlanFromCaption(
      'Silver-haired swordswoman alone in a ruined shrine',
      geminiSettings as any
    );

    expect(result.source).toBe('model');
    expect(geminiPlannerMocks.generateContent).toHaveBeenCalledTimes(1);

    const sent = geminiPlannerMocks.generateContent.mock.calls[0][0];
    // The shape the SDK actually reads:
    expect(sent.config).toBeDefined();
    expect(typeof sent.config.systemInstruction).toBe('string');
    expect(sent.config.systemInstruction.length).toBeGreaterThan(0);
    expect(sent.config.responseMimeType).toBe('application/json');
    expect(sent.config.responseSchema).toBeDefined();
    expect(sent.config.temperature).toBe(0.4);
    expect(sent.config.maxOutputTokens).toBeGreaterThan(0);
    // The shapes the SDK IGNORES (the old, inert placement) must be gone:
    expect(sent.systemInstruction).toBeUndefined();
    expect(sent.generationConfig).toBeUndefined();
  });

  it('the schema-less retry keeps config (system prompt + JSON mime) and drops only the schema', async () => {
    geminiPlannerMocks.generateContent
      .mockRejectedValueOnce(new Error('responseSchema rejected'))
      .mockResolvedValueOnce({ text: validPlannerPayload });

    const result = await generateImagePlanFromCaption(
      'Silver-haired swordswoman alone in a ruined shrine',
      geminiSettings as any
    );

    expect(result.source).toBe('model');
    expect(geminiPlannerMocks.generateContent).toHaveBeenCalledTimes(2);

    const retry = geminiPlannerMocks.generateContent.mock.calls[1][0];
    expect(retry.config).toBeDefined();
    expect(retry.config.responseSchema).toBeUndefined();
    expect(typeof retry.config.systemInstruction).toBe('string');
    expect(retry.config.responseMimeType).toBe('application/json');
    expect(retry.generationConfig).toBeUndefined();
  });
});
