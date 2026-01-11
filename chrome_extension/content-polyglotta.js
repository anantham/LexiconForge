/**
 * Polyglotta Content Script - Robust Edition
 * Scrapes parallel Buddhist texts from www2.hf.uio.no/polyglotta
 *
 * Features:
 * - Auto-expand collapsed navigation sections
 * - Pre-flight assertions (expected vs found section count)
 * - Retry mechanism with exponential backoff
 * - Content validation (non-empty, expected languages)
 * - Integrity manifest tracking
 * - Progress persistence after each section
 * - Final validation report
 */

class PolyglottaContentScript {
    constructor() {
        this.isRunning = false;
        this.sectionUrls = [];
        this.currentSectionIndex = 0;

        // Integrity tracking
        this.manifest = {
            expectedSections: 0,
            capturedSections: 0,
            failedSections: [],
            skippedSections: [],
            warnings: [],
            startTime: null,
            endTime: null,
        };

        // Metrics tracking
        this.metrics = {
            sectionTimings: [],          // Array of { cid, name, durationMs, paragraphs, languages }
            navigationTimeMs: 0,         // Total time spent navigating
            extractionTimeMs: 0,         // Total time spent extracting
            expandTimeMs: 0,             // Time spent expanding sections
            totalParagraphs: 0,
            totalLanguages: new Set(),
        };

        // Retry configuration
        this.config = {
            maxRetries: 3,
            baseDelayMs: 2000,
            maxDelayMs: 30000,
            pageLoadWaitMs: 3000,
            expandWaitMs: 500,
        };

        // Expected languages (for validation)
        this.expectedLanguages = ['sanskrit', 'chinese', 'tibetan', 'english'];

        this.setupMessageListener();

        // Verbose initialization logging for diagnostics
        console.log('='.repeat(60));
        console.log('[Polyglotta] 📚 Content script INITIALIZING');
        console.log('[Polyglotta] URL:', window.location.href);
        console.log('[Polyglotta] Document ready state:', document.readyState);
        console.log('[Polyglotta] Timestamp:', new Date().toISOString());
        console.log('='.repeat(60));

        this.log('📚 Polyglotta content script loaded (Robust Edition)');
        this.log(`📍 Current URL: ${window.location.href}`);
        this.log(`📍 Document state: ${document.readyState}`);

        // Wait for page to be ready before checking session
        this.waitForPageReady().then(async () => {
            this.log('✅ Page ready - checking for pending actions...');

            // Check if we were redirected here to start scraping
            const pendingResult = await chrome.storage.local.get(['polyglottaPendingStart']);
            const pending = pendingResult.polyglottaPendingStart;

            if (pending?.shouldStart && (Date.now() - pending.timestamp) < 30000) {
                this.log(`🔄 Found pending scrape request (max ${pending.maxSections} sections)`);
                await chrome.storage.local.remove(['polyglottaPendingStart']);
                await this.startScraping({ maxSections: pending.maxSections });
            } else {
                // Check for active session to resume
                this.checkAndResumeSession();
            }
        }).catch(err => {
            this.log(`❌ Page ready check failed: ${err.message}`);
            console.error('[Polyglotta] Initialization error:', err);
        });
    }

    /**
     * Wait for the page to fully load with navigation tree visible
     */
    async waitForPageReady() {
        const maxWait = 60000; // 60 seconds max
        const checkInterval = 500;
        const startTime = Date.now();

        this.log('⏳ Waiting for page to load...');

        while (Date.now() - startTime < maxWait) {
            // Check if navigation tree has loaded
            const navLinks = document.querySelectorAll('a[href*="page=fulltext"][href*="cid="]');
            const hasNavTree = navLinks.length > 0;

            // Check if main content area exists
            const hasContent = document.querySelector('.BolkContainer') ||
                               document.querySelector('.headline') ||
                               document.querySelector('.brodsmuleboks');

            if (hasNavTree || hasContent) {
                const elapsed = Date.now() - startTime;
                this.log(`⏱️ Page loaded in ${elapsed}ms (found ${navLinks.length} navigation links)`);
                return true;
            }

            // Still loading - show progress
            if ((Date.now() - startTime) % 5000 < checkInterval) {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                this.log(`⏳ Still loading... (${elapsed}s)`);
            }

            await this.wait(checkInterval);
        }

        this.warn(`Page load timeout after ${maxWait / 1000}s - proceeding anyway`);
        return false;
    }

    // ==================== UTILITIES ====================

