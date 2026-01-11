/**
 * LexiconForge Scraper Popup
 * Multi-site support: BookToki + Polyglotta
 */

class LexiconForgeScraperPopup {
    constructor() {
        this.currentSite = null; // 'booktoki' | 'polyglotta' | null
        this.isRunning = false;

        this.initializeElements();
        this.attachEventListeners();
        this.detectSite();
    }

    initializeElements() {
        // Status elements
        this.statusEl = document.getElementById('status');
        this.logEl = document.getElementById('log');
        this.siteIndicator = document.getElementById('siteIndicator');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');

        // BookToki elements
        this.maxChaptersInput = document.getElementById('maxChapters');
        this.startBtn = document.getElementById('startScraping');
        this.downloadBtn = document.getElementById('downloadAccumulated');

        // Polyglotta elements
        this.maxSectionsInput = document.getElementById('maxSections');
        this.startPolyglottaBtn = document.getElementById('startPolyglotta');
        this.downloadPolyglottaBtn = document.getElementById('downloadPolyglotta');

        // Common elements
        this.clearBtn = document.getElementById('clearAllData');
        this.stopBtn = document.getElementById('stopScraping');
    }

    attachEventListeners() {
        // BookToki handlers
        this.startBtn?.addEventListener('click', () => this.startBookTokiScraping());
        this.downloadBtn?.addEventListener('click', () => this.downloadBookTokiChapters());

        // Polyglotta handlers
        this.startPolyglottaBtn?.addEventListener('click', () => this.startPolyglottaScraping());
        this.downloadPolyglottaBtn?.addEventListener('click', () => this.downloadPolyglottaSections());

        // Common handlers
        this.clearBtn?.addEventListener('click', () => this.clearAllData());
        this.stopBtn?.addEventListener('click', () => this.stopScraping());

        // Listen for messages from content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
    }

    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    async detectSite() {
        const tab = await this.getCurrentTab();
        const url = tab?.url || '';

        // Diagnostic logging
        console.log('[Popup] Site detection starting...');
        console.log('[Popup] Tab:', { id: tab?.id, url: tab?.url, status: tab?.status });

        if (url.includes('booktoki')) {
            this.currentSite = 'booktoki';
            document.body.classList.add('site-booktoki');
            this.siteIndicator.textContent = '🇰🇷 BookToki';
            this.siteIndicator.className = 'site-indicator booktoki';
            this.updateLog('📚 BookToki detected. Ready to scrape Korean novels.');
            this.checkBookTokiSession();
        } else if (url.includes('polyglotta') || url.includes('hf.uio.no')) {
            this.currentSite = 'polyglotta';
            document.body.classList.add('site-polyglotta');
            this.siteIndicator.textContent = '🕉️ Polyglotta';
            this.siteIndicator.className = 'site-indicator polyglotta';
            this.progressFill.classList.add('polyglotta');
            this.updateLog('📜 Polyglotta detected. Ready to scrape Buddhist texts.');
            this.checkPolyglottaSession();
        } else {
            this.siteIndicator.textContent = '❓ Navigate to a supported site';
            this.siteIndicator.className = 'site-indicator unknown';
            this.updateLog('⚠️ Please navigate to BookToki or Polyglotta to begin scraping.');
            this.updateStatus('ready', 'Navigate to a supported site');
        }
    }

    async sendMessageToTab(action, data = {}) {
        const tab = await this.getCurrentTab();

        try {
            // First check if content script is loaded
            const pingResult = await this.pingContentScript(tab.id);
            if (!pingResult.success) {
                this.updateLog(`⚠️ Content script not loaded. ${pingResult.reason}`);
                this.updateLog(`💡 Try: Refresh the page (Cmd+R), then try again.`);
                return false;
            }

            await chrome.tabs.sendMessage(tab.id, { action, ...data });
            return true;
        } catch (error) {
            this.updateLog(`❌ Error: ${error.message}`);
            this.diagnoseConnectionError(tab, error);
            return false;
        }
    }

