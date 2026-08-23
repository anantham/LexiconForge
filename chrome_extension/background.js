// Background service worker for the LexiconForge Polyglotta scraper.
// BookToki support removed 2026-08-23 (source site shut down 2026-04-27).

class ScrapingSessionManager {
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

    async completePolyglottaSession(manifest = null, metrics = null, logs = null) {
        const session = await this.getPolyglottaSession();
        const sections = await this.getPolyglottaSections();

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

            const integrityPassed =
                finalManifest.capturedSections === finalManifest.expectedSections &&
                finalManifest.failedSections.length === 0;

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
                debugLogs: logs || [],
                chapters: sections.map((section, idx) => ({
                    chapterNumber: idx + 1,
                    stableId: `polyglotta_${section.cid}`,
                    title: section.sectionName,
                    url: section.url,
                    cid: section.cid,
                    languagesFound: section.languagesFound || [],
                    extractedAt: section.extractedAt,
                    polyglotContent: section.paragraphs,
                    content: section.paragraphs.map(p => {
                        const primaryLang = p.versions.sanskrit || p.versions.tibetan ||
                            p.versions['chinese-kumarajiva'] || Object.values(p.versions)[0];
                        return primaryLang?.text || '';
                    }).join('\n\n'),
                    fanTranslation: section.paragraphs.map(p => {
                        const eng = p.versions['english-lamotte'] || p.versions['english-thurman'] ||
                            p.versions.english;
                        return eng?.text || '';
                    }).join('\n\n')
                })),
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

    async clearPolyglottaData() {
        await chrome.storage.local.set({
            polyglottaSession: { isActive: false },
            polyglottaSections: []
        });
    }
}

const sessionManager = new ScrapingSessionManager();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action } = message;

    if (action === 'download') {
        chrome.downloads.download({
            url: message.url,
            filename: message.filename || 'polyglotta_page.html'
        }).then((downloadId) => {
            console.log(`Download started with ID: ${downloadId}`);
            sendResponse({success: true, downloadId});
        }).catch((error) => {
            console.error('Download failed:', error);
            sendResponse({success: false, error: error.message});
        });

        return true; // Keep message channel open for async response
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
        sessionManager.completePolyglottaSession(message.manifest, message.metrics, message.logs).then((result) => {
            sendResponse(result);
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (action === 'clearAllData') {
        sessionManager.clearPolyglottaData().then(() => {
            sendResponse({success: true, message: 'All data cleared'});
        });
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('LexiconForge Polyglotta Scraper installed');
});
