// Background service worker for LexiconForge Scraper Extension
// Supports: BookToki (Korean novels) and Polyglotta (Buddhist texts)

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

    // ==================== POLYGLOTTA METHODS ====================

    async startPolyglottaSession(metadata, sectionUrls, totalSections, manifest = null) {
        await chrome.storage.local.set({
            polyglottaSession: {
                isActive: true,
                source: 'polyglotta',
                metadata,
                sectionUrls,
                currentSection: 0,
                totalSections,
                startTime: new Date().toISOString(),
                manifest: manifest || {
                    expectedSections: totalSections,
                    capturedSections: 0,
                    failedSections: [],
                    skippedSections: [],
                    warnings: [],
                    startTime: new Date().toISOString(),
                    endTime: null
                }
            },
            polyglottaSections: []
        });
        console.log(`[Background] Started Polyglotta session: ${metadata.title} (${totalSections} sections)`);
    }

    async getPolyglottaSession() {
        const result = await chrome.storage.local.get(['polyglottaSession']);
        return result.polyglottaSession || null;
    }

    async addPolyglottaSection(sectionData) {
        const result = await chrome.storage.local.get(['polyglottaSections']);
        const sections = result.polyglottaSections || [];
        sections.push(sectionData);
        await chrome.storage.local.set({ polyglottaSections: sections });
        console.log(`[Background] Added section: ${sectionData.sectionName} (${sectionData.paragraphs.length} paragraphs)`);
        return sections.length;
    }

    async getPolyglottaSections() {
        const result = await chrome.storage.local.get(['polyglottaSections']);
        return result.polyglottaSections || [];
    }

    async completePolyglottaSession(manifest = null, metrics = null) {
        const session = await this.getPolyglottaSession();
        const sections = await this.getPolyglottaSections();

        // Use provided manifest or session manifest
        const finalManifest = manifest || session?.manifest || {
            expectedSections: sections.length,
            capturedSections: sections.length,
            failedSections: [],
            skippedSections: [],
            warnings: [],
            startTime: session?.startTime,
            endTime: new Date().toISOString()
        };

        if (sections.length === 0) {
            console.log('[Background] No Polyglotta sections to save');
            return { success: true, sectionsCount: 0, paragraphsCount: 0, manifest: finalManifest };
        }

        try {
            // Flatten all paragraphs into aligned format
            const allParagraphs = [];
            let totalParagraphs = 0;

            sections.forEach(section => {
                section.paragraphs.forEach(para => {
                    allParagraphs.push({
                        ...para,
                        section: section.sectionName,
                        sectionCid: section.cid
                    });
                    totalParagraphs++;
                });
            });

            // Calculate integrity status
            const integrityPassed =
                finalManifest.capturedSections === finalManifest.expectedSections &&
                finalManifest.failedSections.length === 0;

            // Create LexiconForge-compatible output with integrity report
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeTitle = (session?.metadata?.title || 'polyglotta').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            const integrityTag = integrityPassed ? 'COMPLETE' : 'PARTIAL';
            const filename = `polyglotta_${safeTitle}_${sections.length}sections_${integrityTag}_${timestamp}.json`;

            const jsonData = {
                metadata: {
                    scrapeDate: new Date().toISOString(),
                    source: 'polyglotta',
                    scraper: 'LexiconForge Chrome Extension (Robust Edition)',
                    version: '3.0',
                    text: session?.metadata || {},
                    totalSections: sections.length,
                    totalParagraphs: totalParagraphs,
                    sessionStartTime: session?.startTime || new Date().toISOString()
                },
                // Integrity report for verification
                integrityReport: {
                    passed: integrityPassed,
                    expectedSections: finalManifest.expectedSections,
                    capturedSections: finalManifest.capturedSections,
                    failedSections: finalManifest.failedSections,
                    skippedSections: finalManifest.skippedSections,
                    warnings: finalManifest.warnings,
                    scrapeStartTime: finalManifest.startTime,
                    scrapeEndTime: finalManifest.endTime || new Date().toISOString(),
                    durationSeconds: finalManifest.startTime && finalManifest.endTime
                        ? Math.round((new Date(finalManifest.endTime) - new Date(finalManifest.startTime)) / 1000)
                        : null
                },
                // Performance metrics
                metrics: metrics ? {
                    totalDurationMs: metrics.totalDurationMs,
                    expandTimeMs: metrics.expandTimeMs,
                    extractionTimeMs: metrics.extractionTimeMs,
                    avgSectionMs: metrics.avgSectionMs,
                    totalParagraphs: metrics.totalParagraphs,
                    languagesFound: metrics.languagesFound,
                    sectionTimings: metrics.sectionTimings,
                    fastestSection: metrics.fastestSection,
                    slowestSection: metrics.slowestSection
                } : null,
                // For LexiconForge import: treat each section as a "chapter"
                chapters: sections.map((section, idx) => ({
                    chapterNumber: idx + 1,
                    stableId: `polyglotta_${section.cid}`,
                    title: section.sectionName,
                    url: section.url,
                    cid: section.cid,
                    languagesFound: section.languagesFound || [],
                    extractedAt: section.extractedAt,
                    // Store all language versions
                    polyglotContent: section.paragraphs,
                    // For compatibility: use Sanskrit or first available as "content"
                    content: section.paragraphs.map(p => {
                        const primaryLang = p.versions.sanskrit || p.versions.tibetan ||
                            p.versions['chinese-kumarajiva'] || Object.values(p.versions)[0];
                        return primaryLang?.text || '';
                    }).join('\n\n'),
                    // Store English translations as fanTranslation
                    fanTranslation: section.paragraphs.map(p => {
                        const eng = p.versions['english-lamotte'] || p.versions['english-thurman'] ||
                            p.versions.english;
                        return eng?.text || '';
                    }).join('\n\n')
                })),
                // Also include raw aligned data for advanced use
                alignedParagraphs: allParagraphs
            };

            const jsonString = JSON.stringify(jsonData, null, 2);
            const jsonDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonString)}`;

            const downloadId = await chrome.downloads.download({
                url: jsonDataUrl,
                filename: filename
            });

            console.log(`[Background] Downloaded Polyglotta: ${filename} (ID: ${downloadId})`);
            console.log(`[Background] ${sections.length} sections, ${totalParagraphs} paragraphs`);
            console.log(`[Background] Integrity: ${integrityPassed ? 'PASSED' : 'FAILED'}`);

            // Clear session
            await chrome.storage.local.set({
                polyglottaSession: { isActive: false },
                polyglottaSections: []
            });

            return {
                success: true,
                sectionsCount: sections.length,
                paragraphsCount: totalParagraphs,
                integrityPassed,
                manifest: finalManifest
            };

        } catch (error) {
            console.error(`[Background] Error saving Polyglotta: ${error.message}`);
            return {
                success: false,
                error: error.message,
                sectionsCount: sections.length,
                manifest: finalManifest
            };
        }
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

    // ==================== POLYGLOTTA HANDLERS ====================

    if (action === 'startPolyglottaSession') {
        sessionManager.startPolyglottaSession(
            message.metadata,
            message.sectionUrls,
            message.totalSections
        ).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (action === 'getPolyglottaSession') {
        sessionManager.getPolyglottaSession().then((session) => {
            sendResponse({ session });
        });
        return true;
    }

    if (action === 'addPolyglottaSection') {
        sessionManager.addPolyglottaSection(message.sectionData).then((totalSections) => {
            sendResponse({ success: true, totalSections });
        });
        return true;
    }

    if (action === 'getPolyglottaSections') {
        sessionManager.getPolyglottaSections().then((sections) => {
            sendResponse({ sections });
        });
        return true;
    }

    if (action === 'completePolyglottaSession') {
        sessionManager.completePolyglottaSession(message.manifest, message.metrics).then((result) => {
            sendResponse(result);
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('BookToki Scraper Extension installed');
});