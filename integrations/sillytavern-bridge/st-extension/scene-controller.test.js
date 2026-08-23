/**
 * Test intent:
 * - Verify the public controller submits once and attaches provenance on success.
 * - Keep broker failures non-blocking and visible.
 * - Defer attachment safely when the user changes chat while a job runs.
 */
import { describe, expect, it, vi } from 'vitest';

import { createSceneController } from './scene-controller.js';

const makeContext = (chatId = 'LF-FMoC-Ch750-test') => ({
    groupId: '1234567890123',
    chatId,
    groups: [{ id: '1234567890123', name: 'FMoC Ch750 — Test' }],
    chat: [
        { is_user: true, is_system: false, mes: 'What do you see?' },
        { is_user: false, is_system: false, mes: 'A fortress burns beneath the stars.' },
    ],
});

describe('createSceneController', () => {
    it('composes, submits, and attaches exactly once for duplicate group events', async () => {
        const context = makeContext();
        const broker = { run: vi.fn().mockResolvedValue({
            jobId: 'job-1', promptId: 'prompt-1', timingMs: 2400,
            imageUrl: 'https://broker.example/image.png',
        }) };
        const attachImage = vi.fn().mockResolvedValue(undefined);
        const controller = createSceneController({
            getContext: () => context,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt: vi.fn().mockResolvedValue('fortress, night sky'),
            createBroker: () => broker,
            attachImage,
            notify: vi.fn(),
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        await controller.handle('group');
        await controller.handle('group');

        expect(broker.run).toHaveBeenCalledTimes(1);
        expect(attachImage).toHaveBeenCalledWith(expect.objectContaining({
            context,
            messageIndex: 1,
            workflowName: 'gen_anime',
            result: expect.objectContaining({ jobId: 'job-1' }),
        }));
    });

    it('reports broker failure and leaves the message unchanged', async () => {
        const context = makeContext();
        const original = structuredClone(context.chat);
        const notify = vi.fn();
        const controller = createSceneController({
            getContext: () => context,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt: vi.fn().mockResolvedValue('scene prompt'),
            createBroker: () => ({ run: vi.fn().mockRejectedValue(Object.assign(new Error('offline'), { code: 'BROKER_OFFLINE' })) }),
            attachImage: vi.fn(),
            notify,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        await controller.handle('group');

        expect(context.chat).toEqual(original);
        expect(notify).toHaveBeenCalledWith('failed', expect.objectContaining({ code: 'BROKER_OFFLINE' }));
    });

    it('defers a completed artifact after chat navigation and attaches on return', async () => {
        const portal = makeContext();
        let current = portal;
        let resolveJob;
        const brokerJob = new Promise((resolve) => { resolveJob = resolve; });
        const attachImage = vi.fn().mockResolvedValue(undefined);
        const controller = createSceneController({
            getContext: () => current,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt: vi.fn().mockResolvedValue('scene prompt'),
            createBroker: () => ({ run: () => brokerJob }),
            attachImage,
            notify: vi.fn(),
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const handling = controller.handle('group');
        await Promise.resolve();
        current = makeContext('another-chat');
        resolveJob({ jobId: 'job-2', imageUrl: 'https://broker.example/two.png' });
        await handling;

        expect(attachImage).not.toHaveBeenCalled();
        current = portal;
        await controller.flushPending();
        expect(attachImage).toHaveBeenCalledTimes(1);
    });
});
