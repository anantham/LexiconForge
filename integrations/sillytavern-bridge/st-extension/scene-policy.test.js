/**
 * Test intent:
 * - Trigger once per completed conversational turn, not once per group member.
 * - Restrict default behavior to LexiconForge-created portal groups.
 * - Ignore user, system, extension, and empty messages.
 */
import { describe, expect, it } from 'vitest';

import {
    findLatestSceneMessage,
    isLexiconForgePortalChat,
    sceneFingerprint,
    shouldHandleSceneTrigger,
} from './scene-policy.js';

const portalContext = (overrides = {}) => ({
    groupId: '1234567890123',
    chatId: 'LF-FMoC-Ch750-test',
    groups: [{ id: '1234567890123', name: 'FMoC Ch750 — The Test' }],
    chat: [
        { is_user: true, is_system: false, mes: 'I step forward.' },
        { is_user: false, is_system: false, mes: 'Li Yao turns toward the gate.' },
    ],
    ...overrides,
});

describe('scene policy', () => {
    it('recognizes only the bridge-created group identity', () => {
        expect(isLexiconForgePortalChat(portalContext())).toBe(true);
        expect(isLexiconForgePortalChat(portalContext({
            groups: [{ id: '1234567890123', name: 'Unrelated chat' }],
            chatId: 'ordinary-chat',
        }))).toBe(false);
    });

    it('selects the latest eligible assistant message', () => {
        const context = portalContext({
            chat: [
                { is_user: false, is_system: false, mes: 'Earlier.' },
                { is_user: true, is_system: false, mes: 'User.' },
                { is_user: false, is_system: true, mes: 'System.' },
                { is_user: false, is_system: false, mes: 'Latest.', extra: { type: 'extension' } },
                { is_user: false, is_system: false, mes: 'Scene.' },
            ],
        });

        expect(findLatestSceneMessage(context)).toMatchObject({ index: 4, message: { mes: 'Scene.' } });
    });

    it('does not illustrate an old assistant message when the latest turn has no reply', () => {
        const context = portalContext({
            chat: [
                { is_user: false, is_system: false, mes: 'Old scene.' },
                { is_user: true, is_system: false, mes: 'This generation failed before a reply.' },
            ],
        });

        expect(findLatestSceneMessage(context)).toBeNull();
    });

    it('uses group completion for groups and rendered messages for non-group chats', () => {
        const settings = { enabled: true, portalOnly: true };
        const group = portalContext();
        const single = portalContext({ groupId: null, chatId: 'single', groups: [] });

        expect(shouldHandleSceneTrigger({ trigger: 'group', context: group, settings })).toBe(true);
        expect(shouldHandleSceneTrigger({ trigger: 'character', context: group, settings })).toBe(false);
        expect(shouldHandleSceneTrigger({ trigger: 'character', context: single, settings: { ...settings, portalOnly: false } })).toBe(true);
        expect(shouldHandleSceneTrigger({ trigger: 'group', context: single, settings: { ...settings, portalOnly: false } })).toBe(false);
    });

    it('changes the fingerprint when a swipe replaces text at the same index', () => {
        const first = findLatestSceneMessage(portalContext());
        const swiped = findLatestSceneMessage(portalContext({
            chat: [
                { is_user: true, is_system: false, mes: 'I step forward.' },
                { is_user: false, is_system: false, mes: 'A different scene.' },
            ],
        }));

        expect(sceneFingerprint(portalContext(), first)).not.toBe(sceneFingerprint(portalContext(), swiped));
    });
});
