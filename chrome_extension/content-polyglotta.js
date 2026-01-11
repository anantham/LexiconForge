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

        // Check if scraping session is active and resume
        this.checkAndResumeSession();
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

        this.log(`📂 Expanded ${expandedCount} sections`);
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
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getPolyglottaSession' });
            const session = response.session;

            if (session && session.isActive) {
                this.log(`🔄 Found active session. Resuming from section ${session.currentSection + 1}/${session.totalSections}`);
                this.sectionUrls = session.sectionUrls || [];
                this.currentSectionIndex = session.currentSection || 0;
                this.manifest = session.manifest || this.manifest;

                await this.wait(2000);
                await this.continueScraping();
            }
        } catch (error) {
            this.log(`ℹ️ No active session to resume`);
        }
    }

    // ==================== MAIN SCRAPING FLOW ====================

    async startScraping(options = {}) {
        if (this.isRunning) {
            this.log('⚠️ Scraping already in progress');
            return;
        }

        this.isRunning = true;
        this.manifest = {
            expectedSections: 0,
            capturedSections: 0,
            failedSections: [],
            skippedSections: [],
            warnings: [],
            startTime: new Date().toISOString(),
            endTime: null,
        };

        try {
            this.log('🚀 Starting Polyglotta scraping (Robust Edition)...');
            this.updateStatus('working', 'Preparing...');

            // Step 1: Expand all collapsed sections
            this.updateStatus('working', 'Expanding navigation tree...');
            await this.expandAllSections();
            await this.wait(1000);

            // Step 2: Extract all section URLs
            this.updateStatus('working', 'Counting sections...');
            this.sectionUrls = this.extractSectionUrls();

            if (this.sectionUrls.length === 0) {
                throw new Error('No section URLs found. Make sure you are on a Polyglotta fulltext page with the navigation tree visible.');
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

        this.manifest.capturedSections++;
        this.log(`✅ Captured: ${sectionData.sectionName} (${sectionData.paragraphs.length} paragraphs, ${sectionData.languagesFound.length} languages)`);

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
        while (this.isRunning && this.currentSectionIndex < this.sectionUrls.length) {
            const section = this.sectionUrls[this.currentSectionIndex];
            const total = this.sectionUrls.length;

            this.log(`📖 Section ${this.currentSectionIndex + 1}/${total}: ${section.name} (${section.chapter})`);
            this.updateProgress(this.currentSectionIndex + 1, total, `${section.chapter}: ${section.name}`);

            // Check if we're already on this section's page
            const currentCid = new URL(window.location.href).searchParams.get('cid');

            if (currentCid === section.cid) {
                // Already on correct page, extract
                try {
                    await this.extractAndSaveCurrentSection(section.cid);
                } catch (error) {
                    this.warn(`Failed to extract ${section.name}: ${error.message}`);
                    this.manifest.failedSections.push({
                        cid: section.cid,
                        name: section.name,
                        error: error.message
                    });
                    this.currentSectionIndex++;
                }

                // Navigate to next if there is one
                if (this.currentSectionIndex < this.sectionUrls.length) {
                    const nextSection = this.sectionUrls[this.currentSectionIndex];
                    const delay = this.randomDelay(2000, 4000);
                    this.log(`⏳ Waiting ${delay}ms before next section...`);
                    await this.wait(delay);

                    this.log(`➡️ Navigating to: ${nextSection.name}`);
                    window.location.href = nextSection.url;
                    return; // Page will reload, script will resume via checkAndResumeSession
                }
            } else {
                // Need to navigate to this section
                this.log(`➡️ Navigating to: ${section.name}`);
                window.location.href = section.url;
                return; // Page will reload
            }
        }

        // All done!
        await this.completeScraping();
    }

    async completeScraping() {
        this.manifest.endTime = new Date().toISOString();

        this.log(`\n${'='.repeat(50)}`);
        this.log(`🏁 SCRAPING COMPLETE`);
        this.log(`${'='.repeat(50)}`);
        this.log(`   Expected sections:  ${this.manifest.expectedSections}`);
        this.log(`   Captured sections:  ${this.manifest.capturedSections}`);
        this.log(`   Failed sections:    ${this.manifest.failedSections.length}`);
        this.log(`   Warnings:           ${this.manifest.warnings.length}`);

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

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'completePolyglottaSession',
                manifest: this.manifest
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
