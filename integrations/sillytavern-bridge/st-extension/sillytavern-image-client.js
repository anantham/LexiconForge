export class SillyTavernImageError extends Error {
    constructor(message, { code = 'SILLYTAVERN_IMAGE_ERROR', cause } = {}) {
        super(message, cause ? { cause } : undefined);
        this.name = 'SillyTavernImageError';
        this.code = code;
        this.retryable = false;
    }
}

function normalizeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new SillyTavernImageError('SillyTavern Image Generation returned no image URL', {
            code: 'SILLYTAVERN_IMAGE_MISSING',
        });
    }
    const imageUrl = value.trim();
    if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) return imageUrl;

    let parsed;
    try {
        parsed = new URL(imageUrl);
    } catch {
        throw new SillyTavernImageError('SillyTavern Image Generation returned an invalid image URL', {
            code: 'SILLYTAVERN_IMAGE_BAD_RESPONSE',
        });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new SillyTavernImageError('SillyTavern Image Generation returned an unsafe image URL', {
            code: 'SILLYTAVERN_IMAGE_BAD_RESPONSE',
        });
    }
    return parsed.toString();
}

export function createSillyTavernImageClient({
    getImagineCommand,
    getRoute,
    now = () => Date.now(),
} = {}) {
    if (typeof getImagineCommand !== 'function' || typeof getRoute !== 'function') {
        throw new TypeError('SillyTavern image client requires command and route accessors');
    }

    async function run({ prompt, negativePrompt = '', onState = () => {} }) {
        const command = getImagineCommand();
        if (typeof command?.callback !== 'function') {
            throw new SillyTavernImageError('Enable and configure SillyTavern Image Generation before using this route', {
                code: 'SILLYTAVERN_IMAGE_EXTENSION_UNAVAILABLE',
            });
        }

        const route = getRoute();
        const provider = String(route?.source || '').trim();
        const model = String(route?.model || '').trim();
        if (!provider || !model) {
            throw new SillyTavernImageError('Select an image source and model in SillyTavern Image Generation', {
                code: 'SILLYTAVERN_IMAGE_NOT_CONFIGURED',
            });
        }

        const startedAt = now();
        onState({ status: 'running', backend: 'sillytavern', provider, model, elapsedMs: 0 });

        let rawImageUrl;
        try {
            // Call the registered command callback directly. Generated scene text never enters
            // the STscript parser, so pipes, macros, and slash commands remain inert prompt data.
            rawImageUrl = await command.callback({
                quiet: 'true',
                gallery: 'false',
                negative: negativePrompt,
            }, prompt);
        } catch (error) {
            throw new SillyTavernImageError('SillyTavern Image Generation failed', {
                code: 'SILLYTAVERN_IMAGE_FAILED',
                cause: error,
            });
        }

        return {
            backend: 'sillytavern',
            provider,
            model,
            jobId: null,
            promptId: null,
            timingMs: now() - startedAt,
            imageUrl: normalizeImageUrl(rawImageUrl),
        };
    }

    return { run };
}
