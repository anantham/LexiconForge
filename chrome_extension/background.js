// Background service worker for BookToki Scraper Extension

class ScrapingSessionManager {
    constructor() {
        this.initializeSession();
    }
    
    async initializeSession() {
        // Initialize default session state
        const session = await this.getSession();
        if (!session) {
            await this.clearSession();
        }
    }
    
    async getSession() {
        const result = await chrome.storage.local.get(['scrapingSession']);
        return result.scrapingSession || null;
    }
    
    async setSession(sessionData) {
        await chrome.storage.local.set({ scrapingSession: sessionData });
    }
    
    async clearSession() {
        await chrome.storage.local.set({
            scrapingSession: {
                isActive: false,
                currentChapter: 0,
                maxChapters: 10,
                startUrl: null,
                startTime: null
            },
            accumulatedChapters: []
        });
    }
    
    async getAccumulatedChapters() {
        const result = await chrome.storage.local.get(['accumulatedChapters']);
        return result.accumulatedChapters || [];
    }
    
    async addChapter(chapterData) {
        const chapters = await this.getAccumulatedChapters();
        chapters.push(chapterData);
        await chrome.storage.local.set({ accumulatedChapters: chapters });
        return chapters.length;
    }
    
    async saveCompletedScraping() {
        const session = await this.getSession();
        const chapters = await this.getAccumulatedChapters();
        
        if (chapters.length > 0) {
            // Create download data
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `booktoki_chapters_${chapters.length}_${timestamp}.json`;
            
            const jsonData = {
                metadata: {
                    scrapeDate: new Date().toISOString(),
                    totalChapters: chapters.length,
                    source: 'booktoki468.com',
                    scraper: 'BookToki Chrome Extension',
                    version: '1.0',
                    sessionStartTime: session?.startTime || new Date().toISOString()
                },
                chapters: chapters
            };
            
            try {
                // Convert JSON to data URL (Manifest V3 compatible)
                const jsonString = JSON.stringify(jsonData, null, 2);
                const jsonDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonString)}`;
                
                // Trigger download
                const downloadId = await chrome.downloads.download({
                    url: jsonDataUrl,
                    filename: filename
                });
                console.log(`[Background] Started download: ${filename} (ID: ${downloadId})`);
                console.log(`[Background] Successfully saved ${chapters.length} chapters to downloads`);
                
                // Only clear session if downloads succeeded
                await this.clearSession();
                return { success: true, chaptersCount: chapters.length };
                
            } catch (error) {
                console.error(`[Background] Error saving downloads: ${error.message}`);
                console.error(`[Background] Full error:`, error);
                console.error(`[Background] Downloads failed - keeping chapters for retry`);
                // Don't clear session, return error
                return { success: false, error: error.message, chaptersCount: chapters.length };
            }
        } else {
            // No chapters to save, just clear session
            await this.clearSession();
            return { success: true, chaptersCount: 0 };
        }
    }
    
    async downloadAccumulatedChapters() {
        const session = await this.getSession();
        const chapters = await this.getAccumulatedChapters();
        
        if (chapters.length > 0) {
            try {
                // Create download data
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `booktoki_chapters_${chapters.length}_${timestamp}.json`;
                
                const jsonData = {
                    metadata: {
                        scrapeDate: new Date().toISOString(),
                        totalChapters: chapters.length,
                        source: 'booktoki468.com',
                        scraper: 'BookToki Chrome Extension',
                        version: '1.0',
                        sessionStartTime: session?.startTime || new Date().toISOString()
                    },
                    chapters: chapters
                };
                
                // Convert JSON to data URL (Manifest V3 compatible)
                const jsonString = JSON.stringify(jsonData, null, 2);
                const jsonDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonString)}`;
                
                // Trigger download
                const downloadId = await chrome.downloads.download({
                    url: jsonDataUrl,
                    filename: filename
                });
                console.log(`[Background] Started download: ${filename} (ID: ${downloadId})`);
                console.log(`[Background] Successfully downloaded ${chapters.length} chapters (session preserved)`);
                
            } catch (error) {
                console.error(`[Background] Error downloading chapters: ${error.message}`);
                throw error;
            }
        }
        
        // Don't clear session - just return count
        return chapters.length;
    }
}

const sessionManager = new ScrapingSessionManager();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action } = message;
    
    if (action === 'download') {
        // Handle download requests from content script
        chrome.downloads.download({
            url: message.url,
            filename: message.filename || 'booktoki_page.html'
        }).then((downloadId) => {
            console.log(`Download started with ID: ${downloadId}`);
            sendResponse({success: true, downloadId});
        }).catch((error) => {
            console.error('Download failed:', error);
            sendResponse({success: false, error: error.message});
        });
        
        return true; // Keep message channel open for async response
    }
    
    // Handle scraping session management
    if (action === 'startSession') {
        // Clear any existing accumulated chapters when starting fresh
        chrome.storage.local.set({ accumulatedChapters: [] }).then(() => {
            return sessionManager.setSession({
                isActive: true,
                currentChapter: 1,
                maxChapters: message.maxChapters || 10,
                startUrl: message.startUrl,
                startTime: new Date().toISOString()
            });
        }).then(() => {
            sendResponse({success: true});
        });
        return true;
    }
    
    if (action === 'getSession') {
        sessionManager.getSession().then((session) => {
            sendResponse({session});
        });
        return true;
    }
    
    if (action === 'addChapter') {
        sessionManager.addChapter(message.chapterData).then((totalChapters) => {
            sendResponse({success: true, totalChapters});
        });
        return true;
    }
    
    if (action === 'updateSession') {
        sessionManager.getSession().then((session) => {
            const updatedSession = { ...session, ...message.updates };
            return sessionManager.setSession(updatedSession);
        }).then(() => {
            sendResponse({success: true});
        });
        return true;
    }
    
    if (action === 'completeSession') {
        sessionManager.saveCompletedScraping().then((result) => {
            console.log(`[Background] Complete session result:`, result);
            if (result.success) {
                sendResponse({success: true, chaptersCount: result.chaptersCount});
            } else {
                sendResponse({success: false, error: result.error, chaptersCount: result.chaptersCount});
            }
        }).catch((error) => {
            console.error(`[Background] Complete session failed:`, error);
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
    
    if (action === 'stopSession') {
        sessionManager.saveCompletedScraping().then((result) => {
            console.log(`[Background] Stop session result:`, result);
            if (result.success) {
                sendResponse({success: true, chaptersCount: result.chaptersCount});
            } else {
                sendResponse({success: false, error: result.error, chaptersCount: result.chaptersCount});
            }
        }).catch((error) => {
            console.error(`[Background] Stop session failed:`, error);
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
    
    if (action === 'getAccumulatedChapters') {
        sessionManager.getAccumulatedChapters().then((chapters) => {
            sendResponse({chapters});
        });
        return true;
    }
    
    if (action === 'clearAllData') {
        sessionManager.clearSession().then(() => {
            sendResponse({success: true, message: 'All data cleared'});
        });
        return true;
    }
    
    if (action === 'downloadAccumulated') {
        sessionManager.downloadAccumulatedChapters().then((chaptersCount) => {
            if (chaptersCount > 0) {
                sendResponse({success: true, chaptersCount});
            } else {
                sendResponse({success: false, error: 'No chapters to download'});
            }
        }).catch((error) => {
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('BookToki Scraper Extension installed');
});