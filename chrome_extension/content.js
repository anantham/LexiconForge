class BookTokiContentScript {
    constructor() {
        this.isRunning = false;
        this.currentStep = 0;
        this.maxChapters = 10; // Default limit to prevent infinite scraping
        this.delays = {
            short: () => this.randomDelay(2000, 5000),
            medium: () => this.randomDelay(5000, 10000),
            long: () => this.randomDelay(8000, 15000),
            challenge: () => this.randomDelay(10000, 20000)
        };
        
        this.setupMessageListener();
        this.log('📚 BookToki content script loaded');
        
        // Check if scraping session is active and resume if needed
        this.checkAndResumeSession();
    }
    
    async checkAndResumeSession() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSession' });
            const session = response.session;
            
            if (session && session.isActive) {
                this.log(`🔄 Resuming scraping session (chapter ${session.currentChapter}/${session.maxChapters})`);
                this.maxChapters = session.maxChapters;
                
                // Wait a moment for page to fully load, then continue
                await this.wait(3000);
                await this.continueScraping();
            }
        } catch (error) {
            this.log(`⚠️ Could not check session status: ${error.message}`);
        }
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
            sendResponse({success: true});
        });
    }
    
    handleMessage(message) {
        const { action, maxChapters } = message;
        
        switch (action) {
            case 'START_SCRAPING':
                if (maxChapters) {
                    this.maxChapters = maxChapters;
                }
                this.startMultiChapterScraping();
                break;
            case 'SAVE_PAGE':
                this.saveCurrentPage();
                break;
            case 'STOP_SCRAPING':
                this.stopScraping();
                break;
        }
    }
    
    log(message) {
        console.log(`[BookToki] ${message}`);
        this.sendToPopup('LOG', { message });
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
            // Popup might be closed, that's okay
        }
    }
    
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async waitForElement(selector, timeout = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                return element;
            }
            await this.wait(500);
        }
        
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    }
    
    async humanClick(element, description = 'element') {
        if (!element) {
            throw new Error(`Cannot click ${description} - element not found`);
        }
        
        this.log(`👆 Clicking ${description}...`);
        
        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.wait(this.delays.short());
        
        // Add human-like mouse movement simulation
        const rect = element.getBoundingClientRect();
        const event = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        });
        element.dispatchEvent(event);
        
        await this.wait(this.randomDelay(200, 800));
        
        // Click
        element.click();
        await this.wait(this.delays.short());
    }
    
    async humanType(element, text, description = 'input') {
        if (!element) {
            throw new Error(`Cannot type in ${description} - element not found`);
        }
        
        this.log(`⌨️ Typing "${text}" in ${description}...`);
        
        element.focus();
        await this.wait(this.randomDelay(300, 800));
        
        element.value = '';
        
        // Type character by character with human-like delays
        for (const char of text) {
            element.value += char;
            
            // Dispatch input event for each character
            element.dispatchEvent(new Event('input', { bubbles: true }));
            
            await this.wait(this.randomDelay(80, 250));
        }
        
        await this.wait(this.delays.short());
    }
    
    async detectAndHandleChallenge(timeout = 120000) {
        const challengeIndicators = [
            '잠시만 기다리',
            '사람인지 확인',
            'just a moment',
            'please wait',
            'checking',
            'verifying'
        ];
        
        const title = document.title.toLowerCase();
        const bodyText = document.body.textContent.toLowerCase();
        
        const hasChallenge = challengeIndicators.some(indicator => 
            title.includes(indicator) || bodyText.includes(indicator)
        );
        
        if (!hasChallenge) {
            return true;
        }
        
        this.log('🛡️ Cloudflare challenge detected - waiting for resolution...');
        this.updateStatus('working', 'Waiting for challenge resolution...');
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            await this.wait(this.delays.challenge());
            
            const currentTitle = document.title.toLowerCase();
            const currentBodyText = document.body.textContent.toLowerCase();
            
            const stillHasChallenge = challengeIndicators.some(indicator => 
                currentTitle.includes(indicator) || currentBodyText.includes(indicator)
            );
            
            if (!stillHasChallenge) {
                this.log('✅ Challenge resolved!');
                return true;
            }
            
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            this.log(`⏳ Still waiting for challenge... (${elapsed}s elapsed)`);
        }
        
        throw new Error('Challenge resolution timeout');
    }
    
    async saveCurrentPage(filename = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const url = window.location.href;
            const title = document.title;
            
            if (!filename) {
                const urlParts = url.split('/');
                const lastPart = urlParts[urlParts.length - 1] || 'page';
                filename = `booktoki_${lastPart.split('?')[0]}_${timestamp}.html`;
            }
            
            // Extract and log content info for LexiconForge compatibility
            const contentInfo = this.extractContentInfo();
            if (contentInfo) {
                this.log(`📖 Extracted title: "${contentInfo.title}"`);
                this.log(`📝 Content preview: "${contentInfo.content.substring(0, 100)}..."`);
                this.log(`🔢 Content length: ${contentInfo.content.length} characters`);
                this.log(`🇰🇷 Korean chars: ${contentInfo.koreanCount}`);
                
                // Save content as JSON for easy import to LexiconForge
                const jsonData = {
                    url,
                    timestamp: new Date().toISOString(),
                    title: contentInfo.title,
                    content: contentInfo.content,
                    nextUrl: contentInfo.nextUrl,
                    prevUrl: contentInfo.prevUrl,
                    stats: {
                        contentLength: contentInfo.content.length,
                        koreanChars: contentInfo.koreanCount,
                        paragraphs: contentInfo.paragraphCount
                    }
                };
                
                const jsonFilename = filename.replace('.html', '_content.json');
                const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
                const jsonDownloadUrl = URL.createObjectURL(jsonBlob);
                
                chrome.runtime.sendMessage({
                    action: 'download',
                    url: jsonDownloadUrl,
                    filename: jsonFilename
                });
                
                this.log(`💾 Saved content as: ${jsonFilename}`);
            }
            
            // Get the full HTML
            const htmlContent = `<!-- Scraped from: ${url} -->\n` +
                              `<!-- Page title: ${title} -->\n` +
                              `<!-- Timestamp: ${new Date().toISOString()} -->\n\n` +
                              document.documentElement.outerHTML;
            
            // Create blob and download
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const downloadUrl = URL.createObjectURL(blob);
            
            // Use Chrome extension downloads API
            chrome.runtime.sendMessage({
                action: 'download',
                url: downloadUrl,
                filename: filename
            });
            
            this.log(`💾 Saved page as: ${filename}`);
            this.log(`📊 HTML size: ${htmlContent.length.toLocaleString()} characters`);
            
        } catch (error) {
            this.log(`❌ Error saving page: ${error.message}`);
            throw error;
        }
    }
    
    extractContentInfo() {
        try {
            // Extract title using BookToki pattern
            const fullTitle = document.title;
            let chapterTitle = null;
            
            // Try to extract Korean chapter title pattern like "던전 디펜스-2화"
            const chapterMatch = fullTitle.match(/([^_|]+?-\d+화)/);
            if (chapterMatch) {
                chapterTitle = chapterMatch[1].trim();
            } else {
                // Fallback: try h1, h2 elements
                const h1Title = document.querySelector('h1')?.textContent?.trim();
                if (h1Title) {
                    chapterTitle = h1Title;
                } else {
                    const h2Title = document.querySelector('h2')?.textContent?.trim();
                    if (h2Title) {
                        chapterTitle = h2Title;
                    } else {
                        chapterTitle = fullTitle.split('|')[0].trim();
                    }
                }
            }
            
            // Extract content using BookToki structure
            const contentContainer = document.querySelector('#novel_content');
            if (!contentContainer) {
                this.log('⚠️ No #novel_content found');
                return null;
            }
            
            // Look for content within the f9e99a33513 div
            let contentDiv = contentContainer.querySelector('div.f9e99a33513');
            if (!contentDiv) {
                contentDiv = contentContainer;
                this.log('📝 Using #novel_content directly (no f9e99a33513 div)');
            } else {
                this.log('📝 Found f9e99a33513 content div');
            }
            
            // Extract paragraphs
            const paragraphs = contentDiv.querySelectorAll('p');
            const validParagraphs = [];
            
            paragraphs.forEach(p => {
                const text = p.textContent?.trim();
                if (text && this.isValidParagraph(text)) {
                    validParagraphs.push(text);
                }
            });
            
            if (!validParagraphs.length) {
                this.log('⚠️ No valid paragraphs found, trying raw text');
                const rawText = contentDiv.textContent?.trim();
                if (rawText) {
                    const lines = rawText.split('\n')
                        .map(line => line.trim())
                        .filter(line => line && this.isValidParagraph(line));
                    validParagraphs.push(...lines);
                }
            }
            
            if (!validParagraphs.length) {
                this.log('❌ No content could be extracted');
                return null;
            }
            
            const content = validParagraphs.join('\n\n');
            const koreanCount = (content.match(/[가-힣]/g) || []).length;
            
            // Extract navigation links
            const nextUrl = this.findNavigationLink(true);
            const prevUrl = this.findNavigationLink(false);
            
            return {
                title: chapterTitle,
                content,
                nextUrl,
                prevUrl,
                koreanCount,
                paragraphCount: validParagraphs.length
            };
            
        } catch (error) {
            this.log(`❌ Content extraction error: ${error.message}`);
            return null;
        }
    }
    
    isValidParagraph(text) {
        if (!text || text.length < 3) return false;
        
        // Skip separator lines and metadata
        const invalidPatterns = [
            /^={5,}/, // Separator lines like "====="
            /^\d{5}\s/, // Chapter numbers like "00002"
            /^https?:\/\//, // URLs
            /^www\./, // Web addresses
        ];
        
        return !invalidPatterns.some(pattern => pattern.test(text.trim()));
    }
    
    findNavigationLink(isNext) {
        try {
            // Look for navigation links
            const navSelectors = [
                'a[href*="/novel/"]', // Direct novel links
                '.btn-group a[href]', // Button group navigation
                '.pagination a[href]', // Pagination links
                'a[href*="chapter"]', // Chapter links
            ];
            
            const navLinks = [];
            navSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                navLinks.push(...Array.from(links));
            });
            
            if (!navLinks.length) return null;
            
            // Extract current chapter ID from URL
            const currentChapterId = this.extractChapterIdFromUrl(window.location.href);
            if (!currentChapterId) return null;
            
            // Filter and analyze navigation links
            const chapterLinks = navLinks
                .map(link => {
                    const href = link.getAttribute('href');
                    if (!href || !href.includes('/novel/')) return null;
                    
                    const linkChapterId = this.extractChapterIdFromUrl(href);
                    if (!linkChapterId || linkChapterId === currentChapterId) return null;
                    
                    return {
                        url: new URL(href, window.location.href).href,
                        text: link.textContent?.trim() || '',
                        chapterId: linkChapterId
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.chapterId - b.chapterId);
            
            if (!chapterLinks.length) return null;
            
            if (isNext) {
                // Find next chapter (higher ID)
                const nextLink = chapterLinks.find(link => link.chapterId > currentChapterId);
                return nextLink?.url || null;
            } else {
                // Find previous chapter (lower ID)
                const prevLink = chapterLinks.reverse().find(link => link.chapterId < currentChapterId);
                return prevLink?.url || null;
            }
        } catch (error) {
            return null;
        }
    }
    
    extractChapterIdFromUrl(url) {
        const match = url.match(/\/novel\/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }
    
    
    async startMultiChapterScraping() {
        if (this.isRunning) {
            this.log('⚠️ Multi-chapter scraping already in progress');
            return;
        }
        
        this.isRunning = true;
        
        try {
            this.log('🚀 Starting multi-chapter scraping...');
            this.updateStatus('working', 'Starting multi-chapter scraping...');
            
            // Initialize session in background script
            await chrome.runtime.sendMessage({
                action: 'startSession',
                maxChapters: this.maxChapters,
                startUrl: window.location.href
            });
            
            // Start scraping from current page
            await this.continueScraping();
            
        } catch (error) {
            this.log(`❌ Multi-chapter scraping failed: ${error.message}`);
            this.updateStatus('error', error.message);
            this.sendToPopup('ERROR', { message: error.message });
            this.isRunning = false;
        }
    }
    
    async continueScraping() {
        try {
            // Get current session state
            const sessionResponse = await chrome.runtime.sendMessage({ action: 'getSession' });
            const session = sessionResponse.session;
            
            if (!session || !session.isActive) {
                this.log('❌ No active scraping session found');
                return;
            }
            
            this.isRunning = true;
            const currentChapter = session.currentChapter;
            const maxChapters = session.maxChapters;
            
            this.log(`📖 Processing chapter ${currentChapter} of ${maxChapters}...`);
            this.updateProgress(currentChapter, maxChapters, `Scraping chapter ${currentChapter}`);
            this.sendToPopup('PROGRESS', { 
                step: currentChapter, 
                total: maxChapters, 
                stepName: `Scraping chapter ${currentChapter}` 
            });
            
            // Extract current chapter content
            const contentInfo = this.extractContentInfo();
            if (contentInfo && contentInfo.title && contentInfo.content) {
                const chapterData = {
                    chapterNumber: currentChapter,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    ...contentInfo
                };
                
                // Save chapter to background storage
                const addResponse = await chrome.runtime.sendMessage({
                    action: 'addChapter',
                    chapterData: chapterData
                });
                
                this.log(`✅ Extracted chapter ${currentChapter}: "${contentInfo.title}" (${contentInfo.content.length} chars)`);
                this.log(`📊 Total chapters accumulated: ${addResponse.totalChapters}`);
            } else {
                this.log(`⚠️ Failed to extract chapter ${currentChapter}, continuing...`);
            }
            
            // Check if we should continue or complete
            if (currentChapter >= maxChapters) {
                // Complete scraping - add delay to ensure downloads complete
                this.log('🏁 Reached maximum chapters, preparing downloads...');
                
                // Wait a bit to ensure any pending operations complete
                await this.wait(2000);
                
                try {
                    const completeResponse = await chrome.runtime.sendMessage({ action: 'completeSession' });
                    console.log('[Content] Complete response:', completeResponse);
                    
                    if (completeResponse.success) {
                        this.log(`🎉 Scraping completed! Downloaded ${completeResponse.chaptersCount} chapters`);
                        this.updateStatus('ready', `Completed! Downloaded ${completeResponse.chaptersCount} chapters`);
                        this.sendToPopup('COMPLETE', { chaptersCount: completeResponse.chaptersCount });
                    } else {
                        this.log(`⚠️ Download failed: ${completeResponse.error}`);
                        this.log(`📚 ${completeResponse.chaptersCount || maxChapters} chapters collected but download failed`);
                        this.log(`💡 Use "Download Accumulated" button to retry download`);
                        this.updateStatus('ready', `Collection complete - download failed (${completeResponse.chaptersCount || maxChapters} chapters ready)`);
                        this.sendToPopup('COMPLETE', { 
                            chaptersCount: completeResponse.chaptersCount || maxChapters, 
                            downloadFailed: true,
                            error: completeResponse.error
                        });
                    }
                } catch (error) {
                    this.log(`⚠️ Error completing session: ${error.message}`);
                    this.log(`💡 Chapters may still be available - try "Download Accumulated" button`);
                    this.updateStatus('ready', `Completed with errors - check downloads`);
                    this.sendToPopup('COMPLETE', { chaptersCount: maxChapters, downloadFailed: true });
                }
                
                this.isRunning = false;
                return;
            }
            
            // Check if there's a next chapter
            const nextUrl = this.findNavigationLink(true);
            if (nextUrl && this.isRunning) {
                this.log(`➡️ Navigating to next chapter: ${nextUrl}`);
                
                // Update session with next chapter number
                await chrome.runtime.sendMessage({
                    action: 'updateSession',
                    updates: { currentChapter: currentChapter + 1 }
                });
                
                // Wait before navigation (human-like delay)
                await this.wait(this.delays.medium());
                
                // Navigate to next chapter - page will reload and resume automatically
                window.location.href = nextUrl;
            } else {
                // No more chapters found - complete session
                const completeResponse = await chrome.runtime.sendMessage({ action: 'completeSession' });
                this.log(`📚 No more chapters found. Completed with ${completeResponse.chaptersCount} chapters`);
                this.updateStatus('ready', `Completed! Scraped ${completeResponse.chaptersCount} chapters`);
                this.sendToPopup('COMPLETE', { chaptersCount: completeResponse.chaptersCount });
                this.isRunning = false;
            }
            
        } catch (error) {
            this.log(`❌ Scraping continuation failed: ${error.message}`);
            this.updateStatus('error', error.message);
            this.sendToPopup('ERROR', { message: error.message });
            this.isRunning = false;
        }
    }
    
    
    async stopScraping() {
        this.isRunning = false;
        this.log('⏹️ Scraping stopped by user');
        this.updateStatus('ready', 'Scraping stopped');
        
        // Save any chapters accumulated so far and clear session
        try {
            const stopResponse = await chrome.runtime.sendMessage({ action: 'stopSession' });
            if (stopResponse.chaptersCount > 0) {
                this.log(`💾 Saved ${stopResponse.chaptersCount} chapters before stopping`);
                this.sendToPopup('COMPLETE', { chaptersCount: stopResponse.chaptersCount });
            }
        } catch (error) {
            this.log(`⚠️ Error stopping session: ${error.message}`);
        }
    }
}

// Initialize content script
const bookTokiScraper = new BookTokiContentScript();