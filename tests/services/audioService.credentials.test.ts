import { describe, expect, it } from 'vitest';
import { AudioService } from '../../services/audio/AudioService';
import { createMockAppSettings } from '../utils/test-data';

describe('AudioService credential lifecycle', () => {
  it('forgets provider instances when the PiAPI key is removed from Settings', () => {
    const service = new AudioService();

    service.initialize(createMockAppSettings({ apiKeyPiAPI: 'user-piapi-key' }));
    expect(service.isAvailable()).toBe(true);

    service.initialize(createMockAppSettings({ apiKeyPiAPI: undefined }));
    expect(service.isAvailable()).toBe(false);
  });
});
