/**
 * Test intent:
 * - Verify the public controller submits once and attaches provenance on success.
 * - Keep broker failures non-blocking and visible.
 * - Defer attachment safely when the user changes chat while a job runs.
 * - Suppress submission after any navigation during prompt composition.
 */
import { describe, expect, it, vi } from 'vitest';

import { createSceneController } from './scene-controller.js';
import { createBrokerClient } from './broker-client.js';

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
    it('rejects an unconfigured broker before composing a prompt', async () => {
        const composePrompt = vi.fn();
        const notify = vi.fn();
        const controller = createSceneController({
            getContext: () => makeContext(),
            getSettings: () => ({ enabled: true, portalOnly: true, brokerUrl: '' }),
            composePrompt,
            createImageClient: settings => createBrokerClient({ baseUrl: settings.brokerUrl }),
            attachImage: vi.fn(),
            notify,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });
        await controller.handle('group');
        expect(composePrompt).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('failed', expect.objectContaining({ code: 'BROKER_ENDPOINT_REQUIRED' }));
    });

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
            createImageClient: () => broker,
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
            createImageClient: () => ({ run: vi.fn().mockRejectedValue(Object.assign(new Error('offline'), { code: 'BROKER_OFFLINE' })) }),
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
        const notify = vi.fn();
        const controller = createSceneController({
            getContext: () => current,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt: vi.fn().mockResolvedValue('scene prompt'),
            createImageClient: () => ({ run: () => brokerJob }),
            attachImage,
            notify,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const handling = controller.handle('group');
        await Promise.resolve();
        controller.markNavigation();
        current = makeContext('another-chat');
        resolveJob({ jobId: 'job-2', imageUrl: 'https://broker.example/two.png' });
        await handling;

        expect(attachImage).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('ready_elsewhere', expect.objectContaining({
            foreground: false,
        }));
        current = portal;
        await controller.flushPending();
        expect(attachImage).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith('attached', expect.objectContaining({
            foreground: true,
        }));
    });

    it('skips image submission after away-and-back navigation during prompt composition', async () => {
        const context = makeContext();
        let resolvePrompt;
        const prompt = new Promise((resolve) => { resolvePrompt = resolve; });
        const run = vi.fn().mockResolvedValue({
            jobId: 'job-retry',
            imageUrl: 'https://broker.example/retry.png',
        });
        const createImageClient = vi.fn().mockReturnValue({ run });
        const notify = vi.fn();
        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const composePrompt = vi.fn()
            .mockImplementationOnce(() => prompt)
            .mockResolvedValueOnce('stable prompt after return');
        const controller = createSceneController({
            getContext: () => context,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt,
            createImageClient,
            attachImage: vi.fn(),
            notify,
            logger,
        });

        const handling = controller.handle('group');
        controller.markNavigation();
        controller.markNavigation();
        resolvePrompt('prompt from potentially changed global context');
        await handling;

        expect(run).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('navigation_changed', expect.objectContaining({
            imageBackend: 'indrasnet',
        }));
        expect(notify).not.toHaveBeenCalledWith('failed', expect.anything());
        expect(logger.info).toHaveBeenCalledOnce();

        await controller.handle('group');
        expect(run).toHaveBeenCalledOnce();
        expect(composePrompt).toHaveBeenCalledTimes(2);
    });

    it('does not let an abandoned chat overwrite the active chat status', async () => {
        const origin = makeContext();
        let current = origin;
        let resolvePrompt;
        const prompt = new Promise((resolve) => { resolvePrompt = resolve; });
        const notify = vi.fn();
        const controller = createSceneController({
            getContext: () => current,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt: () => prompt,
            createImageClient: vi.fn(),
            attachImage: vi.fn(),
            notify,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const handling = controller.handle('group');
        current = makeContext('another-chat');
        controller.markNavigation();
        resolvePrompt('prompt from abandoned chat');
        await handling;

        expect(notify).not.toHaveBeenCalledWith('navigation_changed', expect.anything());
    });

    it('marks progress and failure from an abandoned submitted job as background-only', async () => {
        const origin = makeContext();
        let current = origin;
        const controllerRef = { current: null };
        const notify = vi.fn();
        const run = vi.fn(async ({ onState }) => {
            current = makeContext('another-chat');
            controllerRef.current.markNavigation();
            onState({ status: 'running', elapsedMs: 1000 });
            throw Object.assign(new Error('provider failed'), { code: 'PROVIDER_FAILED' });
        });
        const controller = createSceneController({
            getContext: () => current,
            getSettings: () => ({ enabled: true, portalOnly: true, workflowName: 'gen_anime' }),
            composePrompt: vi.fn().mockResolvedValue('stable origin prompt'),
            createImageClient: () => ({ run }),
            attachImage: vi.fn(),
            notify,
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });
        controllerRef.current = controller;

        await controller.handle('group');

        expect(notify).toHaveBeenCalledWith('running', expect.objectContaining({
            foreground: false,
        }));
        expect(notify).toHaveBeenCalledWith('failed', expect.objectContaining({
            code: 'PROVIDER_FAILED',
            foreground: false,
        }));
    });

    it('uses the selected native route without mutating the saved settings', async () => {
        const context = makeContext();
        const settings = {
            enabled: true,
            portalOnly: true,
            imageBackend: 'sillytavern',
            workflowName: 'gen_anime',
            negativePrompt: 'watermark',
        };
        const nativeClient = { run: vi.fn().mockResolvedValue({
            backend: 'sillytavern',
            provider: 'openrouter',
            model: 'image/model',
            jobId: null,
            imageUrl: '/user/images/native.png',
        }) };
        const attachImage = vi.fn().mockResolvedValue(undefined);
        const createImageClient = vi.fn().mockReturnValue(nativeClient);
        const controller = createSceneController({
            getContext: () => context,
            getSettings: () => settings,
            composePrompt: vi.fn().mockResolvedValue('native scene prompt'),
            createImageClient,
            attachImage,
            notify: vi.fn(),
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        await controller.handle('group');

        expect(createImageClient).toHaveBeenCalledWith(settings);
        expect(nativeClient.run).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'native scene prompt',
            negativePrompt: 'watermark',
        }));
        expect(attachImage).toHaveBeenCalledWith(expect.objectContaining({
            route: {
                backend: 'sillytavern',
                provider: 'openrouter',
                model: 'image/model',
            },
        }));
        expect(settings).toEqual(expect.objectContaining({ imageBackend: 'sillytavern' }));
    });
});
