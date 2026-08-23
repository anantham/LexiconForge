const PORTAL_CHAT_ID = /^LF-FMoC-Ch\d+-/;
const PORTAL_GROUP_NAME = /^FMoC Ch\d+\s+[—-]/;

function contextIdentity(context) {
    return String(context?.chatId || context?.groupId || 'no-chat');
}

function hashText(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isLexiconForgePortalChat(context) {
    if (!context?.groupId) return false;
    const group = context.groups?.find((candidate) => String(candidate.id) === String(context.groupId));
    return PORTAL_CHAT_ID.test(String(context.chatId || ''))
        && PORTAL_GROUP_NAME.test(String(group?.name || ''));
}

export function findLatestSceneMessage(context) {
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    for (let index = chat.length - 1; index >= 0; index -= 1) {
        const message = chat[index];
        if (!message || message.is_system) continue;
        if (message.extra?.type === 'extension') continue;
        if (typeof message.mes !== 'string' || !message.mes.trim()) continue;
        if (message.is_user) return null;
        return { index, message };
    }
    return null;
}

export function sceneFingerprint(context, scene) {
    if (!scene?.message || typeof scene.message.mes !== 'string') return null;
    return `${contextIdentity(context)}:${scene.index}:${hashText(scene.message.mes)}`;
}

export function shouldHandleSceneTrigger({ trigger, context, settings }) {
    if (!settings?.enabled || !findLatestSceneMessage(context)) return false;
    if (settings.portalOnly && !isLexiconForgePortalChat(context)) return false;
    if (context?.groupId) return trigger === 'group';
    return trigger === 'character';
}

export function sameChat(left, right) {
    return contextIdentity(left) === contextIdentity(right);
}
