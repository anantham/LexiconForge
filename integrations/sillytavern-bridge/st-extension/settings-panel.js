export function createSettingsPanel({
    getSettings,
    getNativeRoute,
    saveSettings,
    onRefreshWorkflows,
    onBackendChanged = () => {},
    fallbackWorkflows,
} = {}) {
    function populateWorkflowSelect(workflows) {
        const select = document.querySelector('#lf_auto_scene_workflow');
        if (!select) return;
        const selected = getSettings().workflowName;
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
        select.value = selected;
    }

    function syncRouteControls() {
        const native = getSettings().imageBackend === 'sillytavern';
        const indrasNetControls = document.querySelector('#lf_auto_scene_indrasnet_controls');
        const nativeControls = document.querySelector('#lf_auto_scene_sillytavern_controls');
        if (indrasNetControls) indrasNetControls.hidden = native;
        if (nativeControls) nativeControls.hidden = !native;
        const route = document.querySelector('#lf_auto_scene_native_route');
        if (route) {
            const current = getNativeRoute();
            route.textContent = `Current SillyTavern route: ${current.source || 'not configured'} — ${current.model || 'not configured'}`;
        }
    }

    function bind(selector, key, read) {
        document.querySelector(selector)?.addEventListener('change', (event) => {
            getSettings()[key] = read(event.target);
            saveSettings();
        });
    }

    function mount() {
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
                    <label for="lf_auto_scene_backend">Image route</label>
                    <select id="lf_auto_scene_backend" class="text_pole">
                        <option value="indrasnet">IndrasNet — local ComfyUI workflow</option>
                        <option value="sillytavern">SillyTavern Image Generation — current source/model</option>
                    </select>
                    <div id="lf_auto_scene_indrasnet_controls" class="lf_auto_scene_route_controls">
                        <label for="lf_auto_scene_workflow">IndrasNet workflow</label>
                        <select id="lf_auto_scene_workflow" class="text_pole"></select>
                        <label for="lf_auto_scene_broker_url">IndrasNet broker URL</label>
                        <input id="lf_auto_scene_broker_url" class="text_pole" type="url" autocomplete="off">
                        <div class="lf_auto_scene_actions"><button id="lf_auto_scene_refresh" class="menu_button">Test broker & refresh workflows</button></div>
                    </div>
                    <div id="lf_auto_scene_sillytavern_controls" class="lf_auto_scene_route_controls">
                        <div id="lf_auto_scene_native_route"></div>
                        <small>Provider, model, and credential remain controlled by SillyTavern's Image Generation panel. This extension does not copy or override them.</small>
                    </div>
                    <label for="lf_auto_scene_negative">Negative prompt</label>
                    <textarea id="lf_auto_scene_negative" class="text_pole" rows="3"></textarea>
                    <div id="lf_auto_scene_status" role="status" aria-live="polite">Not checked</div>
                    <small>Shows route state and elapsed time. Neither route currently exposes a percentage or empirical ETA here.</small>
                </div>
            </div>`;
        document.querySelector('#extensions_settings2')?.append(container);

        const current = getSettings();
        document.querySelector('#lf_auto_scene_enabled').checked = current.enabled;
        document.querySelector('#lf_auto_scene_portal_only').checked = current.portalOnly;
        document.querySelector('#lf_auto_scene_backend').value = current.imageBackend;
        document.querySelector('#lf_auto_scene_broker_url').value = current.brokerUrl;
        document.querySelector('#lf_auto_scene_negative').value = current.negativePrompt;
        populateWorkflowSelect(fallbackWorkflows);
        syncRouteControls();

        bind('#lf_auto_scene_enabled', 'enabled', (element) => element.checked);
        bind('#lf_auto_scene_portal_only', 'portalOnly', (element) => element.checked);
        bind('#lf_auto_scene_workflow', 'workflowName', (element) => element.value);
        bind('#lf_auto_scene_broker_url', 'brokerUrl', (element) => element.value.trim());
        bind('#lf_auto_scene_negative', 'negativePrompt', (element) => element.value.trim());
        document.querySelector('#lf_auto_scene_backend')?.addEventListener('change', (event) => {
            getSettings().imageBackend = event.target.value === 'sillytavern' ? 'sillytavern' : 'indrasnet';
            saveSettings();
            syncRouteControls();
            onBackendChanged(getSettings().imageBackend);
        });
        document.querySelector('#lf_auto_scene_refresh')?.addEventListener('click', onRefreshWorkflows);
        document.addEventListener('change', (event) => {
            if (event.target?.matches?.('#sd_source, #sd_model')) syncRouteControls();
        });
    }

    return { mount, populateWorkflowSelect, syncRouteControls };
}
