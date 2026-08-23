/**
 * Test intent:
 * - Prove scene text is passed as callback data, never interpolated into STscript.
 * - Preserve the native source/model snapshot as attachment provenance.
 * - Fail descriptively when the native Image Generation extension is unavailable or unconfigured.
 */
import { describe, expect, it, vi } from 'vitest';

import { createSillyTavernImageClient } from './sillytavern-image-client.js';

describe('createSillyTavernImageClient', () => {
    it('calls the registered imagine callback directly with inert prompt text', async () => {
        const callback = vi.fn().mockResolvedValue('/user/images/scene.png');
        const client = createSillyTavernImageClient({
            getImagineCommand: () => ({ callback }),
            getRoute: () => ({ source: 'openrouter', model: 'black-forest-labs/flux.2-pro' }),
            now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(3400),
        });
        const prompt = 'castle | /delete {{user}} "quoted"';

        const result = await client.run({ prompt, negativePrompt: 'watermark | /abort' });

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith({
            quiet: 'true',
            gallery: 'false',
            negative: 'watermark | /abort',
        }, prompt);
        expect(result).toEqual({
            backend: 'sillytavern',
            provider: 'openrouter',
            model: 'black-forest-labs/flux.2-pro',
            jobId: null,
            promptId: null,
            timingMs: 2400,
            imageUrl: '/user/images/scene.png',
        });
    });

    it('rejects unavailable, unconfigured, empty, and unsafe native results', async () => {
        const makeClient = (command, route = { source: 'openrouter', model: 'image-model' }) => (
            createSillyTavernImageClient({
                getImagineCommand: () => command,
                getRoute: () => route,
            })
        );

        await expect(makeClient(null).run({ prompt: 'scene' }))
            .rejects.toMatchObject({ code: 'SILLYTAVERN_IMAGE_EXTENSION_UNAVAILABLE' });
        await expect(makeClient({ callback: vi.fn() }, { source: '', model: '' }).run({ prompt: 'scene' }))
            .rejects.toMatchObject({ code: 'SILLYTAVERN_IMAGE_NOT_CONFIGURED' });
        await expect(makeClient({ callback: vi.fn().mockResolvedValue('') }).run({ prompt: 'scene' }))
            .rejects.toMatchObject({ code: 'SILLYTAVERN_IMAGE_MISSING' });
        await expect(makeClient({ callback: vi.fn().mockResolvedValue('javascript:alert(1)') }).run({ prompt: 'scene' }))
            .rejects.toMatchObject({ code: 'SILLYTAVERN_IMAGE_BAD_RESPONSE' });
    });
});
