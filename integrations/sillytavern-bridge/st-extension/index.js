import {
    appendMediaToMessage,
    eventSource,
    event_types,
    generateQuietPrompt,
    saveChatConditional,
    saveSettingsDebounced,
    setActiveGroup,
} from '../../../script.js';
import { MEDIA_DISPLAY, MEDIA_SOURCE, MEDIA_TYPE, SCROLL_BEHAVIOR } from '../../constants.js';
import { extension_settings, getContext } from '../../extensions.js';
import { openGroupById } from '../../group-chats.js';

import { createBrokerClient } from './broker-client.js';
import { createSceneController } from './scene-controller.js';

const PARAMETER = 'lfGroup';
const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 250;
const SETTINGS_KEY = 'lexiconforge_portal';
const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    portalOnly: true,
    brokerUrl: 'https://asus-strix-scar.tail4741ad.ts.net:9443',
    workflowName: 'gen_anime',
    negativePrompt: 'low quality, worst quality, blurry, text, watermark, logo, malformed hands, extra fingers',
    pollIntervalMs: 2000,
    timeoutMs: 35 * 60 * 1000,
});
const FALLBACK_WORKFLOWS = [
    { name: 'gen_anime', display_name: 'Anime — Illustrious' },
    { name: 'gen_real', display_name: 'Realistic — Juggernaut' },
    { name: 'gen_anime_ref', display_name: 'Anime + character reference' },
    { name: 'gen_real_ref', display_name: 'Realistic + character reference' },
    { name: 'gen_real_chroma', display_name: 'Chroma Flux (heavy)' },
];
const SCENE_PROMPT = `Describe the current visible scene after the latest exchange as one concise image-generation prompt.
Use only details supported by the conversation and character context. Include setting, characters currently present,
appearance, action, mood, lighting, composition, and camera framing. Do not narrate, explain, quote dialogue, or add
labels. Return only the visual prompt.`;
let handled = false;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function openLexiconForgeGroup() {
    if (handled) return;
    const url = new URL(window.location.href);
    const groupId = url.searchParams.get(PARAMETER);
    if (!groupId) return;
    handled = true;

    if (!/^\d{10,20}$/.test(groupId)) {
        console.error(`[LexiconForge Portal] Refusing invalid group ID from ${PARAMETER}`);
        return;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const opened = await openGroupById(groupId);
            if (opened) {
                setActiveGroup(groupId);
                saveSettingsDebounced();
                url.searchParams.delete(PARAMETER);
                window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
                console.info(`[LexiconForge Portal] Opened group ${groupId}`);
                return;
            }
        } catch (error) {
            console.error(
                `[LexiconForge Portal] Group ${groupId} open attempt ${attempt}/${MAX_ATTEMPTS} failed`,
                error,
            );
        }
        if (attempt < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS);
    }

    console.error(`[LexiconForge Portal] Group ${groupId} was not available after ${MAX_ATTEMPTS} attempts`);
}

function settings() {
    extension_settings[SETTINGS_KEY] = {
        ...DEFAULT_SETTINGS,
        ...(extension_settings[SETTINGS_KEY] || {}),
    };
    return extension_settings[SETTINGS_KEY];
}

function updateStatus(label, detail = '') {
    const status = document.querySelector('#lf_auto_scene_status');
    if (!status) return;
    status.textContent = detail ? `${label} — ${detail}` : label;
    status.dataset.state = label.toLowerCase().replace(/\s+/g, '-');
}

function notify(state, detail = {}) {
    const elapsed = Number.isFinite(detail.elapsedMs) ? `${Math.round(detail.elapsedMs / 1000)}s elapsed` : '';
    switch (state) {
        case 'composing':
            updateStatus('Composing scene prompt');
            break;
        case 'queued':
            updateStatus('Queued in IndrasNet', elapsed);
            toastr.info('Scene illustration queued in IndrasNet.', 'LexiconForge Auto-Scene');
            break;
        case 'running':
            updateStatus('Rendering', `${elapsed}; no broker ETA available`);
            break;
        case 'attached':
            updateStatus('Ready', detail.jobId || 'image attached');
            toastr.success('Scene illustration is ready.', 'LexiconForge Auto-Scene');
            break;
        case 'ready_elsewhere':
            updateStatus('Ready in another chat', 'return to that chat to attach it');
            toastr.info('Scene illustration is ready. Return to its chat to attach it.', 'LexiconForge Auto-Scene');
            break;
        case 'failed':
            updateStatus('Failed', detail.code || 'unknown error');
            toastr.warning(`Scene illustration failed (${detail.code || 'unknown error'}). Chat was not interrupted.`, 'LexiconForge Auto-Scene');
            break;
        case 'stale':
            updateStatus('Skipped stale result');
            break;
        default:
            updateStatus(state, elapsed);
    }
}

async function composePrompt() {
    const result = await generateQuietPrompt({ quietPrompt: SCENE_PROMPT });
    return typeof result === 'string' ? result.trim() : '';
}

