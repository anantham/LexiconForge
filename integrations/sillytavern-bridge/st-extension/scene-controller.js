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
    createBroker,
    attachImage,
    notify = () => {},
    logger = console,
}) {
    const handled = new Set();
    const pending = new Map();

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

        const workflowName = settings.workflowName || 'gen_anime';
        try {
            notify('composing', { fingerprint, workflowName });
            const prompt = (await composePrompt({ context, messageIndex: scene.index })).trim();
            if (!prompt) {
                throw Object.assign(new Error('Scene prompt composition returned no text'), {
                    code: 'PROMPT_COMPOSITION_EMPTY',
                });
            }

            const broker = createBroker(settings.brokerUrl);
            const result = await broker.run({
                workflowName,
                prompt,
                negativePrompt: settings.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
                pollIntervalMs: settings.pollIntervalMs,
                timeoutMs: settings.timeoutMs,
                onState: (state) => notify(state.status, {
                    fingerprint,
                    workflowName,
                    jobId: state.job_id,
                    elapsedMs: state.elapsedMs,
                }),
            });

            const currentContext = getContext();
            const attachment = {
                context: currentContext,
                messageIndex: scene.index,
                fingerprint,
                workflowName,
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
                notify('attached', { fingerprint, workflowName, jobId: result.jobId });
            } else {
                rememberPending(String(context.chatId || context.groupId), { ...attachment, context });
                notify('ready_elsewhere', { fingerprint, workflowName, jobId: result.jobId });
            }
        } catch (error) {
            const code = error?.code || 'AUTO_SCENE_FAILED';
            logger.error(`[LexiconForge Portal] Auto-scene failed (${code})`, error);
            notify('failed', { fingerprint, workflowName, code, retryable: Boolean(error?.retryable) });
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
                jobId: item.result.jobId,
            });
        }
    }

    return { flushPending, handle };
}
