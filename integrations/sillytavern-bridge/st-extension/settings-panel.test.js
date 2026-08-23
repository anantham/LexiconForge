/**
 * Test intent:
 * - Make the backend selector an observable, persisted affordance.
 * - Show only controls owned by the selected route.
 * - Keep SillyTavern's current native source/model visible but read-only here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSettingsPanel } from './settings-panel.js';

describe('createSettingsPanel', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="extensions_settings2"></div>';
    });

    it('switches independently between IndrasNet and the native SillyTavern route', () => {
        const settings = {
            enabled: true,
            portalOnly: true,
            imageBackend: 'indrasnet',
            workflowName: 'gen_anime',
            brokerUrl: 'https://broker.example',
            negativePrompt: 'watermark',
        };
        const saveSettings = vi.fn();
        const onBackendChanged = vi.fn();
        const panel = createSettingsPanel({
            getSettings: () => settings,
            getNativeRoute: () => ({ source: 'openrouter', model: 'image/model' }),
            saveSettings,
            onRefreshWorkflows: vi.fn(),
            onBackendChanged,
            fallbackWorkflows: [{ name: 'gen_anime', display_name: 'Anime' }],
        });

        panel.mount();

        expect(document.querySelector('#lf_auto_scene_indrasnet_controls').hidden).toBe(false);
        expect(document.querySelector('#lf_auto_scene_sillytavern_controls').hidden).toBe(true);
        expect(document.querySelector('#lf_auto_scene_native_route').textContent)
            .toContain('openrouter — image/model');

        const backend = document.querySelector('#lf_auto_scene_backend');
        backend.value = 'sillytavern';
        backend.dispatchEvent(new Event('change'));

        expect(settings.imageBackend).toBe('sillytavern');
        expect(saveSettings).toHaveBeenCalledOnce();
        expect(onBackendChanged).toHaveBeenCalledWith('sillytavern');
        expect(document.querySelector('#lf_auto_scene_indrasnet_controls').hidden).toBe(true);
        expect(document.querySelector('#lf_auto_scene_sillytavern_controls').hidden).toBe(false);
    });

    it('preserves a saved workflow that is temporarily absent from discovery', () => {
        const settings = {
            enabled: true,
            portalOnly: true,
            imageBackend: 'indrasnet',
            workflowName: 'custom_workflow',
            brokerUrl: 'https://broker.example',
            negativePrompt: '',
        };
        const panel = createSettingsPanel({
            getSettings: () => settings,
            getNativeRoute: () => ({}),
            saveSettings: vi.fn(),
            onRefreshWorkflows: vi.fn(),
            fallbackWorkflows: [{ name: 'gen_anime', display_name: 'Anime' }],
        });

        panel.mount();

        const selected = document.querySelector('#lf_auto_scene_workflow').selectedOptions[0];
        expect(selected.value).toBe('custom_workflow');
        expect(selected.textContent).toContain('unverified');
    });
});