async function attachImage({ context, messageIndex, workflowName, result }) {
    const message = context.chat?.[messageIndex];
    if (!message) throw Object.assign(new Error('Target chat message is no longer available'), { code: 'TARGET_MESSAGE_MISSING' });

    message.extra ??= {};
    message.extra.media ??= [];
    message.extra.media_display ??= MEDIA_DISPLAY.GALLERY;
    message.extra.inline_image = true;
    message.extra.media.push({
        url: result.imageUrl,
        type: MEDIA_TYPE.IMAGE,
        title: `LexiconForge scene — ${workflowName}`,
        generation_type: 'lexiconforge_auto_scene',
        source: MEDIA_SOURCE.GENERATED,
    });
    message.extra.lexiconforge_auto_scenes ??= [];
    message.extra.lexiconforge_auto_scenes.push({
        broker_job_id: result.jobId,
        prompt_id: result.promptId,
        workflow_name: workflowName,
        timing_ms: result.timingMs,
        attached_at: new Date().toISOString(),
    });

    const messageElement = $(`.mes[mesid="${messageIndex}"]`);
    if (messageElement.length) {
        appendMediaToMessage(message, messageElement, SCROLL_BEHAVIOR.KEEP);
    }
    await saveChatConditional();
}

const sceneController = createSceneController({
    getContext,
    getSettings: settings,
    composePrompt,
    createBroker: (baseUrl) => createBrokerClient({ baseUrl }),
    attachImage,
    notify,
    logger: console,
});

function populateWorkflowSelect(workflows) {
    const select = document.querySelector('#lf_auto_scene_workflow');
    if (!select) return;
    const selected = settings().workflowName;
    select.replaceChildren();
    for (const workflow of workflows) {
        const option = document.createElement('option');
        option.value = workflow.name;
        option.textContent = workflow.display_name || workflow.name;
        option.selected = workflow.name === selected;
        select.append(option);
    }
    if (![...select.options].some((option) => option.value === selected)) {
        const option = document.createElement('option');
        option.value = selected;
        option.textContent = `${selected} (unverified)`;
        option.selected = true;
        select.prepend(option);
    }
}

async function refreshWorkflows({ announce = false } = {}) {
    try {
        const workflows = await createBrokerClient({ baseUrl: settings().brokerUrl }).listWorkflows();
        populateWorkflowSelect(workflows);
        updateStatus('Broker reachable', `${workflows.length} client-ready workflows`);
        if (announce) toastr.success('IndrasNet workflow catalogue loaded.', 'LexiconForge Auto-Scene');
    } catch (error) {
        populateWorkflowSelect(FALLBACK_WORKFLOWS);
        updateStatus('Broker offline', error.code || 'connection failed');
        if (announce) toastr.warning('IndrasNet is unavailable. Chat remains usable.', 'LexiconForge Auto-Scene');
    }
}

function mountSettings() {
    if (document.querySelector('#lf_auto_scene_container')) return;
    const container = document.createElement('div');
    container.id = 'lf_auto_scene_container';
    container.className = 'extension_container';
    container.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>LexiconForge Auto-Scene</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label"><input id="lf_auto_scene_enabled" type="checkbox"><span>Generate after each completed turn</span></label>
                <label class="checkbox_label"><input id="lf_auto_scene_portal_only" type="checkbox"><span>LexiconForge portal chats only</span></label>
                <label for="lf_auto_scene_workflow">IndrasNet workflow</label>
                <select id="lf_auto_scene_workflow" class="text_pole"></select>
                <label for="lf_auto_scene_broker_url">IndrasNet broker URL</label>
                <input id="lf_auto_scene_broker_url" class="text_pole" type="url" autocomplete="off">
                <label for="lf_auto_scene_negative">Negative prompt</label>
                <textarea id="lf_auto_scene_negative" class="text_pole" rows="3"></textarea>
                <div class="lf_auto_scene_actions"><button id="lf_auto_scene_refresh" class="menu_button">Test broker & refresh workflows</button></div>
                <div id="lf_auto_scene_status" role="status" aria-live="polite">Not checked</div>
                <small>Shows broker state and elapsed time. IndrasNet does not currently expose a percentage or empirical ETA.</small>
            </div>
        </div>`;
    document.querySelector('#extensions_settings2')?.append(container);

    const current = settings();
    document.querySelector('#lf_auto_scene_enabled').checked = current.enabled;
    document.querySelector('#lf_auto_scene_portal_only').checked = current.portalOnly;
    document.querySelector('#lf_auto_scene_broker_url').value = current.brokerUrl;
    document.querySelector('#lf_auto_scene_negative').value = current.negativePrompt;
    populateWorkflowSelect(FALLBACK_WORKFLOWS);

    const bind = (selector, key, read) => document.querySelector(selector)?.addEventListener('change', (event) => {
        settings()[key] = read(event.target);
        saveSettingsDebounced();
    });
    bind('#lf_auto_scene_enabled', 'enabled', (element) => element.checked);
    bind('#lf_auto_scene_portal_only', 'portalOnly', (element) => element.checked);
    bind('#lf_auto_scene_workflow', 'workflowName', (element) => element.value);
    bind('#lf_auto_scene_broker_url', 'brokerUrl', (element) => element.value.trim());
    bind('#lf_auto_scene_negative', 'negativePrompt', (element) => element.value.trim());
    document.querySelector('#lf_auto_scene_refresh')?.addEventListener('click', () => refreshWorkflows({ announce: true }));
}

async function initialize() {
    settings();
    mountSettings();
    await openLexiconForgeGroup();
    refreshWorkflows();
}

eventSource.on(event_types.APP_READY, initialize);
eventSource.on(event_types.GROUP_WRAPPER_FINISHED, ({ type } = {}) => sceneController.handle('group', { messageType: type }));
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId, type) => sceneController.handle('character', {
    messageId: Number(messageId),
    messageType: type,
}));
eventSource.on(event_types.CHAT_CHANGED, () => sceneController.flushPending());
