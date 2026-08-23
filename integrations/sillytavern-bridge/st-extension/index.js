import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    setActiveGroup,
} from '../../../script.js';
import { openGroupById } from '../../group-chats.js';

const PARAMETER = 'lfGroup';
const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 250;
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

eventSource.on(event_types.APP_READY, openLexiconForgeGroup);