    log(message) {
        const timestamp = new Date().toISOString().substr(11, 8);
        console.log(`[Polyglotta ${timestamp}] ${message}`);
        this.sendToPopup('LOG', { message });
    }

    warn(message) {
        console.warn(`[Polyglotta] ⚠️ ${message}`);
        this.manifest.warnings.push({ time: new Date().toISOString(), message });
        this.sendToPopup('LOG', { message: `⚠️ ${message}` });
    }

    updateStatus(status, message) {
        this.sendToPopup('STATUS', { status, message });
    }

    updateProgress(step, total, stepName) {
        this.sendToPopup('PROGRESS', { step, total, stepName });
    }

    sendToPopup(type, data) {
        try {
            chrome.runtime.sendMessage({ type, data });
        } catch (error) {
            // Popup might be closed - that's OK
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const mins = Math.floor(ms / 60000);
        const secs = Math.round((ms % 60000) / 1000);
        return `${mins}m ${secs}s`;
    }

    /**
     * Analyze current URL and page state
     */
    analyzeCurrentPage() {
        const url = new URL(window.location.href);
        const params = {
            page: url.searchParams.get('page'),
            view: url.searchParams.get('view'),
            vid: url.searchParams.get('vid'),
            cid: url.searchParams.get('cid'),
            level: url.searchParams.get('level'),
        };

        const analysis = {
            url: window.location.href,
            params,
            isFulltextPage: params.page === 'fulltext',
            isOnSpecificSection: !!params.cid,
            vid: params.vid,
            cid: params.cid,
        };

        // Check what's visible on the page
        const navLinks = document.querySelectorAll('a[href*="page=fulltext"][href*="cid="]');
        const bolkContainers = document.querySelectorAll('.BolkContainer');
        const headline = document.querySelector('.headline');

        analysis.dom = {
            navLinksCount: navLinks.length,
            bolkContainersCount: bolkContainers.length,
            hasHeadline: !!headline,
            headlineText: headline?.textContent?.trim() || null,
        };

        return analysis;
    }

    /**
     * Get the table of contents URL (without cid parameter)
     */
    getTableOfContentsUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('cid');
        url.searchParams.delete('level');
        return url.href;
    }

    /**
     * Navigate to table of contents if we're on a specific section
     */
    async ensureOnTableOfContents() {
        const analysis = this.analyzeCurrentPage();

        this.log(`\n${'─'.repeat(50)}`);
        this.log(`📊 PAGE ANALYSIS:`);
        this.log(`   URL: ${analysis.url}`);
        this.log(`   vid=${analysis.params.vid}, cid=${analysis.params.cid || 'none'}, level=${analysis.params.level || 'none'}`);
        this.log(`   Is fulltext page: ${analysis.isFulltextPage}`);
        this.log(`   Is on specific section: ${analysis.isOnSpecificSection}`);
        this.log(`   DOM: ${analysis.dom.navLinksCount} nav links, ${analysis.dom.bolkContainersCount} content blocks`);
        this.log(`   Headline: ${analysis.dom.headlineText || 'none'}`);
        this.log(`${'─'.repeat(50)}\n`);

        if (!analysis.isFulltextPage) {
            throw new Error(`Not on a fulltext page. Current page type: ${analysis.params.page || 'unknown'}. Navigate to a Polyglotta text first.`);
        }

        if (!analysis.params.vid) {
            throw new Error('No vid (volume ID) in URL. Navigate to a specific text first.');
        }

        // If we're on a specific section (has cid), we need to go to the table of contents
        if (analysis.isOnSpecificSection) {
            const tocUrl = this.getTableOfContentsUrl();
            this.log(`⚠️ Currently on section cid=${analysis.params.cid}`);
            this.log(`➡️ Navigating to table of contents: ${tocUrl}`);

            // Save state indicating we need to start scraping after navigation
            await chrome.storage.local.set({
                polyglottaPendingStart: {
                    shouldStart: true,
                    maxSections: this.pendingMaxSections || 50,
                    timestamp: Date.now()
                }
            });

            window.location.href = tocUrl;
            return false; // Will reload page
        }

        // Check if we have navigation links
        if (analysis.dom.navLinksCount === 0) {
            this.log(`⚠️ No navigation links found yet. Page may still be loading.`);
            // Try waiting a bit more
            await this.wait(3000);
            const recheck = this.analyzeCurrentPage();
            if (recheck.dom.navLinksCount === 0) {
                throw new Error(`No section links found in navigation tree. Found ${recheck.dom.bolkContainersCount} content blocks. The page structure may have changed or not loaded correctly.`);
            }
            this.log(`✅ After waiting: found ${recheck.dom.navLinksCount} nav links`);
        }

        return true; // Ready to proceed
    }

