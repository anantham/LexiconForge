class BookTokiScraperPopup {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 4;
        this.isRunning = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkSessionStatus();
    }
    
    initializeElements() {
        this.statusEl = document.getElementById('status');
        this.logEl = document.getElementById('log');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.maxChaptersInput = document.getElementById('maxChapters');
        
        // Buttons
        this.startBtn = document.getElementById('startScraping');
        this.downloadBtn = document.getElementById('downloadAccumulated');
        this.clearBtn = document.getElementById('clearAllData');
        this.stopBtn = document.getElementById('stopScraping');
    }
    
    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startMultiChapterScraping());
        this.downloadBtn.addEventListener('click', () => this.downloadAccumulated());
        this.clearBtn.addEventListener('click', () => this.clearAllData());
        this.stopBtn.addEventListener('click', () => this.stopScraping());
        
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
    }
    
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        return tab;
    }
    
    async sendMessageToTab(action, data = {}) {
        const tab = await this.getCurrentTab();
        
        if (!tab.url.includes('booktoki468.com')) {
            this.updateLog('❌ Please navigate to booktoki468.com first');
            return false;
        }
        
        try {
            await chrome.tabs.sendMessage(tab.id, {action, ...data});
            return true;
        } catch (error) {
            this.updateLog(`❌ Error: ${error.message}`);
            return false;
        }
    }
    
    async checkSessionStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSession' });
            const session = response.session;
            
            // Always check accumulated chapters to show count
            const chaptersResponse = await chrome.runtime.sendMessage({ action: 'getAccumulatedChapters' });
            const chaptersCount = chaptersResponse.chapters.length;
            
            if (session && session.isActive) {
                this.isRunning = true;
                
                this.updateStatus('working', `Scraping in progress (${chaptersCount}/${session.maxChapters} chapters)`);
                this.updateProgress(session.currentChapter, session.maxChapters, `Chapter ${session.currentChapter}`);
                
                // Update UI to show session is active
                this.startBtn.style.display = 'none';
                this.stopBtn.style.display = 'block';
                this.maxChaptersInput.value = session.maxChapters;
                
                this.updateLog(`🔄 Scraping session is active - Chapter ${session.currentChapter}/${session.maxChapters}`);
                this.updateLog(`📊 Progress: ${chaptersCount} chapters accumulated so far`);
            } else {
                this.updateStatus('ready', chaptersCount > 0 ? `Ready to scrape (${chaptersCount} chapters stored)` : 'Ready to scrape');
                this.updateLog(chaptersCount > 0 ? 
                    `Extension ready. ${chaptersCount} chapters stored. Navigate to booktoki468.com and click "Start Multi-Chapter Scraping".` :
                    'Extension ready. Navigate to booktoki468.com and click "Start Multi-Chapter Scraping".');
            }
        } catch (error) {
            this.updateStatus('ready', 'Ready to scrape');
            this.updateLog('Extension ready. Navigate to booktoki468.com and click "Start Multi-Chapter Scraping".');
        }
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
        this.currentStep = step;
        this.totalSteps = total;
        
        const percentage = (step / total) * 100;
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `Step ${step} of ${total}: ${stepName}`;
        
        if (step > 0) {
            this.progressContainer.style.display = 'block';
        }
        
        if (step >= total) {
            setTimeout(() => {
                this.progressContainer.style.display = 'none';
            }, 3000);
        }
    }
    
    async startMultiChapterScraping() {
        this.isRunning = true;
        const maxChapters = parseInt(this.maxChaptersInput.value) || 10;
        
        this.updateStatus('working', `Starting multi-chapter scraping (${maxChapters} chapters)...`);
        this.updateLog(`📚 Starting multi-chapter scraping (max ${maxChapters} chapters)...`);
        
        // Hide start button, show stop button
        this.startBtn.style.display = 'none';
        this.stopBtn.style.display = 'block';
        
        // Send max chapters to content script
        await this.sendMessageToTab('START_SCRAPING', { maxChapters });
        
        // Update the maxChapters in content script
        const tab = await this.getCurrentTab();
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (maxChapters) => {
                    if (typeof bookTokiScraper !== 'undefined') {
                        bookTokiScraper.maxChapters = maxChapters;
                    }
                },
                args: [maxChapters]
            });
        } catch (error) {
            // Fallback - extension will use default maxChapters value
            console.log('Could not update maxChapters in content script:', error);
        }
    }
    
    async downloadAccumulated() {
        try {
            this.updateLog('💾 Downloading accumulated chapters...');
            const response = await chrome.runtime.sendMessage({ action: 'downloadAccumulated' });
            
            console.log('Download response:', response); // Debug log
            
            if (response && response.success) {
                this.updateLog(`✅ Downloaded ${response.chaptersCount} chapters successfully!`);
            } else if (response && response.error) {
                this.updateLog(`❌ Download failed: ${response.error}`);
            } else {
                this.updateLog(`❌ Download failed: No response received`);
            }
        } catch (error) {
            this.updateLog(`❌ Download error: ${error.message}`);
        }
    }
    
    async clearAllData() {
        if (confirm('Are you sure you want to clear all accumulated chapters and reset the session?')) {
            try {
                this.updateLog('🗑️ Clearing all data...');
                const response = await chrome.runtime.sendMessage({ action: 'clearAllData' });
                
                if (response.success) {
                    this.updateLog('✅ All data cleared successfully!');
                    this.updateStatus('ready', 'Ready to scrape');
                    
                    // Reset UI
                    this.startBtn.style.display = 'block';
                    this.stopBtn.style.display = 'none';
                    this.progressContainer.style.display = 'none';
                    this.isRunning = false;
                } else {
                    this.updateLog('❌ Failed to clear data');
                }
            } catch (error) {
                this.updateLog(`❌ Clear data error: ${error.message}`);
            }
        }
    }
    
    stopScraping() {
        this.isRunning = false;
        this.updateStatus('ready', 'Scraping stopped');
        this.updateLog('⏹️ Scraping stopped by user');
        
        // Show start button, hide stop button
        this.startBtn.style.display = 'block';
        this.stopBtn.style.display = 'none';
        this.progressContainer.style.display = 'none';
        
        this.sendMessageToTab('STOP_SCRAPING');
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
                const chaptersCount = data.chaptersCount || 0;
                
                if (data.downloadFailed) {
                    this.updateStatus('ready', `Collection complete - download failed (${chaptersCount} chapters ready)`);
                    this.updateLog(`⚠️ Scraping completed but download failed! ${chaptersCount} chapters collected.`);
                    if (data.error) {
                        this.updateLog(`❌ Download error: ${data.error}`);
                    }
                    this.updateLog(`💡 Use "Download Accumulated Chapters" button to retry download.`);
                } else {
                    this.updateStatus('ready', `Scraping completed! (${chaptersCount} chapters)`);
                    this.updateLog(`🎉 Scraping completed! Downloaded ${chaptersCount} chapters.`);
                }
                
                this.startBtn.style.display = 'block';
                this.stopBtn.style.display = 'none';
                this.progressContainer.style.display = 'none';
                break;
                
            case 'ERROR':
                this.isRunning = false;
                this.updateStatus('error', data.message || 'An error occurred');
                this.updateLog(`❌ Error: ${data.message}`);
                this.startBtn.style.display = 'block';
                this.stopBtn.style.display = 'none';
                this.progressContainer.style.display = 'none';
                break;
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BookTokiScraperPopup();
});