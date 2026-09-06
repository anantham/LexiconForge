import {
    findLatestSceneMessage,
    sameChat,
    sceneFingerprint,
    shouldHandleSceneTrigger,
} from './scene-policy.js';

const DEFAULT_NEGATIVE_PROMPT = 'low quality, worst quality, blurry, text, watermark, logo, malformed hands, extra fingers';

export function createSceneController({
    getContext,
    getSettings,
    composePrompt,
    createImageClient,
    attachImage,
    notify = () => {},
    logger = console,
}) {
    const handled = new Set();
    const pending = new Map();
    let navigationEpoch = 0;

    function markNavigation() {
        navigationEpoch += 1;
    }

    function rememberPending(chatId, item) {
        const items = pending.get(chatId) || [];
        items.push(item);
        pending.set(chatId, items);
    }

    async function handle(trigger, { messageId, messageType } = {}) {
        const context = getContext();
        const settings = getSettings();
        if (!shouldHandleSceneTrigger({ trigger, context, settings })) return;
        if (['first_message', 'extension', 'quiet'].includes(messageType)) return;

        const scene = findLatestSceneMessage(context);
        if (!scene || (Number.isInteger(messageId) && messageId !== scene.index)) return;
        const fingerprint = sceneFingerprint(context, scene);
        if (handled.has(fingerprint)) return;
        handled.add(fingerprint);

        const imageBackend = settings.imageBackend === 'sillytavern' ? 'sillytavern' : 'indrasnet';
        const workflowName = settings.workflowName || 'gen_anime';
        try {
            const imageClient = createImageClient(settings);
            const compositionEpoch = navigationEpoch;
            notify('composing', { fingerprint, imageBackend, workflowName });
            const prompt = (await composePrompt({ context, messageIndex: scene.index })).trim();
            if (navigationEpoch !== compositionEpoch) {
                handled.delete(fingerprint);
                logger.info('[LexiconForge Portal] Skipped auto-scene after chat navigation during prompt composition');
                if (sameChat(context, getContext())) {
                    notify('navigation_changed', { fingerprint, imageBackend, workflowName });
                }
                return;
            }
            if (!prompt) {
                throw Object.assign(new Error('Scene prompt composition returned no text'), {
                    code: 'PROMPT_COMPOSITION_EMPTY',
                });
            }

            const result = await imageClient.run({
                workflowName,
                prompt,
                negativePrompt: settings.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
                pollIntervalMs: settings.pollIntervalMs,
                timeoutMs: settings.timeoutMs,
                onState: (state) => notify(state.status, {
                    fingerprint,
                    imageBackend: state.backend || imageBackend,
                    provider: state.provider,
                    model: state.model,
                    workflowName,
                    jobId: state.job_id,
                    elapsedMs: state.elapsedMs,
                    foreground: sameChat(context, getContext()),
                }),
            });
            const route = {
                backend: result.backend || imageBackend,
                provider: result.provider || (imageBackend === 'indrasnet' ? 'IndrasNet' : null),
                model: result.model || (imageBackend === 'indrasnet' ? workflowName : null),
            };

            const currentContext = getContext();
            const attachment = {
                context: currentContext,
                messageIndex: scene.index,
                fingerprint,
                workflowName,
                route,
                prompt,
                negativePrompt: settings.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
                result,
            };
            if (sameChat(context, currentContext)
                && sceneFingerprint(currentContext, {
                    index: scene.index,
                    message: currentContext.chat?.[scene.index],
                }) === fingerprint) {
                await attachImage(attachment);
                notify('attached', {
                    fingerprint,
                    route,
                    workflowName,
                    jobId: result.jobId,
                    foreground: true,
                });
            } else {
                rememberPending(String(context.chatId || context.groupId), { ...attachment, context });
                notify('ready_elsewhere', {
                    fingerprint,
                    route,
                    workflowName,
                    jobId: result.jobId,
                    foreground: false,
                });
            }
        } catch (error) {
            const code = error?.code || 'AUTO_SCENE_FAILED';
            logger.error(`[LexiconForge Portal] Auto-scene failed (${code})`, error);
            notify('failed', {
                fingerprint,
                imageBackend,
                workflowName,
                code,
                retryable: Boolean(error?.retryable),
                foreground: sameChat(context, getContext()),
            });
        }
    }

    async function flushPending() {
        const context = getContext();
        const chatId = String(context?.chatId || context?.groupId);
        const items = pending.get(chatId);
        if (!items?.length) return;
        pending.delete(chatId);

        for (const item of items) {
            const message = context.chat?.[item.messageIndex];
            const currentFingerprint = sceneFingerprint(context, { index: item.messageIndex, message });
            if (currentFingerprint !== item.fingerprint) {
                logger.warn(`[LexiconForge Portal] Skipped stale auto-scene attachment for ${chatId}`);
                notify('stale', { fingerprint: item.fingerprint, workflowName: item.workflowName });
                continue;
            }
            await attachImage({ ...item, context });
            notify('attached', {
                fingerprint: item.fingerprint,
                workflowName: item.workflowName,
                route: item.route,
                jobId: item.result.jobId,
                foreground: true,
            });
        }
    }

    return { flushPending, handle, markNavigation };
}
