import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAppSettings } from '../utils/test-data';

const mocks = vi.hoisted(() => ({ recordMetric: vi.fn() }));
vi.mock('../../services/apiMetricsService', () => ({ apiMetricsService: { recordMetric: mocks.recordMetric } }));
vi.mock('../../services/openrouterImageModelAdapter', () => ({
  getVerifiedOpenRouterImageModel: vi.fn(async () => ({ requestModalities: ['image'], priceEstimate: 0.01 })),
  buildOpenRouterImageRequestConfig: vi.fn(() => undefined),
}));
vi.mock('../../utils/debug', () => ({ debugPipelineEnabled: () => false, debugLog: vi.fn(), debugWarn: vi.fn() }));

import { generateImage } from '../../services/imageService';

const jsonResponse = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
const dataUrl = 'data:image/png;base64,QUFB';
const image = { image_url: { url: dataUrl } };

describe('image provider response contracts', () => {
  beforeEach(() => {
    mocks.recordMetric.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    { images: [image] },
    { content: [{ type: 'text', text: 'image follows' }, { type: 'image_url', ...image }] },
    { content: { type: 'image', ...image } },
    { content: dataUrl },
  ])('accepts supported OpenRouter image layout: %j', async message => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message }] })));
    const result = await generateImage('Synthetic tower', createMockAppSettings({
      imageModel: 'openrouter/test/image', apiKeyOpenRouter: 'test-key',
    }));
    expect(result.imageData).toBe(dataUrl);
  });

  it.each([null, { choices: [null] }, { choices: [{ message: { images: [42] } }] }])(
    'rejects malformed OpenRouter images without accepting an untyped value: %j', async payload => {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(payload)));
      await expect(generateImage('Synthetic tower', createMockAppSettings({
        imageModel: 'openrouter/test/image', apiKeyOpenRouter: 'test-key',
      }))).rejects.toThrow(/missing image data|unexpected image format/);
      expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    },
  );

  it.each([
    { output: { images: [{ b64_json: 'QUFB' }] } },
    { data: { output: [{ base64: 'QUFB' }] } },
    { data: { output: { image_base64: 'QUFB' } } },
    { output: { base64: 'QUFB' } },
  ])('accepts supported PiAPI payload layout: %j', async payload => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { task: { task_id: 'task-1' } } }))
      .mockResolvedValueOnce(jsonResponse({ status: 'completed', ...payload })));
    const result = await generateImage('Synthetic tower', createMockAppSettings({
      imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key',
    }));
    expect(result.imageData).toBe(dataUrl);
  });

  it('rejects a numeric image field instead of producing a corrupt data URL', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'task-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'completed', output: { images: [{ b64_json: 42 }] } })));
    await expect(generateImage('Synthetic tower', createMockAppSettings({
      imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key',
    }))).rejects.toThrow('completed but no image payload');
  });

  it.each([null, undefined, 'connection lost'])('handles arbitrary fetch rejection: %s', async rejection => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(rejection));
    await expect(generateImage('Synthetic tower', createMockAppSettings({
      imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key',
    }))).rejects.toThrow('Image generation failed: Unknown error occurred');
    expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it.each([[1024, '1K'], [2048, '2K']] as const)(
    'sends Imagen4 %i resolution through the real SDK as %s', async (size, expectedSize) => {
      const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({
        predictions: [{ bytesBase64Encoded: 'QUFB', mimeType: 'image/png' }],
      }));
      vi.stubGlobal('fetch', fetchMock);
      const result = await generateImage('Synthetic tower', createMockAppSettings({
        imageModel: 'imagen-4.0-generate-001', apiKeyGemini: 'test-key', imageWidth: size, imageHeight: size,
      }));
      expect(result.imageData).toBe(dataUrl);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body: unknown = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body).toMatchObject({ parameters: { sampleImageSize: expectedSize, aspectRatio: '1:1', sampleCount: 1 } });
    },
  );
});