    async pingContentScript(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
            if (response?.pong) {
                console.log('[Popup] Content script responded:', response);
                return { success: true };
            }
            return { success: false, reason: 'No response from content script.' };
        } catch (error) {
            console.log('[Popup] Ping failed, attempting to inject content script...');

            // Try to programmatically inject the content script
            const injected = await this.tryInjectContentScript(tabId);
            if (injected) {
                // Wait a moment for script to initialize
                await new Promise(r => setTimeout(r, 500));

                // Try pinging again
                try {
                    const retryResponse = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
                    if (retryResponse?.pong) {
                        console.log('[Popup] Injection succeeded, script responding');
                        return { success: true };
                    }
                } catch (e) {
                    // Still failed
                }
            }

            return { success: false, reason: error.message };
        }
    }

    async tryInjectContentScript(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);

            // Determine which script to inject based on URL
            let scriptFile = null;
            if (tab.url?.includes('polyglotta') || tab.url?.includes('hf.uio.no')) {
                scriptFile = 'content-polyglotta.js';
            } else if (tab.url?.includes('booktoki')) {
                scriptFile = 'content.js';
            }

            if (!scriptFile) {
                console.log('[Popup] No matching content script for URL:', tab.url);
                return false;
            }

            console.log(`[Popup] Injecting ${scriptFile} into tab ${tabId}...`);

            await chrome.scripting.executeScript({
                target: { tabId },
                files: [scriptFile]
            });

            this.updateLog(`✅ Content script injected successfully`);
            console.log('[Popup] Script injection completed');
            return true;

        } catch (error) {
            console.error('[Popup] Script injection failed:', error);
            this.updateLog(`❌ Could not inject script: ${error.message}`);
            return false;
        }
    }

    diagnoseConnectionError(tab, error) {
        console.log('[Popup Diagnostics]', {
            error: error.message,
            tabId: tab?.id,
            tabUrl: tab?.url,
            tabStatus: tab?.status
        });

        if (error.message.includes('Receiving end does not exist')) {
            this.updateLog(`🔍 Diagnosis: Content script not injected into page.`);
            this.updateLog(`   Tab URL: ${tab?.url?.substring(0, 60)}...`);
            this.updateLog(`   Expected pattern: *://*.hf.uio.no/polyglotta/*`);

            if (!tab?.url?.includes('/polyglotta/')) {
                this.updateLog(`   ❌ URL missing '/polyglotta/' path`);
            } else if (!tab?.url?.includes('hf.uio.no')) {
                this.updateLog(`   ❌ URL not on hf.uio.no domain`);
            } else {
                this.updateLog(`   ✓ URL pattern looks correct`);
                this.updateLog(`   💡 Extension may need reload: chrome://extensions/ → refresh icon`);
                this.updateLog(`   💡 Then refresh this page (Cmd+R)`);
            }
        }
    }

    // ==================== BOOKTOKI METHODS ====================

    async checkBookTokiSession() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSession' });
            const session = response.session;

            const chaptersResponse = await chrome.runtime.sendMessage({ action: 'getAccumulatedChapters' });
            const chaptersCount = chaptersResponse.chapters?.length || 0;

            if (session && session.isActive) {
                this.isRunning = true;
                this.updateStatus('working', `Scraping in progress (${chaptersCount}/${session.maxChapters} chapters)`);
                this.updateProgress(session.currentChapter, session.maxChapters, `Chapter ${session.currentChapter}`);
                this.startBtn.style.display = 'none';
                this.stopBtn.style.display = 'block';
            } else {
                this.updateStatus('ready', chaptersCount > 0 ? `Ready (${chaptersCount} chapters stored)` : 'Ready to scrape');
            }
        } catch (error) {
            this.updateStatus('ready', 'Ready to scrape');
        }
    }

    async startBookTokiScraping() {
        this.isRunning = true;
        const maxChapters = parseInt(this.maxChaptersInput.value) || 10;

        this.updateStatus('working', `Starting scraping (${maxChapters} chapters)...`);
        this.updateLog(`📚 Starting multi-chapter scraping (max ${maxChapters} chapters)...`);

        this.startBtn.style.display = 'none';
        this.stopBtn.style.display = 'block';

        await this.sendMessageToTab('START_SCRAPING', { maxChapters });
    }

    async downloadBookTokiChapters() {
        try {
            this.updateLog('💾 Downloading accumulated chapters...');
            const response = await chrome.runtime.sendMessage({ action: 'downloadAccumulated' });

            if (response?.success) {
                this.updateLog(`✅ Downloaded ${response.chaptersCount} chapters!`);
            } else {
                this.updateLog(`❌ Download failed: ${response?.error || 'Unknown error'}`);
            }
        } catch (error) {
            this.updateLog(`❌ Download error: ${error.message}`);
        }
    }

    // ==================== POLYGLOTTA METHODS ====================

    async checkPolyglottaSession() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getPolyglottaSession' });
            const session = response.session;

            const sectionsResponse = await chrome.runtime.sendMessage({ action: 'getPolyglottaSections' });
            const sectionsCount = sectionsResponse.sections?.length || 0;

            if (session && session.isActive) {
                this.isRunning = true;
                this.updateStatus('working', `Scraping in progress (${sectionsCount}/${session.totalSections} sections)`);
                this.updateProgress(session.currentSection, session.totalSections, `Section ${session.currentSection}`);
                this.startPolyglottaBtn.style.display = 'none';
                this.stopBtn.style.display = 'block';
                this.updateLog(`🔄 Session active: ${session.metadata?.title || 'Unknown text'}`);
            } else {
                this.updateStatus('ready', sectionsCount > 0 ? `Ready (${sectionsCount} sections stored)` : 'Ready to scrape');
            }
        } catch (error) {
            this.updateStatus('ready', 'Ready to scrape');
        }
    }

    async startPolyglottaScraping() {
        this.isRunning = true;
        const maxSections = parseInt(this.maxSectionsInput.value) || 50;

        this.updateStatus('working', 'Starting section-by-section scraping...');
        this.updateLog(`🕉️ Starting Polyglotta scraping (max ${maxSections} sections)...`);

        this.startPolyglottaBtn.style.display = 'none';
        this.stopBtn.style.display = 'block';

        await this.sendMessageToTab('START_SCRAPING', { maxSections });
    }

    async downloadPolyglottaSections() {
        try {
            this.updateLog('💾 Downloading accumulated sections...');
            const response = await chrome.runtime.sendMessage({ action: 'completePolyglottaSession' });

            if (response?.success) {
                this.updateLog(`✅ Downloaded ${response.sectionsCount} sections (${response.paragraphsCount} paragraphs)!`);
            } else {
                this.updateLog(`❌ Download failed: ${response?.error || 'Unknown error'}`);
            }
        } catch (error) {
            this.updateLog(`❌ Download error: ${error.message}`);
        }
    }

    // ==================== COMMON METHODS ====================

    async clearAllData() {
        if (!confirm('Clear all accumulated data and reset sessions?')) return;

        try {
            this.updateLog('🗑️ Clearing all data...');
            await chrome.runtime.sendMessage({ action: 'clearAllData' });

            // Also clear Polyglotta data
            await chrome.storage.local.set({
                polyglottaSession: { isActive: false },
                polyglottaSections: []
            });

            this.updateLog('✅ All data cleared!');
            this.updateStatus('ready', 'Ready to scrape');
            this.resetUI();
        } catch (error) {
            this.updateLog(`❌ Clear error: ${error.message}`);
        }
    }

    stopScraping() {
        this.isRunning = false;
        this.updateStatus('ready', 'Stopped');
        this.updateLog('⏹️ Scraping stopped by user');
        this.resetUI();
        this.sendMessageToTab('STOP_SCRAPING');
    }

    resetUI() {
        this.startBtn.style.display = 'block';
        this.startPolyglottaBtn.style.display = 'block';
        this.stopBtn.style.display = 'none';
        this.progressContainer.style.display = 'none';
        this.isRunning = false;
    }

    updateLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.logEl.innerHTML += `[${timestamp}] ${message}\n`;
        this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    updateStatus(status = 'ready', message = 'Ready to scrape') {
        this.statusEl.className = `status ${status}`;
        this.statusEl.textContent = message;
    }

    updateProgress(step, total, stepName = '') {
        const percentage = (step / total) * 100;
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${stepName} (${step}/${total})`;

        if (step > 0) {
            this.progressContainer.style.display = 'block';
        }

        if (step >= total) {
            setTimeout(() => {
                this.progressContainer.style.display = 'none';
            }, 3000);
        }
    }

    handleMessage(message) {
        const { type, data } = message;

        switch (type) {
            case 'LOG':
                this.updateLog(data.message);
                break;

            case 'STATUS':
                this.updateStatus(data.status, data.message);
                break;

            case 'PROGRESS':
                this.updateProgress(data.step, data.total, data.stepName);
                break;

            case 'COMPLETE':
                this.isRunning = false;

                if (data.downloadFailed) {
                    this.updateStatus('ready', `Complete with errors - use Download button`);
                    this.updateLog(`⚠️ Scraping completed but download failed. Use download button to retry.`);
                } else if (data.paragraphsCount !== undefined) {
                    // Polyglotta complete
                    this.updateStatus('ready', `Complete! ${data.paragraphsCount} paragraphs`);
                    this.updateLog(`🎉 Downloaded ${data.sectionsCount} sections (${data.paragraphsCount} paragraphs)!`);
                } else {
                    // BookToki complete
                    this.updateStatus('ready', `Complete! ${data.chaptersCount} chapters`);
                    this.updateLog(`🎉 Downloaded ${data.chaptersCount} chapters!`);
                }

                this.resetUI();
                break;

            case 'ERROR':
                this.isRunning = false;
                this.updateStatus('error', data.message || 'An error occurred');
                this.updateLog(`❌ Error: ${data.message}`);
                this.resetUI();
                break;
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LexiconForgeScraperPopup();
});