    // ==================== MESSAGE HANDLING ====================

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sendResponse);
            return true;
        });
    }

    async handleMessage(message, sendResponse) {
        const { action } = message;

        switch (action) {
            case 'PING':
                // Health check - respond immediately
                console.log('[Polyglotta] PING received, responding with PONG');
                sendResponse({ pong: true, timestamp: Date.now(), url: window.location.href });
                break;
            case 'START_SCRAPING':
                await this.startScraping(message);
                sendResponse({ success: true });
                break;
            case 'STOP_SCRAPING':
                this.stopScraping();
                sendResponse({ success: true });
                break;
            case 'GET_MANIFEST':
                sendResponse({ success: true, manifest: this.manifest });
                break;
            default:
                console.log(`[Polyglotta] Unknown action received: ${action}`);
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    // ==================== PRE-FLIGHT: EXPAND ALL SECTIONS ====================

    /**
     * Expand all collapsed navigation sections to reveal all § links
     */
    async expandAllSections() {
        this.log('📂 Expanding all collapsed sections...');
        const expandStart = Date.now();

        let expandedCount = 0;
        let iterations = 0;
        const maxIterations = 20; // Safety limit

        while (iterations < maxIterations) {
            // Find all collapsed/expandable elements
            // Polyglotta uses various patterns for expand/collapse
            const collapsedItems = document.querySelectorAll([
                'a.ajax_tree0[onclick*="LevelTree"]',
                'a.ajax_tree1[onclick*="LevelTree"]',
                'a.ajax_tree2[onclick*="LevelTree"]',
                '[class*="Collapse"][class*="Option"]:not([style*="display: none"])',
                'span.collapsed',
                'img[src*="plus"]',
            ].join(','));

            if (collapsedItems.length === 0) {
                break;
            }

            // Click each to expand
            for (const item of collapsedItems) {
                try {
                    item.click();
                    expandedCount++;
                    await this.wait(this.config.expandWaitMs);
                } catch (e) {
                    // Some elements might not be clickable
                }
            }

            iterations++;
            await this.wait(500); // Wait for DOM updates
        }

        this.metrics.expandTimeMs = Date.now() - expandStart;
        this.log(`📂 Expanded ${expandedCount} sections in ${this.metrics.expandTimeMs}ms`);
        return expandedCount;
    }

    // ==================== SECTION URL EXTRACTION ====================

    /**
     * Extract all section URLs from the navigation tree
     * Returns structured data with chapter grouping
     */
    extractSectionUrls() {
        const sections = [];
        const seen = new Set();

        // Find all section links with cid parameter
        const links = document.querySelectorAll('a[href*="page=fulltext"][href*="cid="]');

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            const cidMatch = href.match(/cid=(\d+)/);
            if (!cidMatch) return;

            const cid = cidMatch[1];
            if (seen.has(cid)) return;
            seen.add(cid);

            // Get section name and try to determine chapter
            const sectionName = link.textContent?.trim() || `Section ${cid}`;

            // Try to find parent chapter
            let chapter = 'Unknown';
            let parent = link.parentElement;
            for (let i = 0; i < 10 && parent; i++) {
                const chapterMatch = parent.textContent?.match(/Chapter\s+([IVX]+|[0-9]+)/i);
                if (chapterMatch) {
                    chapter = `Chapter ${chapterMatch[1]}`;
                    break;
                }
                parent = parent.parentElement;
            }

            const fullUrl = new URL(href, window.location.href).href;

            sections.push({
                cid,
                url: fullUrl,
                name: sectionName,
                chapter,
            });
        });

        // Sort by cid to maintain order
        sections.sort((a, b) => parseInt(a.cid) - parseInt(b.cid));

        this.log(`📋 Found ${sections.length} section URLs across navigation tree`);
        return sections;
    }

    // ==================== CONTENT EXTRACTION ====================

    /**
     * Extract aligned paragraphs from current page with validation
     */
    extractCurrentPage() {
        const paragraphs = [];
        const languagesFound = new Set();

        // Find all BolkContainer divs (each contains one aligned unit)
        const containers = document.querySelectorAll('.BolkContainer');

        if (containers.length === 0) {
            this.warn('No BolkContainer elements found on page');
        }

        containers.forEach((container, index) => {
            const versions = {};
            let paragraphId = null;

            const textvars = container.querySelectorAll('.textvar');

            textvars.forEach(textvar => {
                const langDiv = textvar.querySelector('div[class]');
                if (!langDiv) return;

                const langClass = Array.from(langDiv.classList).find(c =>
                    ['Sanskrit', 'Chinese', 'Tibetan', 'English', 'Pali', 'Mongolian'].includes(c)
                );
                if (!langClass) return;

                languagesFound.add(langClass.toLowerCase());

                const kilderef = langDiv.querySelector('.kilderef')?.textContent?.trim() || '';
                const textSpan = langDiv.querySelector('span.paragraph, span.chaptertitle');
                const text = textSpan?.textContent?.trim() || '';

                if (!paragraphId) {
                    const idMatch = text.match(/^(§\d+)/);
                    if (idMatch) {
                        paragraphId = idMatch[1];
                    }
                }

                let versionKey = langClass.toLowerCase();

                // Disambiguate translators
                const translatorMatch = kilderef.match(/:\s*([^,]+)/);
                if (translatorMatch && langClass === 'Chinese') {
                    const translator = translatorMatch[1].trim();
                    if (translator.includes('Zhīqiān')) versionKey = 'chinese-zhiqian';
                    else if (translator.includes('Kumārajīva')) versionKey = 'chinese-kumarajiva';
                    else if (translator.includes('Xuánzàng')) versionKey = 'chinese-xuanzang';
                }
                if (translatorMatch && langClass === 'English') {
                    const translator = translatorMatch[1].trim();
                    if (translator.includes('Boin') || translator.includes('Lamotte')) versionKey = 'english-lamotte';
                    else if (translator.includes('Thurman')) versionKey = 'english-thurman';
                }

                const cleanText = text.replace(/^§\d+\s*/, '').trim();

                if (cleanText && cleanText !== '&nbsp;' && cleanText !== '\u00a0') {
                    versions[versionKey] = {
                        text: cleanText,
                        reference: kilderef
                    };
                }
            });

            if (Object.keys(versions).length > 0) {
                paragraphs.push({
                    id: paragraphId || `p${index + 1}`,
                    index: index,
                    versions
                });
            }
        });

        // Get current section info
        const currentUrl = window.location.href;
        const cidMatch = currentUrl.match(/cid=(\d+)/);
        const cid = cidMatch ? cidMatch[1] : null;

        const activeLink = document.querySelector('a.ajax_tree0[style*="green"], a.ajax_tree1[style*="green"], a.ajax_tree2[style*="green"]');
        const sectionName = activeLink?.textContent?.trim() || `Section ${cid}`;

        return {
            cid,
            sectionName,
            url: currentUrl,
            paragraphs,
            languagesFound: Array.from(languagesFound),
            extractedAt: new Date().toISOString()
        };
    }

    // ==================== VALIDATION ====================

    /**
     * Validate extracted section data
     */
    validateSectionData(data) {
        const issues = [];

        // Check for paragraphs
        if (!data.paragraphs || data.paragraphs.length === 0) {
            issues.push('No paragraphs extracted');
        }

        // Check for expected languages (at least 2)
        if (data.languagesFound.length < 2) {
            issues.push(`Only ${data.languagesFound.length} language(s) found: ${data.languagesFound.join(', ')}`);
        }

        // Check for empty paragraphs
        const emptyCount = data.paragraphs.filter(p =>
            Object.values(p.versions).every(v => !v.text || v.text.length < 3)
        ).length;

        if (emptyCount > 0) {
            issues.push(`${emptyCount} paragraph(s) appear empty`);
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }

    // ==================== RETRY MECHANISM ====================

    /**
     * Execute with retry and exponential backoff
     */
    async withRetry(operation, context) {
        let lastError;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (attempt < this.config.maxRetries) {
                    const delay = Math.min(
                        this.config.baseDelayMs * Math.pow(2, attempt - 1),
                        this.config.maxDelayMs
                    );

                    this.warn(`${context} failed (attempt ${attempt}/${this.config.maxRetries}). Retrying in ${delay}ms...`);
                    await this.wait(delay);
                }
            }
        }

        throw new Error(`${context} failed after ${this.config.maxRetries} attempts: ${lastError.message}`);
    }

    // ==================== SESSION MANAGEMENT ====================

    async checkAndResumeSession() {
        this.log(`📍 checkAndResumeSession() called`);

        try {
            const response = await chrome.runtime.sendMessage({ action: 'getPolyglottaSession' });
            const session = response.session;

            this.log(`   Session found: ${!!session}`);
            this.log(`   Session active: ${session?.isActive || false}`);

            if (session && session.isActive) {
                this.log(`\n${'═'.repeat(60)}`);
                this.log(`🔄 RESUMING ACTIVE SESSION`);
                this.log(`${'═'.repeat(60)}`);
                this.log(`   Current section: ${session.currentSection + 1}/${session.totalSections}`);
                this.log(`   Section URLs loaded: ${session.sectionUrls?.length || 0}`);
                this.log(`   Manifest captured: ${session.manifest?.capturedSections || 0}`);
                this.log(`${'═'.repeat(60)}\n`);

                this.isRunning = true;
                this.sectionUrls = session.sectionUrls || [];
                this.currentSectionIndex = session.currentSection || 0;
                this.manifest = session.manifest || this.manifest;

                if (this.sectionUrls.length === 0) {
                    this.log(`❌ Session has no section URLs - cannot resume`);
                    this.log(`   This usually means the session was corrupted. Clearing...`);
                    await chrome.storage.local.set({
                        polyglottaSession: { isActive: false },
                        polyglottaSections: []
                    });
                    return;
                }

                this.log(`⏳ Waiting 2s before resuming...`);
                await this.wait(2000);

                this.log(`📍 Calling continueScraping()...`);
                await this.continueScraping();
            } else {
                this.log(`ℹ️ No active session to resume`);
            }
        } catch (error) {
            this.log(`❌ Error checking session: ${error.message}`);
            console.error('[Polyglotta] Session check error:', error);
        }
    }

    // ==================== MAIN SCRAPING FLOW ====================

    async startScraping(options = {}) {
        if (this.isRunning) {
            this.log('⚠️ Scraping already in progress');
            return;
        }

        this.isRunning = true;
        this.pendingMaxSections = options.maxSections || 50;

        // Reset tracking
        this.manifest = {
            expectedSections: 0,
            capturedSections: 0,
            failedSections: [],
            skippedSections: [],
            warnings: [],
            startTime: new Date().toISOString(),
            endTime: null,
        };
        this.metrics = {
            sectionTimings: [],
            navigationTimeMs: 0,
            extractionTimeMs: 0,
            expandTimeMs: 0,
            totalParagraphs: 0,
            totalLanguages: new Set(),
        };

        try {
            this.log(`\n${'═'.repeat(60)}`);
            this.log(`🚀 STARTING POLYGLOTTA SCRAPER`);
            this.log(`${'═'.repeat(60)}`);
            this.log(`   Requested sections: ${this.pendingMaxSections}`);
            this.log(`   Start time: ${this.manifest.startTime}`);
            this.log(`${'═'.repeat(60)}\n`);

            this.updateStatus('working', 'Analyzing page...');

            // Step 0: Ensure we're on the right page
            this.log('📍 Step 0: Checking current page location...');
            const readyToProceed = await this.ensureOnTableOfContents();
            if (!readyToProceed) {
                this.log('🔄 Navigating to table of contents - will resume after page load');
                return; // Page will reload, script will resume
            }

            // Step 1: Wait for page to be fully loaded
            this.log('📍 Step 1: Waiting for page to fully load...');
            this.updateStatus('working', 'Waiting for page to load...');
            await this.waitForPageReady();

            // Step 2: Expand all collapsed sections
            this.log('📍 Step 2: Expanding collapsed navigation sections...');
            this.updateStatus('working', 'Expanding navigation tree...');
            const expandedCount = await this.expandAllSections();
            this.log(`   Expanded ${expandedCount} collapsed items`);
            await this.wait(1000);

            // Step 3: Extract all section URLs
            this.log('📍 Step 3: Extracting section URLs from navigation...');
            this.updateStatus('working', 'Counting sections...');
            this.sectionUrls = this.extractSectionUrls();

            this.log(`   Found ${this.sectionUrls.length} section URLs`);

            if (this.sectionUrls.length === 0) {
                // Detailed error with page state
                const analysis = this.analyzeCurrentPage();
                throw new Error(
                    `No section URLs found!\n` +
                    `   Page URL: ${analysis.url}\n` +
                    `   Nav links in DOM: ${analysis.dom.navLinksCount}\n` +
                    `   Content blocks: ${analysis.dom.bolkContainersCount}\n` +
                    `   Headline: ${analysis.dom.headlineText || 'none'}\n` +
                    `   Possible causes:\n` +
                    `   - Navigation tree not loaded\n` +
                    `   - Page structure changed\n` +
                    `   - Not on a text with sections`
                );
            }

            // Step 3: Apply limit if specified
            const maxSections = options.maxSections || this.sectionUrls.length;
            if (maxSections < this.sectionUrls.length) {
                this.sectionUrls = this.sectionUrls.slice(0, maxSections);
                this.log(`📋 Limited to first ${maxSections} sections`);
            }

            this.manifest.expectedSections = this.sectionUrls.length;

            // Step 4: Pre-flight assertion
            this.log(`\n${'='.repeat(50)}`);
            this.log(`📊 PRE-FLIGHT CHECK`);
            this.log(`   Expected sections: ${this.manifest.expectedSections}`);
            this.log(`   First: ${this.sectionUrls[0]?.name} (cid=${this.sectionUrls[0]?.cid})`);
            this.log(`   Last:  ${this.sectionUrls[this.sectionUrls.length - 1]?.name} (cid=${this.sectionUrls[this.sectionUrls.length - 1]?.cid})`);
            this.log(`${'='.repeat(50)}\n`);

            // Step 5: Get metadata
            const metadata = this.extractTextMetadata();
            this.log(`📖 Text: ${metadata.title}`);

            // Step 6: Initialize session in background
            await chrome.runtime.sendMessage({
                action: 'startPolyglottaSession',
                metadata,
                sectionUrls: this.sectionUrls,
                totalSections: this.sectionUrls.length,
                manifest: this.manifest
            });

            this.currentSectionIndex = 0;

            // Step 7: If already on a section page, extract it
            const currentCid = new URL(window.location.href).searchParams.get('cid');
            if (currentCid) {
                await this.extractAndSaveCurrentSection(currentCid);
            }

            // Step 8: Continue scraping
            await this.continueScraping();

        } catch (error) {
            this.log(`❌ Scraping failed: ${error.message}`);
            this.updateStatus('error', error.message);
            this.sendToPopup('ERROR', { message: error.message });
            this.isRunning = false;
        }
    }

    async extractAndSaveCurrentSection(expectedCid) {
        const extractStart = Date.now();

        const sectionData = await this.withRetry(
            async () => {
                await this.wait(this.config.pageLoadWaitMs);
                const data = this.extractCurrentPage();

                // Validate
                const validation = this.validateSectionData(data);
                if (!validation.valid) {
                    this.warn(`Validation issues for ${data.sectionName}: ${validation.issues.join(', ')}`);
                }

                if (data.paragraphs.length === 0) {
                    throw new Error('No paragraphs extracted - page may not have loaded fully');
                }

                return data;
            },
            `Extract section cid=${expectedCid}`
        );

        // Save to background
        await chrome.runtime.sendMessage({
            action: 'addPolyglottaSection',
            sectionData
        });

        const extractDuration = Date.now() - extractStart;
        this.metrics.extractionTimeMs += extractDuration;

        // Track per-section metrics
        const sectionMetrics = {
            cid: expectedCid,
            name: sectionData.sectionName,
            durationMs: extractDuration,
            paragraphs: sectionData.paragraphs.length,
            languages: sectionData.languagesFound.length,
            timestamp: new Date().toISOString()
        };
        this.metrics.sectionTimings.push(sectionMetrics);
        this.metrics.totalParagraphs += sectionData.paragraphs.length;
        sectionData.languagesFound.forEach(lang => this.metrics.totalLanguages.add(lang));

        this.manifest.capturedSections++;

        // Calculate running stats
        const avgTimeMs = this.metrics.extractionTimeMs / this.manifest.capturedSections;
        const remaining = this.manifest.expectedSections - this.manifest.capturedSections;
        const etaSeconds = Math.round((remaining * avgTimeMs) / 1000);

        this.log(`✅ Captured: ${sectionData.sectionName} (${sectionData.paragraphs.length} para, ${sectionData.languagesFound.length} lang) [${extractDuration}ms, ETA: ${etaSeconds}s]`);

        // Find this section in our list and update index
        const idx = this.sectionUrls.findIndex(s => s.cid === expectedCid);
        if (idx >= 0) {
            this.currentSectionIndex = idx + 1;
        }

        // Update session with progress
        await chrome.runtime.sendMessage({
            action: 'updateSession',
            updates: {
                currentSection: this.currentSectionIndex,
                manifest: this.manifest
            }
        });

        return sectionData;
    }

    async continueScraping() {
        this.log(`\n📍 continueScraping() called`);
        this.log(`   isRunning: ${this.isRunning}`);
        this.log(`   currentSectionIndex: ${this.currentSectionIndex}`);
        this.log(`   sectionUrls.length: ${this.sectionUrls.length}`);

        if (!this.isRunning) {
            this.log(`⚠️ Scraping stopped (isRunning=false)`);
            return;
        }

        if (this.sectionUrls.length === 0) {
            this.log(`❌ No section URLs loaded - cannot continue`);
            throw new Error('Section URLs not loaded. This is a bug - session state may be corrupted.');
        }

        while (this.isRunning && this.currentSectionIndex < this.sectionUrls.length) {
            const section = this.sectionUrls[this.currentSectionIndex];
            const total = this.sectionUrls.length;

            this.log(`\n${'─'.repeat(40)}`);
            this.log(`📖 Section ${this.currentSectionIndex + 1}/${total}: ${section.name}`);
            this.log(`   Chapter: ${section.chapter}`);
            this.log(`   CID: ${section.cid}`);
            this.log(`   URL: ${section.url}`);
            this.log(`${'─'.repeat(40)}`);

            this.updateProgress(this.currentSectionIndex + 1, total, `${section.chapter}: ${section.name}`);

            // Check if we're already on this section's page
            const currentCid = new URL(window.location.href).searchParams.get('cid');
            this.log(`   Current page CID: ${currentCid || 'none'}`);
            this.log(`   Target section CID: ${section.cid}`);

            if (currentCid === section.cid) {
                this.log(`   ✓ Already on correct page - extracting...`);

                // Already on correct page, extract
                try {
                    await this.extractAndSaveCurrentSection(section.cid);
                    this.log(`   ✓ Extraction complete for ${section.name}`);
                } catch (error) {
                    this.log(`   ❌ Extraction FAILED: ${error.message}`);
                    console.error('[Polyglotta] Extraction error:', error);
                    this.manifest.failedSections.push({
                        cid: section.cid,
                        name: section.name,
                        error: error.message,
                        stack: error.stack
                    });
                    this.currentSectionIndex++;
                }

                // Navigate to next if there is one
                if (this.currentSectionIndex < this.sectionUrls.length) {
                    const nextSection = this.sectionUrls[this.currentSectionIndex];
                    const delay = this.randomDelay(2000, 4000);
                    this.log(`⏳ Waiting ${delay}ms before navigating to next section...`);
                    await this.wait(delay);

                    this.log(`➡️ Navigating to: ${nextSection.name} (cid=${nextSection.cid})`);
                    this.log(`   URL: ${nextSection.url}`);
                    window.location.href = nextSection.url;
                    return; // Page will reload, script will resume via checkAndResumeSession
                } else {
                    this.log(`📍 No more sections - calling completeScraping()`);
                }
            } else {
                // Need to navigate to this section
                this.log(`   ✗ Wrong page - navigating to correct section...`);
                this.log(`➡️ Navigating to: ${section.name} (cid=${section.cid})`);
                this.log(`   URL: ${section.url}`);
                window.location.href = section.url;
                return; // Page will reload
            }
        }

        // All done!
        this.log(`\n📍 Exited scraping loop - completing session...`);
        await this.completeScraping();
    }

    async completeScraping() {
        this.manifest.endTime = new Date().toISOString();

        // Calculate final metrics
        const totalDurationMs = new Date(this.manifest.endTime) - new Date(this.manifest.startTime);
        const avgSectionMs = this.metrics.sectionTimings.length > 0
            ? Math.round(this.metrics.extractionTimeMs / this.metrics.sectionTimings.length)
            : 0;
        const fastestSection = this.metrics.sectionTimings.reduce((min, s) =>
            s.durationMs < min.durationMs ? s : min, { durationMs: Infinity });
        const slowestSection = this.metrics.sectionTimings.reduce((max, s) =>
            s.durationMs > max.durationMs ? s : max, { durationMs: 0 });

        this.log(`\n${'='.repeat(60)}`);
        this.log(`🏁 SCRAPING COMPLETE`);
        this.log(`${'='.repeat(60)}`);
        this.log(`   Expected sections:  ${this.manifest.expectedSections}`);
        this.log(`   Captured sections:  ${this.manifest.capturedSections}`);
        this.log(`   Failed sections:    ${this.manifest.failedSections.length}`);
        this.log(`   Warnings:           ${this.manifest.warnings.length}`);
        this.log(``);
        this.log(`📊 METRICS:`);
        this.log(`   Total duration:     ${this.formatDuration(totalDurationMs)}`);
        this.log(`   Expand time:        ${this.formatDuration(this.metrics.expandTimeMs)}`);
        this.log(`   Extraction time:    ${this.formatDuration(this.metrics.extractionTimeMs)}`);
        this.log(`   Avg per section:    ${avgSectionMs}ms`);
        this.log(`   Fastest section:    ${fastestSection.name || 'N/A'} (${fastestSection.durationMs}ms)`);
        this.log(`   Slowest section:    ${slowestSection.name || 'N/A'} (${slowestSection.durationMs}ms)`);
        this.log(`   Total paragraphs:   ${this.metrics.totalParagraphs}`);
        this.log(`   Languages found:    ${Array.from(this.metrics.totalLanguages).join(', ')}`);

        if (this.manifest.failedSections.length > 0) {
            this.log(`\n   ❌ Failed sections:`);
            this.manifest.failedSections.forEach(f => {
                this.log(`      - ${f.name} (cid=${f.cid}): ${f.error}`);
            });
        }

        // Integrity check
        const integrityPassed =
            this.manifest.capturedSections === this.manifest.expectedSections &&
            this.manifest.failedSections.length === 0;

        if (integrityPassed) {
            this.log(`\n   ✅ INTEGRITY CHECK PASSED`);
        } else {
            this.log(`\n   ⚠️ INTEGRITY CHECK: ${this.manifest.capturedSections}/${this.manifest.expectedSections} sections captured`);
        }

        this.log(`${'='.repeat(50)}\n`);

        // Complete session and download
        this.updateStatus('working', 'Preparing download...');

        // Prepare metrics for output
        const metricsForOutput = {
            totalDurationMs: totalDurationMs,
            expandTimeMs: this.metrics.expandTimeMs,
            extractionTimeMs: this.metrics.extractionTimeMs,
            avgSectionMs: avgSectionMs,
            totalParagraphs: this.metrics.totalParagraphs,
            languagesFound: Array.from(this.metrics.totalLanguages),
            sectionTimings: this.metrics.sectionTimings,
            fastestSection: fastestSection.durationMs !== Infinity ? fastestSection : null,
            slowestSection: slowestSection.durationMs !== 0 ? slowestSection : null
        };

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'completePolyglottaSession',
                manifest: this.manifest,
                metrics: metricsForOutput
            });

            if (response.success) {
                this.log(`🎉 Downloaded ${response.sectionsCount} sections with ${response.paragraphsCount} aligned paragraphs!`);
                this.updateStatus('ready', `Complete! ${response.paragraphsCount} paragraphs`);
                this.sendToPopup('COMPLETE', {
                    sectionsCount: response.sectionsCount,
                    paragraphsCount: response.paragraphsCount,
                    integrityPassed,
                    manifest: this.manifest
                });
            } else {
                throw new Error(response.error || 'Download failed');
            }
        } catch (error) {
            this.log(`❌ Error completing: ${error.message}`);
            this.updateStatus('error', error.message);
            this.sendToPopup('COMPLETE', {
                downloadFailed: true,
                manifest: this.manifest
            });
        }

        this.isRunning = false;
    }

    stopScraping() {
        this.isRunning = false;
        this.log('⏹️ Scraping stopped by user');
        this.updateStatus('ready', 'Stopped');

        // Save what we have
        chrome.runtime.sendMessage({
            action: 'completePolyglottaSession',
            manifest: this.manifest
        });
    }

    extractTextMetadata() {
        const headline = document.querySelector('.headline')?.textContent?.trim();
        const breadcrumb = document.querySelector('.brodsmuleboks a:last-of-type')?.textContent?.trim();
        const vidMatch = window.location.href.match(/vid=(\d+)/);
        const vid = vidMatch ? vidMatch[1] : null;

        const languages = [];
        document.querySelectorAll('input[name^="spraak_valg"]').forEach(checkbox => {
            const label = checkbox.closest('label')?.textContent?.trim();
            if (label) {
                const parts = label.split(':');
                languages.push({
                    name: parts[0]?.trim(),
                    code: parts[1]?.trim(),
                    source: parts.slice(2).join(':').trim(),
                    id: checkbox.value,
                    checked: checkbox.checked
                });
            }
        });

        return {
            title: headline || breadcrumb || 'Unknown Text',
            vid,
            languages,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
    }
}

// Initialize
const polyglottaScraper = new PolyglottaContentScript();
